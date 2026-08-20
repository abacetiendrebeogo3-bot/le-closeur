import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { code, businessId, redirectUri } = await req.json();

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
    console.log(`Saving WhatsApp configuration to Supabase for business ${businessId}...`);
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
