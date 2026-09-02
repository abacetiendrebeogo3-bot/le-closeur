import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-8adef.up.railway.app";
    const apiKey = process.env.EVOLUTION_API_KEY || "8d4b022c7704fa18af3430e1bc12d90a2fa448f2329ff75157e2feb6f568a7b2";
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://le-closeur-8vqe.vercel.app"}/api/webhooks/whatsapp`;

    const { data: numbers, error: fetchErr } = await supabaseServer
      .from("business_phone_numbers")
      .select("phone_number_id, label")
      .eq("waba_id", "evolution");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const results: any[] = [];

    for (const num of numbers || []) {
      const instanceName = num.phone_number_id;
      if (!instanceName) continue;

      try {
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
        const data = await res.json().catch(() => ({}));
        results.push({ instanceName, label: num.label, success: res.ok, data });
      } catch (err: any) {
        results.push({ instanceName, label: num.label, success: false, error: err.message });
      }
    }

    return NextResponse.json({ success: true, webhookUrl, count: results.length, results });
  } catch (error: any) {
    console.error("Error in fix-all-webhooks route:", error);
    return NextResponse.json({ error: error.message || "Failed to fix all webhooks" }, { status: 500 });
  }
}
