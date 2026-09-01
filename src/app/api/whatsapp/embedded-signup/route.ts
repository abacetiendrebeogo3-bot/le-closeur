import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { code, businessId, redirectUri, isSecondary, label } = await req.json();

    if (!code || !businessId) {
      return NextResponse.json(
        { error: "Paramètres requis manquants (code, businessId)" },
        { status: 400 }
      );
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("Meta credentials missing on server side.");
      return NextResponse.json(
        { error: "Configuration Meta manquante sur le serveur (NEXT_PUBLIC_META_APP_ID ou WHATSAPP_APP_SECRET)" },
        { status: 500 }
      );
    }

    // 1. Échanger le code contre un token d'accès utilisateur (court terme)
    const tokenExchangeUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenExchangeUrl.searchParams.set("client_id", appId);
    tokenExchangeUrl.searchParams.set("client_secret", appSecret);
    tokenExchangeUrl.searchParams.set("code", code);
    // Le redirectUri de la popup ou de l'origine
    tokenExchangeUrl.searchParams.set("redirect_uri", redirectUri || "");

    console.log("Exchanging auth code for user access token...");
    const tokenRes = await fetch(tokenExchangeUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Failed to exchange code for token:", tokenData);
      return NextResponse.json(
        { error: "Échec de l'échange du code d'autorisation contre un jeton d'accès", details: tokenData },
        { status: 400 }
      );
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Échanger le jeton court terme contre un jeton long terme (60 jours / permanent pour WhatsApp)
    console.log("Exchanging short-lived token for long-lived token...");
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    if (!longLivedRes.ok || !longLivedData.access_token) {
      console.error("Failed to get long-lived token:", longLivedData);
      return NextResponse.json(
        { error: "Échec de la génération du jeton d'accès long terme", details: longLivedData },
        { status: 400 }
      );
    }

    const longLivedToken = longLivedData.access_token;

    // 3. Récupérer le WhatsApp Business Account (WABA) lié
    console.log("Retrieving shared WhatsApp Business Accounts...");
    const wabaRes = await fetch("https://graph.facebook.com/v19.0/me/whatsapp_business_accounts", {
      headers: {
        Authorization: `Bearer ${longLivedToken}`,
      },
    });
    const wabaData = await wabaRes.json();

    if (!wabaRes.ok || !wabaData.data || wabaData.data.length === 0) {
      console.error("Failed to fetch WABAs or no WABA found:", wabaData);
      return NextResponse.json(
        { error: "Aucun compte WhatsApp Business n'a été trouvé ou partagé", details: wabaData },
        { status: 400 }
      );
    }

    // On récupère le premier WABA partagé
    const wabaId = wabaData.data[0].id;
    console.log(`Found WABA ID: ${wabaId}`);

    // 3bis. Abonner notre app aux webhooks de ce WABA (indispensable pour recevoir
    // les messages entrants de ce numéro, notamment pour les numéros secondaires
    // en mode Coexistence — sans cet appel, Meta n'envoie jamais les événements
    // de ce WABA vers notre endpoint webhook).
    console.log(`Subscribing app to webhooks for WABA ${wabaId}...`);
    const subscribeRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${longLivedToken}`,
        },
      }
    );
    const subscribeData = await subscribeRes.json();
    if (!subscribeRes.ok || !subscribeData.success) {
      console.error(`Failed to subscribe app to WABA ${wabaId} webhooks:`, subscribeData);
    } else {
      console.log(`App successfully subscribed to WABA ${wabaId} webhooks.`);
    }

    // 4. Récupérer le Phone Number ID associé à ce WABA
    console.log(`Retrieving phone numbers for WABA ${wabaId}...`);
    const phoneRes = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`, {
      headers: {
        Authorization: `Bearer ${longLivedToken}`,
      },
    });
    const phoneData = await phoneRes.json();

    if (!phoneRes.ok || !phoneData.data || phoneData.data.length === 0) {
      console.error("Failed to fetch phone numbers or no numbers found:", phoneData);
      return NextResponse.json(
        { error: "Aucun numéro de téléphone n'est configuré sur le compte WhatsApp Business", details: phoneData },
        { status: 400 }
      );
    }

    // On récupère le premier numéro de téléphone disponible
    const phoneNumberId = phoneData.data[0].id;
    const displayPhoneNumber = phoneData.data[0].display_phone_number;
    console.log(`Found Phone Number ID: ${phoneNumberId} (${displayPhoneNumber})`);

    // 5. Stocker ces informations dans Supabase liées au businessId
    console.log(`Checking existing WhatsApp configuration for business ${businessId}...`);
    const { data: currentBus } = await supabaseServer
      .from("businesses")
      .select("whatsapp_phone_number_id")
      .eq("id", businessId)
      .maybeSingle();

    if (isSecondary || (currentBus && currentBus.whatsapp_phone_number_id && currentBus.whatsapp_phone_number_id !== phoneNumberId)) {
      // Primary is set to a different ID or explicit secondary requested, store in business_phone_numbers
      console.log(`Saving as secondary number in business_phone_numbers for business ${businessId}...`);
      
      const { error: dbError } = await supabaseServer
        .from("business_phone_numbers")
        .upsert({
          business_id: businessId,
          phone_number: displayPhoneNumber || phoneNumberId,
          phone_number_id: phoneNumberId,
          whatsapp_phone_number_id: phoneNumberId,
          waba_id: wabaId,
          access_token: longLivedToken,
          conversation_mode: "human_coexistence",
          label: label || "Commerciale 1"
        }, {
          onConflict: 'phone_number_id'
        });

      if (dbError) {
        console.error("Error storing secondary WhatsApp credentials in Supabase:", dbError);
        return NextResponse.json(
          { error: "Erreur lors de la sauvegarde du numéro secondaire dans la base de données", details: dbError },
          { status: 500 }
        );
      }
    } else {
      // Store as primary
      console.log(`Saving as primary number in businesses for business ${businessId}...`);
      const { error: dbError } = await supabaseServer
        .from("businesses")
        .update({
          whatsapp_access_token: longLivedToken,
          whatsapp_phone_number_id: phoneNumberId,
          whatsapp_waba_id: wabaId,
        })
        .eq("id", businessId);

      if (dbError) {
        console.error("Error storing WhatsApp credentials in Supabase:", dbError);
        return NextResponse.json(
          { error: "Erreur lors de la sauvegarde dans la base de données", details: dbError },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Connexion WhatsApp configurée avec succès.",
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
    });
  } catch (error: any) {
    console.error("Unexpected error in embedded-signup API:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue", details: error.message },
      { status: 500 }
    );
  }
}
