import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { instanceName } = await req.json();
    if (!instanceName) {
      return NextResponse.json({ error: "instanceName requis" }, { status: 400 });
    }

    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://le-closeur-8vqe.vercel.app"}/api/webhooks/whatsapp`;

    const res = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
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
          "QRCODE_UPDATED",
        ],
      }),
    });
    const data = await res.json();

    return NextResponse.json({ success: res.ok, webhookUrl, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fix webhook" }, { status: 500 });
  }
}
