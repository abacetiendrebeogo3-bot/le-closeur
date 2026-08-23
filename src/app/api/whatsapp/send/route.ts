import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppAudio, sendWhatsAppDocument } from "@/lib/whatsapp/send";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { to, text, mediaUrl, mediaType, conversationId } = await req.json();

    if (!to) {
      return NextResponse.json({ error: "Missing destination 'to' parameter" }, { status: 400 });
    }

    if (!text && !mediaUrl) {
      return NextResponse.json({ error: "Missing 'text' or 'mediaUrl' parameter" }, { status: 400 });
    }

    // Resolve business_id from supabase based on the destination phone number
    const { data: conv, error: convErr } = await supabaseServer
      .from("conversations")
      .select("id, business_id")
      .eq("customer_phone", to)
      .limit(1)
      .maybeSingle();

    if (convErr) {
      console.error("Error looking up business ID from conversation:", convErr);
    }

    const resolvedBusinessId = conv?.business_id;
    const resolvedConvId = conversationId || conv?.id;
    let success = false;

    if (mediaUrl) {
      if (mediaType === "image") {
        success = await sendWhatsAppImage(to, mediaUrl, text || "", resolvedBusinessId);
      } else if (mediaType === "video") {
        success = await sendWhatsAppVideo(to, mediaUrl, text || "", resolvedBusinessId);
      } else if (mediaType === "audio") {
        success = await sendWhatsAppAudio(to, mediaUrl, resolvedBusinessId);
        if (!success) {
          console.warn("Failed to send audio natively via Meta API. Falling back to document presentation...");
          success = await sendWhatsAppDocument(to, mediaUrl, "note-vocale.ogg", "Note vocale", resolvedBusinessId);
        }
      } else {
        // Fallback to sending mediaUrl as text
        success = await sendWhatsAppMessage(to, `[Fichier] ${mediaUrl}\n${text || ""}`.trim(), resolvedBusinessId);
      }
    } else if (text) {
      success = await sendWhatsAppMessage(to, text, resolvedBusinessId);
    }

    let insertedMessage = null;

    if (success && resolvedConvId) {
      let dbText = text || "";
      if (mediaUrl) {
        let prefix = "Fichier";
        if (mediaType === "image") prefix = "Image";
        else if (mediaType === "video") prefix = "Video";
        else if (mediaType === "audio") prefix = "Audio";
        dbText = `[${prefix}: ${mediaUrl}]` + (text ? ` ${text}` : "");
      }

      const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const { data: newMsg, error: insertErr } = await supabaseServer
        .from("messages")
        .insert({
          conversation_id: resolvedConvId,
          sender: "human",
          text: dbText,
          time: timeStr
        })
        .select()
        .maybeSingle();

      if (insertErr) {
        console.error("Error inserting manual message on server:", insertErr);
      } else {
        insertedMessage = newMsg;
      }
    }

    if (success) {
      return NextResponse.json({ success: true, message: insertedMessage });
    } else {
      return NextResponse.json({ error: "Failed to send WhatsApp message via Meta API" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in sending manual WhatsApp message API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
