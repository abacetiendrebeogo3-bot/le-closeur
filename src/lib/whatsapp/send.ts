import { supabaseServer } from "@/lib/supabase/server";

/**
 * Helper to send an outgoing text message to a WhatsApp number using the WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage(to: string, text: string, businessId?: string): Promise<boolean> {
  let token = process.env.WHATSAPP_ACCESS_TOKEN;
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (businessId) {
    try {
      const { data: business, error } = await supabaseServer
        .from("businesses")
        .select("whatsapp_access_token, whatsapp_phone_number_id")
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
      }
    } catch (err) {
      console.error(`Unexpected error fetching WhatsApp credentials for business ${businessId}:`, err);
    }
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing (neither in DB for business nor in environment variables).");
    return false;
  }

  // Clean phone number (remove +, spaces, dashes, etc.)
  const cleanTo = to.replace(/[^0-9]/g, "");

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

    const data = await response.json();
    if (!response.ok) {
      console.error("Error sending WhatsApp message via Meta API:", data);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in sendWhatsAppMessage:", error);
    return false;
  }
}

/**
 * Helper to send an outgoing image message to a WhatsApp number using the WhatsApp Cloud API.
 */
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string, businessId?: string): Promise<boolean> {
  let token = process.env.WHATSAPP_ACCESS_TOKEN;
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (businessId) {
    try {
      const { data: business, error } = await supabaseServer
        .from("businesses")
        .select("whatsapp_access_token, whatsapp_phone_number_id")
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
      }
    } catch (err) {
      console.error(`Unexpected error fetching WhatsApp credentials for business ${businessId}:`, err);
    }
  }

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing (neither in DB for business nor in environment variables).");
    return false;
  }

  const cleanTo = to.replace(/[^0-9]/g, "");

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

    const data = await response.json();
    if (!response.ok) {
      console.error("Error sending WhatsApp image via Meta API:", data);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in sendWhatsAppImage:", error);
    return false;
  }
}

/**
 * Helper to send a typing indicator to a WhatsApp number.
 */
export async function sendWhatsAppTypingIndicator(to: string, businessId?: string): Promise<boolean> {
  let token = process.env.WHATSAPP_ACCESS_TOKEN;
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (businessId) {
    try {
      const { data: business, error } = await supabaseServer
        .from("businesses")
        .select("whatsapp_access_token, whatsapp_phone_number_id")
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
      }
    } catch (err) {
      console.error(`Unexpected error fetching WhatsApp credentials for business ${businessId}:`, err);
    }
  }

  if (!token || !phoneNumberId) {
    return false;
  }

  const cleanTo = to.replace(/[^0-9]/g, "");

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
