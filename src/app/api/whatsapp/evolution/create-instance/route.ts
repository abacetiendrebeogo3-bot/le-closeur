import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { businessId, label } = await req.json();

    const cleanLabel = (label || "Commerciale 1").trim();
    const sanitizedLabel = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
    const instanceName = `${sanitizedLabel}_${Date.now().toString().slice(-4)}`;

    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";

    console.log(`Creating Evolution API instance '${instanceName}' on ${apiUrl}...`);

    // 1. Create Instance
    const createRes = await fetch(`${apiUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok && !createData.instance) {
      console.error("Failed to create Evolution instance:", createData);
      return NextResponse.json(
        { error: "Échec de création de l'instance Evolution API", details: createData },
        { status: 400 }
      );
    }

    // 2. Configure Webhooks for this instance
    const origin = req.headers.get("origin") || req.nextUrl.origin || "https://le-closeur.vercel.app";
    const webhookUrl = `${origin}/api/webhooks/whatsapp`;

    try {
      await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED"
          ]
        })
      });
      console.log(`Webhook configured for instance ${instanceName}: ${webhookUrl}`);
    } catch (whErr) {
      console.warn("Failed to set webhook on instance:", whErr);
    }

    // 3. Connect & Fetch QR Code
    let qrcodeBase64 = "";
    try {
      const connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: { "apikey": apiKey }
      });
      const connectData = await connectRes.json();
      qrcodeBase64 = connectData.base64 || connectData.qrcode?.base64 || createData.qrcode?.base64 || "";
    } catch (qrErr) {
      console.warn("Failed to fetch QR code from connect endpoint:", qrErr);
      qrcodeBase64 = createData.qrcode?.base64 || "";
    }

    // 4. Save to business_phone_numbers DB table
    const targetBusinessId = businessId || "00000000-0000-0000-0000-000000000001";
    const { data: newSec, error: dbErr } = await supabaseServer
      .from("business_phone_numbers")
      .insert({
        business_id: targetBusinessId,
        phone_number_id: instanceName,
        whatsapp_phone_number_id: instanceName,
        waba_id: "evolution",
        access_token: apiKey,
        conversation_mode: "human_coexistence",
        label: cleanLabel
      })
      .select()
      .single();

    if (dbErr) {
      console.error("DB insert error for secondary phone number:", dbErr);
    }

    return NextResponse.json({
      success: true,
      instanceName,
      qrcode: qrcodeBase64,
      label: cleanLabel,
      record: newSec
    });
  } catch (error: any) {
    console.error("Error in Evolution create-instance route:", error);
    return NextResponse.json({ error: error.message || "Failed to create Evolution instance" }, { status: 500 });
  }
}
