import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppTypingIndicator } from "@/lib/whatsapp/send";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import crypto from "crypto";

const DEFAULT_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";

// Verify Signature from Meta (X-Hub-Signature-256)
function verifySignature(payload: string, signatureHeader: string | null): boolean {
  console.log("verifySignature called. Header:", signatureHeader);
  if (!signatureHeader) {
    console.warn("verifySignature: Missing x-hub-signature-256 header");
    return false;
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("verifySignature: WHATSAPP_APP_SECRET environment variable is not configured.");
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    console.warn("verifySignature: Invalid signature format");
    return false;
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

    // Verify signature
    if (!verifySignature(rawBody, signatureHeader)) {
      console.warn("Signature verification failed.");
      return NextResponse.json({ error: "Unauthorized signature validation failed" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.log("Parsed Webhook payload:", JSON.stringify(payload, null, 2));

    // Meta Webhook returns messages nested inside: entry -> changes -> value -> messages
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObject = value?.messages?.[0];

    // If it's not a message (could be a status update, delivery report, etc.), return 200 OK immediately
    if (!messageObject) {
      return NextResponse.json({ status: "ignored_non_message_payload" });
    }

    const customerPhone = messageObject.from; // e.g. "221776543210" or formatted phone
    const contactName = value?.contacts?.[0]?.profile?.name || customerPhone;

    // Resolve businessId dynamically based on the receiving phone number ID
    const phoneNumberId = value?.metadata?.phone_number_id;
    let businessId = DEFAULT_BUSINESS_ID;

    if (phoneNumberId) {
      const { data: bus, error: busErr } = await supabaseServer
        .from("businesses")
        .select("id")
        .eq("whatsapp_phone_number_id", phoneNumberId)
        .maybeSingle();
      
      if (busErr) {
        console.error("Error looking up business by phone number ID:", busErr);
      } else if (bus) {
        businessId = bus.id;
        console.log(`Resolved dynamic business_id: ${businessId} for phone_number_id: ${phoneNumberId}`);
      } else {
        console.warn(`No business found matching phone number ID: ${phoneNumberId}. Falling back to default.`);
      }
    }

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
      const { data: newConv, error: createConvErr } = await supabaseServer
        .from("conversations")
        .insert({
          business_id: businessId,
          customer_name: contactName,
          customer_phone: customerPhone,
          status: "ai_active",
          avatar: avatarLetters,
          unread: true,
        })
        .select()
        .single();

      if (createConvErr) {
        console.error("Error creating conversation in Supabase:", createConvErr);
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      }

      conversation = newConv;
      conversationId = newConv.id;
    } else {
      // Update conversation unread status
      await supabaseServer
        .from("conversations")
        .update({ unread: true })
        .eq("id", conversationId);
    }

    // 3. Process Multimedia incoming messages
    let messageText = "";
    let base64Data = "";
    let imageMimeType = "image/jpeg";

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
              formData.append("language", "fr");

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
        await supabaseServer.from("messages").insert({
          conversation_id: conversationId,
          sender: "customer",
          text: "[Message vocal reçu (Non lu)]",
          time: timeStr,
        });

        return NextResponse.json({ status: "success", message: "Audio message fallback processed." });
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
      await supabaseServer.from("messages").insert({
        conversation_id: conversationId,
        sender: "customer",
        text: `[Fichier reçu non pris en charge: ${messageObject.type}]`,
        time: timeStr,
      });

      return NextResponse.json({ status: "success", message: "Unsupported message type fallback processed." });
    } else {
      messageText = messageObject.text?.body || "";
    }

    if (!messageText) {
      return NextResponse.json({ status: "ignored_empty_message" });
    }

    // Save incoming message in messages history
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    await supabaseServer.from("messages").insert({
      conversation_id: conversationId,
      sender: "customer",
      text: messageText,
      time: timeStr,
    });

    // If human takeover is active, stop here (do not call Claude / send AI reply)
    if (conversation.status === "human_takeover") {
      return NextResponse.json({ status: "success", message: "Conversation in human_takeover mode. AI response skipped." });
    }

    // Launch closeur agent execution in the background (prevents WhatsApp webhook timeout and simulates human typing delay)
    const runCloseurAgent = async () => {
      try {
        // Send typing indicator to WhatsApp to show the AI is active/typing
        await sendWhatsAppTypingIndicator(customerPhone, businessId);

        // Sleep 2.5 seconds to simulate human typing delay
        await new Promise((resolve) => setTimeout(resolve, 2500));

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
              cleanTestimonials = "[BASE64_IMAGE_DATA_OMITTED]";
            }
          }
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            image_url: cleanImageUrl,
            image_urls: cleanImageUrls,
            testimonials: cleanTestimonials,
            stock: p.stock,
            active: p.active,
            category: p.category
          };
        });

        // Fetch Delivery Zones
        const { data: zones } = await supabaseServer
          .from("delivery_zones")
          .select("*")
          .eq("business_id", businessId);

        // Fetch Knowledge Base
        const { data: kbData } = await supabaseServer
          .from("agent_knowledge_base")
          .select("question, reponse")
          .eq("business_id", businessId)
          .eq("active", true);

        const formattedKB = (kbData || [])
          .map((k: any) => `Q: ${k.question}\nR: ${k.reponse}`)
          .join("\n\n");

        // Fetch Auto Rules
        const { data: rulesData } = await supabaseServer
          .from("agent_rules")
          .select("condition, action")
          .eq("business_id", businessId)
          .eq("active", true);

        const formattedRules = (rulesData || [])
          .map((r: any) => `- SI: "${r.condition}" -> ALORS: "${r.action}"`)
          .join("\n");

        // Construct System Prompt
        let returningCustomerContext = "";
        if (isReturningCustomer) {
          returningCustomerContext = `
[RECONNAISSANCE CLIENT - TRÈS IMPORTANT]
Ce client a déjà commandé chez nous sous le nom "${lastOrderCustomerName}" avec l'adresse de livraison suivante : "${lastOrderAddress}".
RÈGLE : Salue-le chaleureusement en utilisant son prénom (déduit de son nom "${lastOrderCustomerName}") ou son nom complet, et confirme simplement s'il souhaite être livré à la même adresse que la dernière fois ("${lastOrderAddress}"). Ne lui redemande pas son nom ou son adresse s'il confirme vouloir réutiliser ces informations !`;
        }

        const systemPrompt = `[IDENTITÉ - RÈGLE ABSOLUE]
Tu es un membre de l'équipe commerciale, JAMAIS une IA ou un robot. Ne révèle JAMAIS, sous aucun prétexte, que tu es une intelligence artificielle, même si le client te le demande directement. Si un client insiste ou demande explicitement 'es-tu un robot/une IA ?', réponds avec légèreté sans confirmer ni nier frontalement (ex: 'Je suis là pour vous aider du mieux possible 😊, que puis-je faire pour vous ?') et redirige la conversation. Si l'escalade vers un humain est nécessaire, fais-le de manière fluide et naturelle, sans jamais dire des phrases comme 'je vais transférer votre demande à un humain' qui sous-entendent que tu n'en étais pas un.

Tu es l'agent conversationnel intelligent et autonome de vente (closeur) pour l'entreprise "${business?.name || "Notre boutique"}".
Ton but est de conseiller les prospects, de les aider à choisir des produits, de calculer les frais de livraison, et de conclure des ventes (closing) en enregistrant leur commande.

[COORDONNÉES DE L'ENTREPRISE]
- Ville/Quartier de localisation : ${business?.location || "Non précisé"}
- Téléphone de contact direct : ${business?.contact_phone || "Non précisé"}

[STYLE DE CONVERSATION ET RÈGLES DE CONCISION - TRÈS CRITIQUE]
- Écris des messages EXTRÊMEMENT COURTS ET CONCIS : MAXIMUM 30 MOTS PAR MESSAGE. C'est une règle absolue pour paraître humain sur WhatsApp.
- Pose UNE SEULE question à la fois, jamais plusieurs questions dans le même message.
- Utilise un ton naturel, humain et chaleureux, pas robotique ni trop formel.
- Utilise des emojis avec modération pour rester engageant.

[IDENTITÉ ET RÔLE]
${identity}

[TON CONVERSATIONNEL]
${tone}

[RÈGLES DE VENTE, CATALOGUE ET ENVOI D'IMAGES]
${salesRules}
- IMPORTANT : Ne jamais négocier les prix à la baisse ou offrir des remises non autorisées.
- Ne propose que les produits disponibles dans le catalogue ci-dessous.
- RÈGLE ABSOLUE : Ne demande JAMAIS son numéro de téléphone au client. Le système le connaît automatiquement depuis son numéro WhatsApp et l'outil create_order l'obtiendra automatiquement.
- ENVOI DE VISUELS PRODUITS : Si le client exprime de l'intérêt pour un produit (ex: le Kit Minceur), utilise TOUJOURS l'outil 'send_product_visual' avec le paramètre 'product_name' égal au nom du produit pour lui envoyer directement sa photo de catalogue. Ne mets pas l'URL brute de l'image en texte, appelle l'outil !
- ENVOI DE TÉMOIGNAGES SUR LES DOUTES : Si le client a des doutes (ex: "est-ce que ça marche ?", "j'ai peur de me faire arnaquer", "comment faire confiance ?", "est-ce efficace ?"), tu dois le rassurer et lui envoyer un témoignage client (capture d'écran). Regarde le champ 'testimonials' du produit concerné dans le catalogue (qui contient des URLs d'images de témoignages). Appelle l'outil 'send_product_visual' en renseignant le paramètre 'image_url' avec l'URL du témoignage trouvé dans ce champ, accompagné d'une courte légende.
${returningCustomerContext}

[RÈGLES AUTOMATIQUES (SI/ALORS)]
${formattedRules || "Aucune règle automatique définie."}

[RÈGLES D'ESCALADE / REPRISE HUMAINE]
${escalationRules}
- Si les règles d'escalade sont déclenchées ou si le client demande expressément à parler à un humain/conseiller/responsable, appelle l'outil 'escalate_to_human'.

[BASE DE CONNAISSANCES]
${formattedKB || "Aucune information supplémentaire dans la base de connaissances."}

[ZONES DE LIVRAISON DISPONIBLES]
${JSON.stringify(zones || [], null, 2)}
`;

        // Fetch full conversation history from Supabase (to construct prompt)
        const { data: historyMessages } = await supabaseServer
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        let historyToMap = historyMessages || [];
        if (historyToMap.length > 0) {
          // Exclude last message (which we just inserted) to construct visually with the image block if needed
          historyToMap = historyToMap.slice(0, -1);
        }

        const rawHistory: any[] = historyToMap.map((m: any) => {
          let textContent = m.text;
          // Clean dynamic media formatting tags so Anthropic focuses only on text transcriptions/conversations
          textContent = textContent.replace(/\[Audio:\s*[^\]]+\]/gi, "");
          textContent = textContent.replace(/\[Image\s*(?:reçue|envoyée)?\s*:\s*[^\]]+\]/gi, "");
          textContent = textContent.replace(/\[Image\s*envoyée\s*:\s*[^\]]+\]\s*(https?:\/\/[^\s]+)/gi, "");
          textContent = textContent.replace(/\[Video\s*(?:reçue|envoyée)?\s*:\s*[^\]]+\]/gi, "");
          textContent = textContent.replace(/\[Fichier\s*(?:reçu|envoyé)?\s*:\s*[^\]]+\]/gi, "");
          return {
            role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
            content: textContent.trim() || "[Message média]"
          };
        });

        // Append current incoming message (with image visual content if applicable)
        if (messageObject.type === "image" && base64Data) {
          rawHistory.push({
            role: "user" as const,
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageMimeType,
                  data: base64Data
                }
              },
              {
                type: "text",
                text: messageObject.image.caption || "[L'utilisateur a envoyé cette image/capture d'écran]"
              }
            ]
          });
        } else {
          let currentText = messageText || "";
          currentText = currentText.replace(/\[Audio:\s*[^\]]+\]/gi, "");
          rawHistory.push({
            role: "user" as const,
            content: currentText.trim() || "[Message vocal]"
          });
        }

        const formattedMessages: any[] = [];
        for (const msg of rawHistory) {
          if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === msg.role) {
            const lastMsg = formattedMessages[formattedMessages.length - 1];
            if (typeof lastMsg.content === "string" && typeof msg.content === "string") {
              lastMsg.content += "\n" + msg.content;
            } else {
              const lastContentArray = Array.isArray(lastMsg.content)
                ? lastMsg.content
                : [{ type: "text", text: String(lastMsg.content) }];
              const currentContentArray = Array.isArray(msg.content)
                ? msg.content
                : [{ type: "text", text: String(msg.content) }];
              lastMsg.content = [...lastContentArray, ...currentContentArray];
            }
          } else {
            formattedMessages.push({ role: msg.role, content: msg.content });
          }
        }

        while (formattedMessages.length > 0 && formattedMessages[0].role === "assistant") {
          formattedMessages.shift();
        }

        // Define Tools
        const tools: Anthropic.Messages.Tool[] = [
          {
            name: "search_products",
            description: "Recherche un produit dans le catalogue de l'entreprise par mot-clé.",
            input_schema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Le nom ou mot-clé du produit recherché." },
              },
              required: ["query"],
            },
          },
          {
            name: "check_delivery_zone",
            description: "Vérifie les frais de livraison et le délai pour une zone spécifique.",
            input_schema: {
              type: "object",
              properties: {
                zone_name: { type: "string", description: "Le nom de la ville ou quartier de destination." },
              },
              required: ["zone_name"],
            },
          },
          {
            name: "get_order_status",
            description: "Récupère le statut actuel d'une commande par son identifiant.",
            input_schema: {
              type: "object",
              properties: {
                order_id: { type: "string", description: "L'identifiant unique de la commande (ex: CMD-2026-01234)." },
              },
              required: ["order_id"],
            },
          },
          {
            name: "escalate_to_human",
            description: "Transfère immédiatement la discussion à un conseiller humain lorsque les règles d'escalade sont remplies.",
            input_schema: {
              type: "object",
              properties: {
                reason: { type: "string", description: "La raison pour laquelle la reprise humaine est demandée." },
              },
              required: ["reason"],
            },
          },
          {
            name: "send_product_visual",
            description: "Envoie un visuel produit ou un témoignage client au format image sur le WhatsApp du client. Tu peux spécifier soit le type de visuel de la bibliothèque de médias (image_type) soit le nom du produit (product_name) pour envoyer directement sa photo de catalogue.",
            input_schema: {
              type: "object",
              properties: {
                image_type: { 
                  type: "string", 
                  description: "Le type de visuel à envoyer de la bibliothèque de médias (ex: 'temoignage_1', 'temoignage_2', etc.)." 
                },
                product_name: {
                  type: "string",
                  description: "Le nom précis ou partiel du produit dont tu souhaites envoyer la photo depuis le catalogue (ex: 'Kit Minceur')."
                },
                image_url: {
                  type: "string",
                  description: "L'URL de l'image directe à envoyer si tu la connais (par exemple, issue du champ testimonials ou image_url du catalogue)."
                },
                caption: {
                  type: "string",
                  description: "Une légende explicative courte à joindre avec l'image."
                }
              }
            },
          },
          {
            name: "create_order",
            description: "Enregistre une nouvelle commande de produits pour le client.",
            input_schema: {
              type: "object",
              properties: {
                customer_name: { type: "string", description: "Nom complet du client pour la livraison." },
                customer_address: { type: "string", description: "Adresse précise de livraison (quartier, détails)." },
                delivery_zone: { type: "string", description: "La zone/ville de livraison choisie par le client." },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string", description: "Le nom exact du produit du catalogue commandé." },
                      quantity: { type: "integer", description: "Quantité commandée." }
                    },
                    required: ["product_name", "quantity"]
                  }
                }
              },
              required: ["customer_name", "customer_address", "delivery_zone", "items"]
            }
          },
          {
            name: "update_engagement_status",
            description: "Met à jour le statut d'engagement de la conversation avec le client (ex: 'interesse', 'hesitant', 'chaud', 'reclamation'). Utilise cet outil quand le comportement du client indique un changement d'engagement (objections, intérêt fort, plaintes/insatisfaction).",
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
          }
        ];

        // Call Anthropic
        let response = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: formattedMessages,
          tools: tools,
        });

        let toolCalls = response.content.filter((c) => c.type === "tool_use") as any[];
        let assistantMessage = response.content.find((c) => c.type === "text")?.text || "";

        // Tool execution loop
        if (toolCalls.length > 0) {
          const toolResults: any[] = [];
          for (const call of toolCalls) {
            const { name, input, id: toolUseId } = call;
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

                if (productName) {
                  // Find the product in the products list
                  const matchedProduct = (rawProducts || []).find(
                    (p: any) => p.name.toLowerCase().includes(productName.toLowerCase()) || p.id === productName
                  );
                  if (matchedProduct) {
                    imageUrl = matchedProduct.image_url || (matchedProduct.image_urls && matchedProduct.image_urls[0]) || "";
                  }
                }

                // Fallback to agent_media_library if product image not found
                if (!imageUrl && imgType) {
                  const mediaLib = business?.agent_media_library as Record<string, any> || {};
                  const mediaVal = mediaLib[imgType];
                  imageUrl = typeof mediaVal === "object" && mediaVal !== null ? mediaVal.url : mediaVal;
                }

                if (imageUrl) {
                  const success = await sendWhatsAppImage(customerPhone, imageUrl, captionStr, businessId);
                  
                  // Save visually sent image message in history
                  const msgTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                  await supabaseServer.from("messages").insert({
                    conversation_id: conversationId,
                    sender: "ai",
                    text: `[Image envoyée : ${productName || imgType || 'direct'}] ${imageUrl}`,
                    time: msgTime
                  });

                  resultData = { success, message: `Image envoyée avec succès.` };
                } else {
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

                // Insert Order
                const { error: orderErr } = await supabaseServer.from("orders").insert({
                  id: newOrderId,
                  business_id: businessId,
                  customer: input.customer_name,
                  customer_phone: customerPhone,
                  customer_address: input.customer_address,
                  date: new Date().toISOString().substring(0, 10),
                  status: "confirmed",
                  payment_status: "pending",
                  delivery_zone: input.delivery_zone,
                  shipping_fee: shippingFee,
                  total: total,
                  chat_id: conversationId,
                });

                if (orderErr) {
                  resultData = { success: false, error: orderErr.message };
                } else {
                  // Insert Order Items
                  await supabaseServer.from("order_items").insert(itemsToInsert);
                  await updateCustomerTag("commande_passée");
                  
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

          // Get final reply from Claude with tool outputs
          const secondResponse = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              ...formattedMessages,
              { role: "assistant", content: response.content },
              { role: "user", content: toolResults as any },
            ],
          });

          assistantMessage = secondResponse.content.find((c) => c.type === "text")?.text || "";
        }

        if (assistantMessage) {
          // Send message via Meta WhatsApp
          await sendWhatsAppMessage(customerPhone, assistantMessage, businessId);

          // Save AI reply to Supabase
          const aiTimeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          await supabaseServer.from("messages").insert({
            conversation_id: conversationId,
            sender: "ai",
            text: assistantMessage,
            time: aiTimeStr,
          });
        }
      } catch (err: any) {
        console.error("Error in background closeur agent:", err);
        const fallbackMessage = "Un instant, je reviens vers vous 🙏";
        await sendWhatsAppMessage(customerPhone, fallbackMessage, businessId);

        const aiTimeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        await supabaseServer.from("messages").insert({
          conversation_id: conversationId,
          sender: "ai",
          text: `[Erreur Technique: ${err.message || err}] ${fallbackMessage}`,
          time: aiTimeStr,
        });
      }
    };

    // Run closeur agent to handle Meta timeout policy and simulate typing
    if ((req as any).waitUntil) {
      (req as any).waitUntil(runCloseurAgent());
    } else {
      await runCloseurAgent();
    }

    return NextResponse.json({ status: "success", message: "Incoming message processed. AI Closeur responding in background." });
  } catch (error: any) {
    console.error("Error in webhook POST route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
