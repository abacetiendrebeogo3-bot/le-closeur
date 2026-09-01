import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { businessId } = await req.json();
    const defaultToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

    const results: any[] = [];

    // 1. Fetch primary business WABA
    if (businessId) {
      const { data: bus } = await supabaseServer
        .from("businesses")
        .select("whatsapp_waba_id, whatsapp_access_token")
        .eq("id", businessId)
        .maybeSingle();

      if (bus && bus.whatsapp_waba_id) {
        const token = bus.whatsapp_access_token || defaultToken;
        if (token) {
          const res = await fetch(`https://graph.facebook.com/v19.0/${bus.whatsapp_waba_id}/subscribed_apps`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          const resData = await res.json();
          results.push({
            type: "primary",
            waba_id: bus.whatsapp_waba_id,
            success: res.ok && resData.success,
            details: resData
          });
        }
      }
    }

    // 2. Fetch all secondary numbers in business_phone_numbers
    const { data: secNumbers } = await supabaseServer
      .from("business_phone_numbers")
      .select("id, waba_id, access_token, label, phone_number_id");

    if (secNumbers && secNumbers.length > 0) {
      for (const sec of secNumbers) {
        const targetWaba = sec.waba_id;
        const targetToken = sec.access_token || defaultToken;

        if (targetWaba && targetToken) {
          try {
            const res = await fetch(`https://graph.facebook.com/v19.0/${targetWaba}/subscribed_apps`, {
              method: "POST",
              headers: { Authorization: `Bearer ${targetToken}` }
            });
            const resData = await res.json();
            results.push({
              type: "secondary",
              label: sec.label,
              waba_id: targetWaba,
              success: res.ok && resData.success,
              details: resData
            });
          } catch (err: any) {
            results.push({
              type: "secondary",
              label: sec.label,
              waba_id: targetWaba,
              success: false,
              error: err.message
            });
          }
        } else {
          results.push({
            type: "secondary",
            label: sec.label,
            waba_id: targetWaba || "N/A",
            success: false,
            note: "Missing WABA ID or Access Token for this secondary number. Enter WABA ID & Token in settings."
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook subscription process executed",
      results
    });
  } catch (error: any) {
    console.error("Error in subscribe-webhooks route:", error);
    return NextResponse.json({ error: error.message || "Failed to subscribe webhooks" }, { status: 500 });
  }
}
