import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppAudio } from "@/lib/whatsapp/send";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { to, text, mediaUrl, mediaType } = await req.json();

    if (!to) {
      return NextResponse.json({ error: "Missing destination 'to' parameter" }, { status: 400 });
    }

    if (!text && !mediaUrl) {
      return NextResponse.json({ error: "Missing 'text' or 'mediaUrl' parameter" }, { status: 400 });
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
    let success = false;

    if (mediaUrl) {
      if (mediaType === "image") {
        success = await sendWhatsAppImage(to, mediaUrl, text || "", resolvedBusinessId);
      } else if (mediaType === "video") {
        success = await sendWhatsAppVideo(to, mediaUrl, text || "", resolvedBusinessId);
      } else if (mediaType === "audio") {
        success = await sendWhatsAppAudio(to, mediaUrl, resolvedBusinessId);
      } else {
        // Fallback to sending mediaUrl as text
        success = await sendWhatsAppMessage(to, `[Fichier] ${mediaUrl}\n${text || ""}`.trim(), resolvedBusinessId);
      }
    } else if (text) {
      success = await sendWhatsAppMessage(to, text, resolvedBusinessId);
    }

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
