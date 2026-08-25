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
    const appSecret = process.env.WHATSAPP_APP_SECRET; // Reuse same app secret

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: "Configuration Meta manquante sur le serveur (NEXT_PUBLIC_META_APP_ID ou WHATSAPP_APP_SECRET)" },
        { status: 500 }
      );
    }

    // 1. Exchange auth code for user access token
    const tokenExchangeUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenExchangeUrl.searchParams.set("client_id", appId);
    tokenExchangeUrl.searchParams.set("client_secret", appSecret);
    tokenExchangeUrl.searchParams.set("code", code);
    tokenExchangeUrl.searchParams.set("redirect_uri", redirectUri || "");

    const tokenRes = await fetch(tokenExchangeUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: "Échec de l'échange du code d'autorisation", details: tokenData },
        { status: 400 }
      );
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    if (!longLivedRes.ok || !longLivedData.access_token) {
      return NextResponse.json(
        { error: "Échec de la génération du token longue durée", details: longLivedData },
        { status: 400 }
      );
    }

    const longLivedToken = longLivedData.access_token;

    // 3. Fetch Ad Accounts for the user to auto-detect one
    const accountsUrl = `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,account_status&access_token=${longLivedToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    let adAccountId = "";
    if (accountsRes.ok && accountsData.data && accountsData.data.length > 0) {
      // Find first active account or any account
      const activeAccount = accountsData.data.find((acc: any) => acc.account_status === 1) || accountsData.data[0];
      adAccountId = activeAccount.account_id;
    }

    // 4. Update the business record in DB
    const { error: updateErr } = await supabaseServer
      .from("businesses")
      .update({
        meta_ads_access_token: longLivedToken,
        meta_ads_account_id: adAccountId
      })
      .eq("id", businessId);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      adAccountId,
      message: "Compte publicitaire connecté avec succès !"
    });
  } catch (err: any) {
    console.error("Error in meta ads connect API:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
