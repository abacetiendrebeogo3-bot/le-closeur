import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instanceName = searchParams.get("instanceName");

    if (!instanceName) {
      return NextResponse.json({ error: "instanceName param missing" }, { status: 400 });
    }

    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";

    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      headers: { "apikey": apiKey }
    });

    if (!res.ok) {
      return NextResponse.json({ state: "close", connected: false });
    }

    const data = await res.json();
    const state = data.instance?.state || data.state || "close";
    const connected = state === "open";

    return NextResponse.json({
      state,
      connected,
      details: data
    });
  } catch (error: any) {
    return NextResponse.json({ state: "close", connected: false, error: error.message });
  }
}
