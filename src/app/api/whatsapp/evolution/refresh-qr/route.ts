import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceName = searchParams.get("instanceName");
    const phoneNumber = searchParams.get("phoneNumber");

    if (!instanceName) {
      return NextResponse.json({ error: "instanceName param missing" }, { status: 400 });
    }

    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";

    const cleanPhone = phoneNumber ? String(phoneNumber).replace(/[^0-9]/g, "") : "";
    const connectPath = cleanPhone ? `/instance/connect/${instanceName}?number=${cleanPhone}` : `/instance/connect/${instanceName}`;

    const res = await fetch(`${apiUrl}${connectPath}`, {
      headers: { "apikey": apiKey }
    });

    const data = await res.json();
    const qrcode = data.base64 || data.qrcode?.base64 || "";
    const pairingCode = data.pairingCode || data.qrcode?.pairingCode || "";

    return NextResponse.json({
      success: true,
      qrcode,
      pairingCode,
      details: data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
