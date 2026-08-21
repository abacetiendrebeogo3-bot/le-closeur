import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { to, text } = await req.json();

    if (!to || !text) {
      return NextResponse.json({ error: "Missing to or text parameter" }, { status: 400 });
    }

    // Resolve business_id from supabase based on the destination phone number
    const { data: conv, error: convErr } = await supabaseServer
      .from("conversations")
      .select("business_id")
      .eq("customer_phone", to)
      .limit(1)
      .maybeSingle();

    if (convErr) {
      console.error("Error looking up business ID from conversation:", convErr);
    }

    const resolvedBusinessId = conv?.business_id;
    const success = await sendWhatsAppMessage(to, text, resolvedBusinessId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Failed to send WhatsApp message via Meta API" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in sending manual WhatsApp message API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
