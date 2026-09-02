import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppTypingIndicator, sendWhatsAppInteractiveButtons } from "@/lib/whatsapp/send";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import crypto from "crypto";

const DEFAULT_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";

// Helper to save message safely to DB (preventing base64 or long messages from bloating DB / client)
async function saveMessageSafe(
  conversationId: string,
  sender: "ai" | "customer" | "system",
  text: string,
  time: string,
  customerPhone?: string,
  businessId?: string
) {
  let textToSave = text || "";
  const isTooLong = textToSave.length > 2000;
  const hasBase64 = textToSave.toLowerCase().includes("base64") || textToSave.includes("data:");
  
  if (isTooLong || hasBase64) {
    console.error(`[CRITICAL] Message safety check triggered! Length: ${textToSave.length}, Contains base64: ${hasBase64}. Blocked contents.`);
    textToSave = "Un instant, je vous transmets ça 🙏";
    
    if (sender === "ai" && customerPhone && businessId) {
      try {
        await sendWhatsAppMessage(customerPhone, textToSave, businessId);
      } catch (err) {
        console.error("Failed to send fallback message on WhatsApp:", err);
      }
    }
  }

  return await supabaseServer.from("messages").insert({
    conversation_id: conversationId,
    sender,
    text: textToSave,
    time
  });
}


// Verify Signature from Meta (X-Hub-Signature-256)
function verifySignature(payload: string, signatureHeader: string | null): boolean {
  console.log("verifySignature called. Header:", signatureHeader);
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn("verifySignature: WHATSAPP_APP_SECRET is not set. Bypassing strict signature validation for compatibility.");
    return true;
  }
  if (!signatureHeader) {
    console.warn("verifySignature: Missing x-hub-signature-256 header. Bypassing check for compatibility.");
    return true;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    console.warn("verifySignature: Invalid signature format");
    return true;
  }

  const signature = parts[1];
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  console.log("verifySignature: Signature validation result =", isValid);
  return isValid;
}

