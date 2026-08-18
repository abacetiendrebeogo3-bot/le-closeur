/**
 * Helper to send an outgoing text message to a WhatsApp number using the WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("WhatsApp credentials missing in environment variables.");
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
