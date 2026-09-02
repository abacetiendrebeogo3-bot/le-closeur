import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") || req.nextUrl.origin || "https://le-closeur.vercel.app";
    const webhookUrl = `${origin}/api/webhooks/whatsapp`;

    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";

    console.log(`Syncing Evolution API webhooks to target URL: ${webhookUrl}`);

    // Fetch instances list from Railway Evolution API
    const instancesRes = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { "apikey": apiKey }
    });
    const instancesData = await instancesRes.json();

    const results: any[] = [];
    const instancesList = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);

    for (const inst of instancesList) {
      const name = inst.instanceName || inst.name || inst.id;
      if (!name) continue;

      try {
        const setRes = await fetch(`${apiUrl}/webhook/set/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            webhook: {
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
            }
          })
        });

        const setResponseData = await setRes.json().catch(() => ({}));
        results.push({
          instanceName: name,
          success: setRes.ok,
          webhookUrl,
          response: setResponseData
        });
      } catch (err: any) {
        results.push({
          instanceName: name,
          success: false,
          error: err.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      webhookUrl,
      syncedInstancesCount: results.length,
      results
    });
  } catch (error: any) {
    console.error("Error in sync-webhooks route:", error);
    return NextResponse.json({ error: error.message || "Failed to sync webhooks" }, { status: 500 });
  }
}