// GET Handler: Webhook verification
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log("GET Webhook Verification query params:", { mode, token, challenge });

    if (mode === "subscribe" && token) {
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
      console.log("Expected Verify Token:", verifyToken);
      if (token === verifyToken) {
        console.log("Webhook verified successfully!");
        return new NextResponse(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      } else {
        console.warn("Verification token mismatch.");
        return NextResponse.json({ error: "Forbidden: verify token mismatch" }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in webhook verification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST Handler: Process incoming WhatsApp messages
export async function POST(req: NextRequest) {
  console.log("POST /api/webhooks/whatsapp called");
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    console.log("Incoming Webhook body preview:", rawBody.substring(0, 500));

    const isEvolution = rawBody.includes('"event"') && rawBody.includes('"instance"') && rawBody.includes('"data"');

    // Verify signature ONLY for Meta webhooks
    if (!isEvolution && !verifySignature(rawBody, signatureHeader)) {
      console.warn("Signature verification failed.");
      return NextResponse.json({ error: "Unauthorized signature validation failed" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.log("Parsed Webhook payload:", JSON.stringify(payload, null, 2));

    let customerPhone = "";
    let contactName = "";
    let messageId = "";
    let messageText = "";
    let isAudio = false;
    let audioId = "";
    let isImage = false;
    let imageId = "";
    let coexistenceMode = false;
    let businessId = DEFAULT_BUSINESS_ID;
    let isCourierInteractive = false;
    let courierStatus = "";
    let courierOrderId = "";
    let matchedCourier: any = null;
    let fromMe = false;
    let evolutionInstance = "";
    let messageObject: any = null;
    let assignedLabel = "Agent IA";

    if (isEvolution) {
      const eventName = String(payload.event || "").toLowerCase();
      const isMessageEvent = eventName.includes("message") || eventName.includes("upsert");

      if (!isMessageEvent) {
        return NextResponse.json({ status: "ignored_evolution_event" });
      }

      let msgData = payload.data;
      if (Array.isArray(msgData)) {
        msgData = msgData[0];
      }
      if (!msgData || !msgData.key) {
        return NextResponse.json({ status: "ignored_no_key" });
      }

      const remoteJid = msgData.key.remoteJid || "";
      if (remoteJid.includes("@g.us")) {
        return NextResponse.json({ status: "ignored_group_chat" });
      }

      customerPhone = remoteJid.split("@")[0];
      contactName = msgData.pushName || customerPhone;
      messageId = msgData.key.id;
      fromMe = !!msgData.key.fromMe;
      evolutionInstance = payload.instance || payload.sender || "";

      if (msgData.message?.conversation) {
        messageText = msgData.message.conversation;
      } else if (msgData.message?.extendedTextMessage?.text) {
        messageText = msgData.message.extendedTextMessage.text;
      } else if (msgData.messageType === "imageMessage" || msgData.message?.imageMessage) {
        messageText = msgData.message?.imageMessage?.caption || "[Image]";
        isImage = true;
      } else if (msgData.messageType === "audioMessage" || msgData.message?.audioMessage) {
        messageText = "[Vocale]";
        isAudio = true;
      }

      // Resolve businessId, coexistenceMode, and assignedLabel from instance
      const cleanInstance = String(evolutionInstance).trim();
      const { data: customPhone } = await supabaseServer
        .from("business_phone_numbers")
        .select("business_id, conversation_mode, label, phone_number_id")
        .or(`phone_number_id.eq.${cleanInstance},whatsapp_phone_number_id.eq.${cleanInstance},label.eq.${cleanInstance}`)
        .maybeSingle();

      if (customPhone) {
        businessId = customPhone.business_id;
        coexistenceMode = customPhone.conversation_mode === "human_coexistence";
        assignedLabel = customPhone.label || "Commerciale 1";
      } else {
        const { data: allSecs } = await supabaseServer
          .from("business_phone_numbers")
          .select("business_id, conversation_mode, label, phone_number_id");
        if (allSecs && allSecs.length > 0) {
          const matched = allSecs.find((s: any) => cleanInstance.toLowerCase().includes(String(s.label || "").toLowerCase()) || String(s.phone_number_id || "").includes(cleanInstance));
          if (matched) {
            businessId = matched.business_id;
            coexistenceMode = matched.conversation_mode === "human_coexistence";
            assignedLabel = matched.label || "Commerciale 1";
          }
        }

        if (!assignedLabel || assignedLabel === "Agent IA") {
          const { data: bus } = await supabaseServer
            .from("businesses")
            .select("id")
            .eq("whatsapp_phone_number_id", cleanInstance)
            .maybeSingle();
          if (bus) {
            businessId = bus.id;
          }
        }
      }
    } else {
      // Meta Webhook logic
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      messageObject = value?.messages?.[0];

      if (!messageObject) {
        return NextResponse.json({ status: "ignored_non_message_payload" });
      }

      customerPhone = messageObject.from;
      contactName = value?.contacts?.[0]?.profile?.name || customerPhone;
      messageId = messageObject.id;

      if (messageObject.type === "text") {
        messageText = messageObject.text?.body || "";
      } else if (messageObject.type === "interactive" && messageObject.interactive?.type === "button_reply") {
        const cleanFrom = customerPhone.replace(/[^0-9]/g, "");
        const { data: couriersList } = await supabaseServer.from("couriers").select("*");
        matchedCourier = (couriersList || []).find(c => c.phone?.replace(/[^0-9]/g, "") === cleanFrom);

        if (matchedCourier) {
          isCourierInteractive = true;
          const buttonId = messageObject.interactive.button_reply?.id || "";
          if (buttonId.startsWith("livre_")) {
            courierStatus = "delivered";
            courierOrderId = buttonId.substring("livre_".length);
          } else if (buttonId.startsWith("annule_")) {
            courierStatus = "cancelled";
            courierOrderId = buttonId.substring("annule_".length);
          } else if (buttonId.startsWith("reprogramme_")) {
            courierStatus = "reprogramme";
            courierOrderId = buttonId.substring("reprogramme_".length);
          }
        }
      } else if (messageObject.type === "audio") {
        isAudio = true;
        audioId = messageObject.audio?.id;
      } else if (messageObject.type === "image") {
        isImage = true;
        imageId = messageObject.image?.id;
      }

      // Resolve businessId and coexistenceMode from Meta phone_number_id, display_phone_number, or WABA ID
      const phoneNumberId = value?.metadata?.phone_number_id;
      const displayPhone = value?.metadata?.display_phone_number?.replace(/[^0-9]/g, "");
      const wabaIdFromPayload = entry?.id;

      if (phoneNumberId || displayPhone || wabaIdFromPayload) {
        const cleanPhoneId = String(phoneNumberId || "").trim();
        const cleanWabaId = String(wabaIdFromPayload || "").trim();

        const { data: customPhone } = await supabaseServer
          .from("business_phone_numbers")
          .select("business_id, conversation_mode, label, phone_number_id, phone_number, waba_id")
          .or(`waba_id.eq.${cleanWabaId},phone_number_id.eq.${cleanPhoneId},whatsapp_phone_number_id.eq.${cleanPhoneId},phone_number.eq.${cleanPhoneId}${displayPhone ? `,phone_number.eq.${displayPhone}` : ""}`)
          .maybeSingle();

        if (customPhone) {
          businessId = customPhone.business_id;
          coexistenceMode = customPhone.conversation_mode === "human_coexistence";
          assignedLabel = customPhone.label || "Commerciale 1";
          console.log(`Resolved from business_phone_numbers: business_id=${businessId}, label=${assignedLabel}`);
        } else {
          // Fallback search across all registered secondary numbers
          const { data: allSecs } = await supabaseServer
            .from("business_phone_numbers")
            .select("business_id, conversation_mode, label, phone_number_id, phone_number");

          if (allSecs && allSecs.length > 0) {
            const matched = allSecs.find((sec: any) => {
              const secId = String(sec.phone_number_id || "").trim();
              const secNum = String(sec.phone_number || "").replace(/[^0-9]/g, "");
              return (cleanPhoneId && secId === cleanPhoneId) || (displayPhone && secNum.length > 5 && (secNum.includes(displayPhone) || displayPhone.includes(secNum)));
            });

            if (matched) {
              businessId = matched.business_id;
              coexistenceMode = matched.conversation_mode === "human_coexistence";
              assignedLabel = matched.label || "Commerciale 1";
              console.log(`Resolved from fallback search: business_id=${businessId}, label=${assignedLabel}`);
            }
          }

          if (!assignedLabel || assignedLabel === "Agent IA") {
            const { data: bus } = await supabaseServer
              .from("businesses")
              .select("id")
              .eq("whatsapp_phone_number_id", cleanPhoneId)
              .maybeSingle();
            if (bus) {
              businessId = bus.id;
              console.log(`Resolved from primary businesses table: business_id=${businessId}`);
            }
          }
        }
      }
    }

    if (isCourierInteractive && matchedCourier && courierOrderId && courierStatus) {
      if (courierStatus === "reprogramme") {
        const { data: orderData } = await supabaseServer
          .from("orders")
          .select("customer_address, chat_id")
          .eq("id", courierOrderId)
          .maybeSingle();

        let newAddress = orderData?.customer_address || "";
        if (newAddress && !newAddress.includes("(Reprogrammé)")) {
          newAddress += " (Reprogrammé)";
        }

        await supabaseServer
          .from("orders")
          .update({
            status: "sent_to_courier",
            customer_address: newAddress
          })
          .eq("id", courierOrderId);

        if (orderData?.chat_id) {
          const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          await saveMessageSafe(
            String(orderData.chat_id),
            "system",
            `🔄 [Livreur ${matchedCourier.name}] Livraison reprogrammée.`,
            timeStr,
            customerPhone,
            matchedCourier.business_id
          );
        }
      } else {
        const { data: orderData } = await supabaseServer
          .from("orders")
          .select("chat_id")
          .eq("id", courierOrderId)
          .maybeSingle();

        await supabaseServer
          .from("orders")
          .update({ status: courierStatus })
          .eq("id", courierOrderId);

        if (orderData?.chat_id) {
          const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          const statusLabel = courierStatus === "delivered" ? "✅ Livrée" : "❌ Annulée";
          await saveMessageSafe(
            String(orderData.chat_id),
            "system",
            `📦 [Livreur ${matchedCourier.name}] Commande mise à jour : ${statusLabel}.`,
            timeStr,
            customerPhone,
            matchedCourier.business_id
          );
        }
      }

      const replyText = "C'est noté, merci ! 🙏";
      await sendWhatsAppMessage(customerPhone, replyText, matchedCourier.business_id);

      return NextResponse.json({ status: "success", message: "Courier button reply processed." });
    }

    if (messageId) {
      const { data: existingMsg } = await supabaseServer
        .from("messages")
        .select("id")
        .like("text", `[WA_MSG_ID: ${messageId}]%`)
        .limit(1);

      if (existingMsg && existingMsg.length > 0) {
        console.log(`[DEDUPLICATION] Message ${messageId} already processed. Ignoring.`);
        return NextResponse.json({ status: "success", message: "Duplicate ignored." });
      }
    }

    // Define background processing promise
    const handleIncomingMessageBackground = async () => {
      try {

        // Fetch Business Config
        const { data: business } = await supabaseServer
          .from("businesses")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();

        const identity = business?.agent_identity || "Tu es un agent d'aide à la vente.";
        const salesRules = business?.agent_sales_rules || "";
        const escalationRules = business?.agent_escalation_rules || "";
        const tone = business?.agent_tone || "Chaleureux et Respectueux";
        const token = business?.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN || "";

        // 1. Ensure customer exists in Supabase
        const { data: customer, error: customerFetchErr } = await supabaseServer
          .from("customers")
          .select("*")
          .eq("phone", customerPhone)
          .maybeSingle();

        let lastOrderAddress = "";
        let lastOrderCustomerName = "";
        let isReturningCustomer = false;

        if (customer) {
          const { data: lastOrders } = await supabaseServer
            .from("orders")
            .select("customer, customer_address")
            .eq("customer_phone", customerPhone)
            .order("created_at", { ascending: false })
            .limit(1);

          if (lastOrders && lastOrders.length > 0) {
            lastOrderAddress = lastOrders[0].customer_address;
            lastOrderCustomerName = lastOrders[0].customer;
            isReturningCustomer = true;
          }
        }

        if (customerFetchErr) {
          console.error("Error checking customer in Supabase:", customerFetchErr);
        }

        let customerId = customer?.id;

        if (!customer) {
          // Create new customer
          const newCustId = `CUST-WA-${Math.floor(Math.random() * 90000 + 10000)}`;
          const { data: newCust, error: createCustErr } = await supabaseServer
            .from("customers")
            .insert({
              id: newCustId,
              business_id: businessId,
              name: contactName,
              phone: customerPhone,
              first_contact: new Date().toLocaleDateString("fr-FR"),
              tags: ["prospect"],
            })
            .select()
            .single();

          if (createCustErr) {
            console.error("Error creating customer in Supabase:", createCustErr);
            customerId = newCustId;
          } else {
            customerId = newCust?.id;
          }
        }

        // Helper to update tags dynamically
        const updateCustomerTag = async (newTag: string) => {
          try {
            if (!customerId) return;
            const { data: cust } = await supabaseServer
              .from("customers")
              .select("tags")
              .eq("id", customerId)
              .maybeSingle();

            if (cust) {
              const tagsList = cust.tags || [];
              if (!tagsList.includes(newTag)) {
                await supabaseServer
                  .from("customers")
                  .update({ tags: [...tagsList, newTag] })
                  .eq("id", customerId);
              }
            }
          } catch (err) {
            console.error("Error updating customer tag:", err);
          }
        };

        // 2. Find or create conversation
        let { data: conversation, error: convFetchErr } = await supabaseServer
          .from("conversations")
          .select("*")
          .eq("customer_phone", customerPhone)
          .eq("business_id", businessId)
          .maybeSingle();

        if (convFetchErr) {
          console.error("Error checking conversation in Supabase:", convFetchErr);
        }

        let conversationId = conversation?.id;

        if (!conversation) {
          const avatarLetters = contactName.substring(0, 2).toUpperCase();
          const initialStatus = coexistenceMode ? "human_takeover" : "ai_active";
          const { data: newConv, error: createConvErr } = await supabaseServer
            .from("conversations")
            .insert({
              business_id: businessId,
              customer_name: contactName,
              customer_phone: customerPhone,
              status: initialStatus,
              avatar: avatarLetters,
              unread: true,
              assigned_label: assignedLabel,
            })
            .select()
            .single();

          if (createConvErr) {
            console.error("Error creating conversation in Supabase:", createConvErr);
            return;
          }

          conversation = newConv;
          conversationId = newConv.id;
        } else {
          // Update conversation unread status & assigned_label
          await supabaseServer
            .from("conversations")
            .update({ unread: true, assigned_label: assignedLabel })
            .eq("id", conversationId);
        }

        // 3. Process Multimedia incoming messages
        let messageText = "";
        let base64Data = "";
        let imageMimeType = "image/jpeg";
        let isLocalLanguageAudio = false;

        if (!isEvolution) {
          if (messageObject.type === "audio") {
            const audioId = messageObject.audio?.id;
            let transcribedText = "";

            if (audioId && token) {
              try {
                // Fetch media URL from Meta API
                const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${audioId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const mediaMetadata = await mediaRes.json();
                const downloadUrl = mediaMetadata.url;

                if (downloadUrl) {
                  // Download audio file from Meta
                  const audioFileRes = await fetch(downloadUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const arrayBuffer = await audioFileRes.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);

                  // Upload audio file to Supabase Storage
                  let audioPublicUrl = "";
                  try {
                    const audioUploadPath = `received-audio/${customerPhone}/${Date.now()}.ogg`;
                    const { error: uploadAudioErr } = await supabaseServer.storage
                      .from("product-images")
                      .upload(audioUploadPath, buffer, {
                        contentType: messageObject.audio.mime_type || "audio/ogg",
                        upsert: true
                      });

                    if (uploadAudioErr) {
                      console.error("Supabase storage upload audio error:", uploadAudioErr);
                    } else {
                      const { data: { publicUrl } } = supabaseServer.storage
                        .from("product-images")
                        .getPublicUrl(audioUploadPath);
                      audioPublicUrl = publicUrl;
                    }
                  } catch (storageErr) {
                    console.error("Error uploading audio to Supabase Storage:", storageErr);
                  }

                  // Check if OpenAI API Key is configured
                  if (process.env.OPENAI_API_KEY) {
                    const formData = new FormData();
                    // Create a Blob from the audio buffer
                    const blob = new Blob([buffer], { type: messageObject.audio.mime_type || "audio/ogg" });
                    // Append the file with a generic filename that Whisper accepts
                    formData.append("file", blob, "audio.ogg");
                    formData.append("model", "whisper-1");
                    formData.append("response_format", "verbose_json");

                    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
                      },
                      body: formData
                    });

                    if (whisperRes.ok) {
                      const whisperData = await whisperRes.json();
                      if (whisperData.text) {
                        transcribedText = whisperData.text;
                        const detectedLanguage = (whisperData.language || "").toLowerCase();
                        const isFrench = detectedLanguage === "french" || detectedLanguage === "fr";
                        
                        if (!isFrench) {
                          isLocalLanguageAudio = true;
                        }

                        messageText = audioPublicUrl 
                          ? `[Audio: ${audioPublicUrl}] ${transcribedText}` 
                          : transcribedText;
                      }
                    } else {
                      const errData = await whisperRes.json().catch(() => ({}));
                      console.error("Whisper API transcription error status:", whisperRes.status, errData);
                    }
                  }
                }
              } catch (err) {
                console.error("Error transcribing audio via Whisper:", err);
              }
            }

            // If transcription failed or OpenAI key is not configured, fall back to the old behavior
            if (!transcribedText) {
              const audioReply = "Je ne peux pas encore lire les messages vocaux. Pouvez-vous m'écrire par texte s'il vous plaît ?";
              await sendWhatsAppMessage(customerPhone, audioReply, businessId);
              
              const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const cleanMsgText = `[WA_MSG_ID: ${messageId}] [Message vocal reçu (Non lu)]`;
              await saveMessageSafe(conversationId, "customer", cleanMsgText, timeStr, customerPhone, businessId);
              return;
            }
          } else if (messageObject.type === "image") {
            const imageId = messageObject.image?.id;
            if (imageId && token) {
              try {
                // Fetch media object from Meta API to get download URL
                const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${imageId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const mediaMetadata = await mediaRes.json();
                const downloadUrl = mediaMetadata.url;

                if (downloadUrl) {
                  // Fetch raw image bytes from Meta
                  const imgBlobRes = await fetch(downloadUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const arrayBuffer = await imgBlobRes.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  base64Data = buffer.toString("base64");
                  imageMimeType = messageObject.image.mime_type || "image/jpeg";

                  // Upload image file to Supabase Storage
                  const uploadPath = `received/${customerPhone}/${Date.now()}.jpg`;
                  const { error: uploadErr } = await supabaseServer.storage
                    .from("product-images")
                    .upload(uploadPath, buffer, {
                      contentType: imageMimeType,
                      upsert: true
                    });

                  if (uploadErr) {
                    console.error("Supabase storage upload error:", uploadErr);
                  }

                  // Get public URL
                  const { data: { publicUrl } } = supabaseServer.storage
                    .from("product-images")
                    .getPublicUrl(uploadPath);

                  messageText = `[Image reçue : ${publicUrl}]`;
                  if (messageObject.image.caption) {
                    messageText += ` Caption: ${messageObject.image.caption}`;
                  }
                }
              } catch (err) {
                console.error("Error processing incoming WhatsApp image:", err);
                messageText = "[Image reçue (Erreur de traitement)]";
              }
            } else {
              messageText = "[Image reçue (Crédentiels manquants)]";
            }
          } else if (messageObject.type !== "text") {
            const fallbackReply = "Je ne peux pas encore traiter ce type de message, pouvez-vous m'écrire en texte ?";
            await sendWhatsAppMessage(customerPhone, fallbackReply, businessId);

            const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const cleanMsgText = `[WA_MSG_ID: ${messageId}] [Fichier reçu non pris en charge: ${messageObject.type}]`;
            await saveMessageSafe(
              conversationId,
              "customer",
              cleanMsgText,
              timeStr,
              customerPhone,
              businessId
            );
            return;
          } else {
            messageText = messageObject.text?.body || "";
          }
        }

        if (!messageText) {
          return;
        }

        if (isLocalLanguageAudio) {
          const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          
          // Save the customer side notification message with WA_MSG_ID prefix
          const notificationMsg = `[WA_MSG_ID: ${messageId}] 🔔 Message vocal reçu, probablement en langue locale (non français) — transcription automatique non fiable. Écoutez directement l'audio dans le SaaS pour répondre.`;
          await saveMessageSafe(conversationId, "customer", notificationMsg, timeStr, customerPhone, businessId);

          // Escalate to human in DB
          await supabaseServer
            .from("conversations")
            .update({ status: "human_takeover" })
            .eq("id", conversationId);

          // Send polite waiting message to customer
          const customerWaitingMsg = "Un instant, je reviens vers vous 🙏";
          await sendWhatsAppMessage(customerPhone, customerWaitingMsg, businessId);
          
          // Save AI reply in messages table
          await saveMessageSafe(conversationId, "ai", customerWaitingMsg, timeStr, customerPhone, businessId);
          return;
        }

        // Save incoming message in messages history safely with prefix
        const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const cleanMsgText = `[WA_MSG_ID: ${messageId}] ${messageText}`;

        if (fromMe) {
          // Sync outgoing message sent manually by the human from their WhatsApp app
          await saveMessageSafe(conversationId, "ai", cleanMsgText, timeStr, customerPhone, businessId);
          console.log(`Synced outgoing message fromMe for conversation ${conversationId}`);
          return;
        }

        await saveMessageSafe(conversationId, "customer", cleanMsgText, timeStr, customerPhone, businessId);

        // If human takeover is active, stop here (do not call Claude / send AI reply)
        if (conversation.status === "human_takeover") {
          console.log("Conversation in human_takeover mode. AI response skipped.");
          return;
        }

        // If coexistence mode is active, stop here (do not run AI auto-reply)
        if (coexistenceMode) {
          console.log("Coexistence mode active for this number. AI auto-reply skipped.");
          return;
        }

        // Run closeur agent execution (simulates typing and calls Claude)
        const runCloseurAgent = async () => {
          try {
            // Send typing indicator to WhatsApp to show the AI is active/typing
            await sendWhatsAppTypingIndicator(customerPhone, businessId);

            // Sleep 1 second to simulate human typing delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Fetch Products
            const { data: rawProducts } = await supabaseServer
              .from("products")
              .select("*")
              .eq("business_id", businessId)
              .eq("active", true);

            const products = (rawProducts || []).map((p: any) => {
              let cleanImageUrl = p.image_url;
              if (p.image_url && typeof p.image_url === "string" && p.image_url.includes("data:")) {
                cleanImageUrl = "[BASE64_IMAGE_DATA_OMITTED_FOR_BREVITY]";
              }

              let cleanImageUrls = p.image_urls;
              if (p.image_urls) {
                if (typeof p.image_urls === "string" && p.image_urls.includes("data:")) {
                  cleanImageUrls = "[BASE64_IMAGE_DATA_OMITTED_FOR_BREVITY]";
                } else if (Array.isArray(p.image_urls)) {
                  cleanImageUrls = p.image_urls.map((url: any) => {
                    if (typeof url === "string" && url.startsWith("data:")) {
                      return "[BASE64_IMAGE_DATA_OMITTED_FOR_BREVITY]";
                    }
                    return url;
                  });
                }
              }

              let cleanTestimonials = p.testimonials;
              if (p.testimonials && typeof p.testimonials === "string" && p.testimonials.includes("data:")) {
                try {
                  const parsed = JSON.parse(p.testimonials);
                  if (Array.isArray(parsed)) {
                    cleanTestimonials = JSON.stringify(parsed.map((t: any) => {
                      if (t.content && t.content.startsWith("data:")) {
                        return { ...t, content: "[BASE64_IMAGE_DATA_OMITTED_FOR_BREVITY]" };
                      }
                      return t;
                    }));
                  }
                } catch (e) {
                  cleanTestimonials = "[BASE64_IMAGE_DATA_OMITTED_FOR_BREVITY]";
                }
              }

              return {
                ...p,
                image_url: cleanImageUrl,
                image_urls: cleanImageUrls,
                testimonials: cleanTestimonials
              };
            });

            // Fetch Zones
            const { data: zones } = await supabaseServer
              .from("delivery_zones")
              .select("*")
              .eq("business_id", businessId);

            // Fetch 15 most recent messages
            const { data: recentMessages, error: messagesErr } = await supabaseServer
              .from("messages")
              .select("*")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: false })
              .limit(15);

            if (messagesErr) {
              console.error("Error fetching messages history from Supabase:", messagesErr);
            }

            const messagesList = [...(recentMessages || [])].reverse();

            // 6. Format messages history for Anthropic (cleaning prefix & base64)
            const formattedMessages = messagesList.map((m: any) => {
              let cleanText = m.text || "";
              if (cleanText.startsWith("[WA_MSG_ID: ")) {
                const index = cleanText.indexOf("]");
                if (index !== -1) {
                  cleanText = cleanText.substring(index + 1).trim();
                }
              }
              if (cleanText.includes("data:") || cleanText.includes("base64")) {
                cleanText = "[IMAGE_OR_FILE_DATA_OMITTED_FOR_BREVITY]";
              }
              return {
                role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
                content: cleanText,
              };
            });

            // Fetch rules
            const { data: rulesData } = await supabaseServer
              .from("agent_rules")
              .select("condition, action")
              .eq("business_id", businessId)
              .eq("active", true);

            const formattedRules = (rulesData || [])
              .map((r: any) => `Si ${r.condition}, alors ${r.action}.`)
              .join("\n");

            // Construct System Prompt
            const systemPrompt = `[IDENTITÉ - RÈGLE ABSOLUE]
Tu es un membre de l'équipe commerciale, JAMAIS une IA ou un robot. Ne révèle JAMAIS, sous aucun prétexte, que tu es une intelligence artificielle, même si le client te le demande directement. Si un client insiste ou demande explicitement 'es-tu un robot/une IA ?', réponds avec légèreté sans confirmer ni nier frontalement (ex: 'Je suis là pour vous aider du mieux possible 😊, que puis-je faire pour vous ?') et redirige la conversation. Si l'escalade vers un humain est nécessaire, fais-le de manière fluide et naturelle, sans jamais dire des phrases comme 'je vais transférer votre demande à un humain' qui sous-entendent que tu n'en étais pas un.

Tu es l'agent conversationnel intelligent et autonome de vente (closeur) pour l'entreprise "${business?.name || "Notre boutique"}".
Ton but est de conseiller les prospects, de les aider à choisir des produits, de calculer les frais de livraison, et de conclure des ventes (closing) en enregistrant leur commande.

[IDENTITÉ ET RÔLE]
${identity}

[RÈGLES COMMERCIALES ET PROCESSUS DE VENTE]
${salesRules}

[PROCESSUS ET RÈGLES D'ESCALADE VERS UN HUMAIN]
${escalationRules}

[TON CONVERSATIONNEL ET PERSONNALITÉ]
- Ton de voix : ${tone}

[DÉDOUBLONNAGE ET INFORMATIONS ANCIENNES CLIENT]
${isReturningCustomer ? `Note: Ce client a déjà commandé. Son ancienne adresse de livraison enregistrée : "${lastOrderAddress}". Son ancien nom enregistré : "${lastOrderCustomerName}". Si pertinent, propose-lui de réutiliser cette adresse ou confirme son nom sans lui redemander de zéro.` : "Note: Nouveau client."}

[RÈGLES CRITIQUES D'EXÉCUTION DES OUTILS]
1. Outil 'send_product_visual' : Appelle cet outil dès que le client demande à voir un produit, son image, ou sa photo. N'invente jamais d'URLs d'images. Laisse l'argument 'image_url' vide et passe uniquement 'product_name' et 'image_type'.
2. Outil 'create_order' : Appelle cet outil IMMEDIATEMENT dès que le client a confirmé (par "Oui", "D'accord", etc.) le récapitulatif de sa commande proposé. Ne lui demande pas d'autres confirmations avant d'appeler l'outil.
3. Renseigne toujours les arguments requis au mieux selon le contexte de la conversation.

[RÈGLES SPÉCIFIQUES SUPPLÉMENTAIRES (RÈGLES MÉTIER CONTEXTUELLES)]
${formattedRules}
`;

            const webhookTools = [
              {
                name: "search_products",
                description: "Rechercher des produits du catalogue par mot-clé.",
                input_schema: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Le terme de recherche (ex: minceur, thé)." },
                  },
                  required: ["query"],
                },
              },
              {
                name: "check_delivery_zone",
                description: "Vérifier le tarif et délai de livraison pour une zone géographique donnée.",
                input_schema: {
                  type: "object",
                  properties: {
                    zone_name: { type: "string", description: "Nom du quartier ou de la zone (ex: Tanghin, Patte d'oie)." },
                  },
                  required: ["zone_name"],
                },
              },
              {
                name: "get_order_status",
                description: "Consulter le statut en temps réel d'une commande par son ID.",
                input_schema: {
                  type: "object",
                  properties: {
                    order_id: { type: "integer", description: "ID numérique unique de la commande." },
                  },
                  required: ["order_id"],
                },
              },
              {
                name: "update_engagement_status",
                description: "Met à jour le statut d'engagement de la conversation avec le client (ex: 'interesse', 'hesitant', 'chaud', 'reclamation').",
                input_schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["interesse", "hesitant", "chaud", "reclamation"],
                      description: "Le nouveau statut d'engagement."
                    }
                  },
                  required: ["status"]
                }
              },
              {
                name: "escalate_to_human",
                description: "Transférer la conversation à un agent humain en cas de demande spécifique complexe ou plainte.",
                input_schema: {
                  type: "object",
                  properties: {
                    reason: { type: "string", description: "La raison du transfert." }
                  },
                  required: ["reason"]
                }
              },
              {
                name: "send_product_visual",
                description: "Envoyer l'image/photo d'un produit (catalogue ou témoignages clients) via WhatsApp.",
                input_schema: {
                  type: "object",
                  properties: {
                    product_name: { type: "string", description: "Le nom précis ou partiel du produit." },
                    image_type: { type: "string", enum: ["catalog", "testimonials"], description: "Type de visuel : 'catalog' pour la photo du produit, 'testimonials' pour des avant/après ou avis clients." },
                    image_url: { type: "string", description: "L'URL de l'image directe à envoyer si déjà identifiée." },
                    caption: { type: "string", description: "Légende optionnelle accompagnant l'image." },
                  },
                  required: ["product_name", "image_type"],
                },
              },
              {
                name: "create_order",
                description: "Enregistrer une commande ferme confirmée par le client.",
                input_schema: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string", description: "Nom complet du client." },
                    customer_phone: { type: "string", description: "Numéro de téléphone WhatsApp." },
                    customer_address: { type: "string", description: "Adresse physique de livraison (quartier, repères)." },
                    delivery_zone: { type: "string", description: "Nom précis de la zone de livraison validée." },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          product_name: { type: "string", description: "Nom exact du produit commandé." },
                          quantity: { type: "integer", minimum: 1, description: "Quantité commandée." },
                        },
                        required: ["product_name", "quantity"],
                      },
                    },
                  },
                  required: ["customer_name", "customer_phone", "customer_address", "delivery_zone", "items"],
                },
                cache_control: { type: "ephemeral" }
              } as any,
            ];

            // Call Claude with explicit prompt caching
            const response = await anthropic.messages.create({
              model: CLAUDE_MODEL,
              max_tokens: 1024,
              system: [
                { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }
              ] as any,
              messages: formattedMessages as any,
              tools: webhookTools,
            });

            console.log("[USAGE]", {
              input: response.usage.input_tokens,
              output: response.usage.output_tokens,
              cache_write: response.usage.cache_creation_input_tokens,
              cache_read: response.usage.cache_read_input_tokens,
            });

            let assistantMessage = "";
            const toolCalls = response.content.filter((c) => c.type === "tool_use");

            if (toolCalls.length === 0) {
              assistantMessage = response.content.find((c) => c.type === "text")?.text || "";
            } else {
              const toolResults = [];

              for (const toolCall of toolCalls) {
                const { name, input, id: toolUseId } = toolCall as any;
                let resultData: any = null;

                try {
                  if (name === "search_products") {
                    const query = input.query.toLowerCase();
                    const matched = (products || []).filter(
                      (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
                    );
                    resultData = matched;
                  } else if (name === "check_delivery_zone") {
                    const query = input.zone_name.toLowerCase();
                    const matched = (zones || []).find((z) => z.name.toLowerCase().includes(query));
                    if (matched) {
                      resultData = { name: matched.name, fee: matched.fee, time: matched.delivery_time };
                    } else {
                      resultData = { error: `Zone '${input.zone_name}' non trouvée dans la liste des zones.` };
                    }
                  } else if (name === "get_order_status") {
                    const { data: order } = await supabaseServer
                      .from("orders")
                      .select("status, total, date")
                      .eq("id", input.order_id)
                      .maybeSingle();
                    if (order) {
                      resultData = { order_id: input.order_id, status: order.status, date: order.date, total: order.total };
                    } else {
                      resultData = { error: `Commande '${input.order_id}' non trouvée.` };
                    }
                  } else if (name === "update_engagement_status") {
                    const { error: updateErr } = await supabaseServer
                      .from("conversations")
                      .update({ engagement_status: input.status })
                      .eq("id", conversationId);
                    if (updateErr) {
                      resultData = { success: false, error: updateErr.message };
                    } else {
                      resultData = { success: true, message: `Statut d'engagement mis à jour à '${input.status}'.` };
                    }
                  } else if (name === "escalate_to_human") {
                    // Update conversation status in Supabase
                    await supabaseServer
                      .from("conversations")
                      .update({ status: "human_takeover" })
                      .eq("id", conversationId);

                    resultData = { success: true, message: "Contrôle transféré à un conseiller humain." };
                  } else if (name === "send_product_visual") {
                    const imgType = input.image_type;
                    const productName = input.product_name;
                    const directUrl = input.image_url;
                    const captionStr = input.caption || "";
                    let imageUrl = directUrl || "";

                    if (imageUrl && imageUrl.startsWith("data:")) {
                      console.error("SERVER ERROR: Input image_url starts with data: (base64 blocked)");
                      imageUrl = "";
                    }

                    if (!imageUrl && productName) {
                      const matchedProduct = (products || []).find(
                        (p: any) => p.name.toLowerCase().includes(productName.toLowerCase()) || p.id === productName
                      );
                      if (matchedProduct) {
                        // 1. Try to find product_media matching BOTH product_id AND label (imgType)
                        if (imgType) {
                          let exactMediaList: any[] = [];
                          if (imgType === "testimonials") {
                            const { data } = await supabaseServer
                              .from("product_media")
                              .select("url")
                              .eq("business_id", businessId)
                              .eq("product_id", matchedProduct.id)
                              .ilike("label", "testimonials%");
                            exactMediaList = data || [];
                          } else {
                            const { data } = await supabaseServer
                              .from("product_media")
                              .select("url")
                              .eq("business_id", businessId)
                              .eq("product_id", matchedProduct.id)
                              .eq("label", imgType);
                            exactMediaList = data || [];
                          }

                          if (exactMediaList.length > 0) {
                            const randomIndex = Math.floor(Math.random() * exactMediaList.length);
                            const pickedMedia = exactMediaList[randomIndex];
                            if (pickedMedia && pickedMedia.url && !pickedMedia.url.startsWith("data:")) {
                              imageUrl = pickedMedia.url;
                            }
                          }
                        }

                        // 2. If not found, try to find any product_media matching just product_id
                        if (!imageUrl) {
                          const { data: exactMedia } = await supabaseServer
                            .from("product_media")
                            .select("url")
                            .eq("business_id", businessId)
                            .eq("product_id", matchedProduct.id)
                            .limit(1)
                            .maybeSingle();
                          if (exactMedia && exactMedia.url && !exactMedia.url.startsWith("data:")) {
                            imageUrl = exactMedia.url;
                          }
                        }

                        // 3. Fallback to product record's image_url
                        if (!imageUrl) {
                          imageUrl = matchedProduct.image_url || (matchedProduct.image_urls && matchedProduct.image_urls[0]) || "";
                        }
                      }
                    }

                    // 4. Fallback if still no image, search product_media by label only
                    if (!imageUrl && imgType) {
                      let labelMediaList: any[] = [];
                      if (imgType === "testimonials") {
                        const { data } = await supabaseServer
                          .from("product_media")
                          .select("url")
                          .eq("business_id", businessId)
                          .ilike("label", "testimonials%");
                        labelMediaList = data || [];
                      } else {
                        const { data } = await supabaseServer
                          .from("product_media")
                          .select("url")
                          .eq("business_id", businessId)
                          .eq("label", imgType);
                        labelMediaList = data || [];
                      }

                      if (labelMediaList.length > 0) {
                        const randomIndex = Math.floor(Math.random() * labelMediaList.length);
                        const pickedMedia = labelMediaList[randomIndex];
                        if (pickedMedia && pickedMedia.url && !pickedMedia.url.startsWith("data:")) {
                          imageUrl = pickedMedia.url;
                        }
                      }
                    }

                    if (imageUrl && imageUrl.startsWith("data:")) {
                      console.error("SERVER ERROR: Fallback imageUrl starts with data: (base64 blocked)");
                      imageUrl = "";
                    }

                    if (imageUrl && !imageUrl.startsWith("data:")) {
                      const success = await sendWhatsAppImage(customerPhone, imageUrl, captionStr, businessId);
                      
                      // Save visually sent image message in history safely (no base64 saved to DB)
                      const msgTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                      const historyText = imageUrl.startsWith("data:") 
                        ? `[Image envoyée : ${productName || imgType || 'direct'}] [Image produit]`
                        : `[Image envoyée : ${productName || imgType || 'direct'}] ${imageUrl}`;

                      await saveMessageSafe(
                        conversationId,
                        "ai",
                        historyText,
                        msgTime,
                        customerPhone,
                        businessId
                      );

                      resultData = { success, message: `Image envoyée avec succès.` };
                    } else {
                      console.error("SERVER ERROR: send_product_visual failed - imageUrl is empty or data: (base64)");
                      resultData = { success: false, error: `Impossible de trouver l'image pour le produit '${productName}' ou le type '${imgType}'.` };
                    }
                  } else if (name === "create_order") {
                    // Find zone to get delivery fee
                    const targetZone = (zones || []).find(
                      (z) => z.name.toLowerCase() === input.delivery_zone.toLowerCase()
                    );
                    const shippingFee = targetZone ? targetZone.fee : 2000;

                    // Fetch product prices and calculate totals
                    let subtotal = 0;
                    const itemsToInsert: any[] = [];
                    const newOrderId = `CMD-2026-0${Math.floor(Math.random() * 9000 + 1000)}`;

                    for (const item of input.items) {
                      const matchedProduct = (products || []).find(
                        (p) => p.name.toLowerCase() === item.product_name.toLowerCase()
                      );
                      const price = matchedProduct ? matchedProduct.price : 0;
                      subtotal += price * item.quantity;
                      itemsToInsert.push({
                        order_id: newOrderId,
                        product: item.product_name,
                        quantity: item.quantity,
                        price: price,
                      });
                    }

                    const total = subtotal + shippingFee;

                    // Automatic courier assignment logic
                    const { data: activeCouriers } = await supabaseServer
                      .from("couriers")
                      .select("*")
                      .eq("business_id", businessId)
                      .eq("active", true);

                    let assignedCourier = null;
                    let orderStatus = "confirmed";

                    if (activeCouriers && activeCouriers.length > 0) {
                      assignedCourier = activeCouriers.reduce((prev: any, curr: any) => {
                        const prevLoad = prev.load || 0;
                        const currLoad = curr.load || 0;
                        return prevLoad <= currLoad ? prev : curr;
                      });
                      orderStatus = "sent_to_courier";
                    }

                    // Insert Order
                    const { error: orderErr } = await supabaseServer.from("orders").insert({
                      id: newOrderId,
                      business_id: businessId,
                      customer: input.customer_name,
                      customer_phone: customerPhone,
                      customer_address: input.customer_address,
                      date: new Date().toISOString().substring(0, 10),
                      status: orderStatus,
                      payment_status: "pending",
                      delivery_zone: input.delivery_zone,
                      shipping_fee: shippingFee,
                      total: total,
                      chat_id: conversationId,
                      courier_name: assignedCourier ? assignedCourier.name : null,
                    });

                    if (orderErr) {
                      resultData = { success: false, error: orderErr.message };
                    } else {
                      // Insert Order Items
                      await supabaseServer.from("order_items").insert(itemsToInsert);
                      await updateCustomerTag("commande_passée");

                      if (assignedCourier) {
                        // Update courier load
                        await supabaseServer
                          .from("couriers")
                          .update({ load: (assignedCourier.load || 0) + 1 })
                          .eq("id", assignedCourier.id);

                        // Notify courier via WhatsApp with interactive buttons
                        if (assignedCourier.phone) {
                          const courierItemsStr = input.items.map((item: any) => `- ${item.product_name} (x${item.quantity})`).join("\n");
                          const courierMessageText = `Bonjour ${assignedCourier.name} ! 🚚\n\nUne nouvelle commande vous a été AUTOMATIQUEMENT assignée :\n\n- *ID Commande* : ${newOrderId}\n- *Client* : ${input.customer_name}\n- *Téléphone* : ${customerPhone}\n- *Zone de livraison* : ${input.delivery_zone}\n- *Adresse* : ${input.customer_address || "Non spécifiée"}\n- *Articles* :\n${courierItemsStr}\n- *Frais de livraison* : ${shippingFee} FCFA\n- *Total à collecter* : ${total} FCFA`;
                          
                          await sendWhatsAppInteractiveButtons(
                            assignedCourier.phone,
                            courierMessageText,
                            [
                              { id: `livre_${newOrderId}`, title: "✅ Livré" },
                              { id: `annule_${newOrderId}`, title: "❌ Annulé" },
                              { id: `reprogramme_${newOrderId}`, title: "🔄 Reprogrammé" }
                            ],
                            businessId
                          );
                        }
                      }
                      
                      // Update conversation engagement status to client / client_fidele
                      const { count } = await supabaseServer
                        .from("orders")
                        .select("*", { count: "exact", head: true })
                        .eq("chat_id", conversationId);
                      const orderCount = (count || 0) + 1; // +1 for the newly inserted order
                      const newEngagement = orderCount >= 3 ? "client_fidele" : "client";
                      await supabaseServer
                        .from("conversations")
                        .update({ engagement_status: newEngagement })
                        .eq("id", conversationId);

                      resultData = { success: true, order_id: newOrderId, total: total, shipping_fee: shippingFee };
                    }
                  }
                } catch (err: any) {
                  resultData = { error: err.message };
                }

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUseId,
                  content: JSON.stringify(resultData),
                });
              }

              // Get final reply from Claude with tool outputs (with prompt caching)
              const secondResponse = await anthropic.messages.create({
                model: CLAUDE_MODEL,
                max_tokens: 1024,
                system: [
                  { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }
                ] as any,
                messages: [
                  ...formattedMessages,
                  { role: "assistant", content: response.content },
                  { role: "user", content: toolResults as any },
                ],
                tools: webhookTools,
              } as any);

              console.log("[USAGE]", {
                input: secondResponse.usage.input_tokens,
                output: secondResponse.usage.output_tokens,
                cache_write: secondResponse.usage.cache_creation_input_tokens,
                cache_read: secondResponse.usage.cache_read_input_tokens,
              });

              assistantMessage = secondResponse.content.find((c) => c.type === "text")?.text || "";
            }

            if (assistantMessage) {
              // Strip any database-only "[Image envoyée : ...]" placeholders from the text sent to the customer on WhatsApp
              let clientMessage = assistantMessage.replace(/\[Image envoyée\s*:[^\]]*\]\s*(https?:\/\/\S+)?/gi, '').trim();

              // Send message via Meta WhatsApp (saveMessageSafe handles safety logic & fallbacks to customer)
              const aiTimeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const isTooLong = clientMessage.length > 2000;
              const hasBase64 = clientMessage.toLowerCase().includes("base64") || clientMessage.includes("data:");
              
              if (clientMessage && !isTooLong && !hasBase64) {
                await sendWhatsAppMessage(customerPhone, clientMessage, businessId);
              }
              await saveMessageSafe(conversationId, "ai", assistantMessage, aiTimeStr, customerPhone, businessId);
            }
          } catch (err: any) {
            console.error("Error in background closeur agent:", err);
            const fallbackMessage = "Un instant, je reviens vers vous 🙏";
            await sendWhatsAppMessage(customerPhone, fallbackMessage, businessId);

            const aiTimeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            await saveMessageSafe(
              conversationId,
              "ai",
              `[Erreur Technique: ${err.message || err}] ${fallbackMessage}`,
              aiTimeStr,
              customerPhone,
              businessId
            );
          }
        };

        await runCloseurAgent();
      } catch (err: any) {
        console.error("Background message processing failed:", err);
      }
    };

    // In Vercel serverless functions, we must await the background processing completely.
    // Otherwise, Vercel freezes the container immediately after sending the response,
    // which results in messages arriving hours/minutes later (or only when next container is active).
    await handleIncomingMessageBackground();

    return NextResponse.json({ status: "success", message: "Incoming message processed." });
  } catch (error: any) {
    console.error("Error in webhook POST route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
