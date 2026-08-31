import { supabaseServer } from "@/lib/supabase/server";

interface Credentials {
  token: string;
  phoneNumberId: string;
  wabaId: string;
}

/**
 * Fetch WhatsApp credentials dynamically from DB or environment variables.
 */
async function getCredentials(businessId?: string): Promise<Credentials> {
  let token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  let wabaId = "";

  if (businessId) {
    try {
      const { data: business, error } = await supabaseServer
        .from("businesses")
        .select("whatsapp_access_token, whatsapp_phone_number_id, whatsapp_waba_id")
        .eq("id", businessId)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching WhatsApp credentials for business ${businessId}:`, error);
      } else if (business) {
        if (business.whatsapp_access_token) {
          token = business.whatsapp_access_token;
        }
        if (business.whatsapp_phone_number_id) {
          phoneNumberId = business.whatsapp_phone_number_id;
        }
        if (business.whatsapp_waba_id) {
          wabaId = business.whatsapp_waba_id;
        }
      }
    } catch (err) {
      console.error(`Unexpected error fetching WhatsApp credentials for business ${businessId}:`, err);
    }
  }

  return { token, phoneNumberId, wabaId };
}

/**
 * Helper to call Evolution API.
 */
async function sendEvolutionRequest(instance: string, apiKey: string, path: string, body: any): Promise<boolean> {
  const apiUrl = process.env.EVOLUTION_API_URL || "http://localhost:8080";
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error(`Evolution API error sending request to ${path}:`, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Evolution API fetch failed for ${path}:`, err);
    return false;
  }
}

/**
 * Helper to send an outgoing text message.
 */
export async function sendWhatsAppMessage(to: string, text: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendText/${phoneNumberId}`, {
      number: cleanTo,
      textMessage: { text }
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppMessage:", error);
    return false;
  }
}

/**
 * Helper to send an outgoing image message.
 */
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendMedia/${phoneNumberId}`, {
      number: cleanTo,
      mediaMessage: {
        mediatype: "image",
        media: imageUrl,
        caption: caption || ""
      }
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption || "",
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppImage:", error);
    return false;
  }
}

/**
 * Helper to send a typing indicator.
 */
export async function sendWhatsAppTypingIndicator(to: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/chat/updatePresence/${phoneNumberId}`, {
      number: cleanTo,
      delay: 1200,
      presence: "composing"
    });
  }

  if (!token || !phoneNumberId) {
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        sender_action: "typing_on"
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppTypingIndicator:", error);
    return false;
  }
}

/**
 * Helper to send an outgoing video message.
 */
export async function sendWhatsAppVideo(to: string, videoUrl: string, caption?: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendMedia/${phoneNumberId}`, {
      number: cleanTo,
      mediaMessage: {
        mediatype: "video",
        media: videoUrl,
        caption: caption || ""
      }
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "video",
        video: {
          link: videoUrl,
          caption: caption || "",
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppVideo:", error);
    return false;
  }
}

/**
 * Helper to send an outgoing audio message.
 */
export async function sendWhatsAppAudio(to: string, audioUrl: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendMedia/${phoneNumberId}`, {
      number: cleanTo,
      mediaMessage: {
        mediatype: "audio",
        media: audioUrl
      }
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "audio",
        audio: {
          link: audioUrl,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppAudio:", error);
    return false;
  }
}

/**
 * Helper to send an outgoing document message.
 */
export async function sendWhatsAppDocument(to: string, documentUrl: string, filename?: string, caption?: string, businessId?: string): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendMedia/${phoneNumberId}`, {
      number: cleanTo,
      mediaMessage: {
        mediatype: "document",
        media: documentUrl,
        fileName: filename || "document.pdf",
        caption: caption || ""
      }
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "document",
        document: {
          link: documentUrl,
          filename: filename || "document.pdf",
          caption: caption || ""
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppDocument:", error);
    return false;
  }
}

/**
 * Helper to send an interactive button message.
 */
export async function sendWhatsAppInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  businessId?: string
): Promise<boolean> {
  const { token, phoneNumberId, wabaId } = await getCredentials(businessId);
  const cleanTo = to.replace(/[^0-9]/g, "");

  if (wabaId === "evolution") {
    return sendEvolutionRequest(phoneNumberId, token, `/message/sendButtons/${phoneNumberId}`, {
      number: cleanTo,
      title: "Notification",
      description: bodyText,
      footer: "Le Closeur",
      buttons: buttons.map((b) => ({
        buttonId: b.id,
        buttonText: {
          displayText: b.title
        },
        type: 1
      }))
    });
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing.");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: bodyText
          },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: {
                id: b.id,
                title: b.title
              }
            }))
          }
        }
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error in sendWhatsAppInteractiveButtons:", error);
    return false;
  }
}
