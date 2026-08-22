import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/whatsapp/send";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder-anthropic-key",
});

// Model wrapper to intercept Translated Model Name
const originalCreate = anthropic.messages.create.bind(anthropic.messages);
anthropic.messages.create = function (params: any, options?: any) {
  console.log("MODELE UTILISE:", params.model);
  return originalCreate(params, options);
} as any;

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
      const audioReply = "Je ne peux pas encore lire les messages vocaux. Pouvez-vous m'écrire par texte s'il vous plaît ?";
      await sendWhatsAppMessage(customerPhone, audioReply, businessId);
      
      const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      await supabaseServer.from("messages").insert({
        conversation_id: conversationId,
        sender: "customer",
        text: "[Message vocal reçu]",
        time: timeStr,
      });

      return NextResponse.json({ status: "success", message: "Audio message processed." });
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

    // Fetch Products
    const { data: rawProducts } = await supabaseServer
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true);

    const products = (rawProducts || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      stock: p.stock,
      active: p.active,
      category: p.category
    }));

    // Fetch Delivery Zones
    const { data: zones } = await supabaseServer
      .from("delivery_zones")
      .select("*")
      .eq("business_id", businessId);

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

[STYLE DE CONVERSATION]
- Écris des messages courts, comme sur WhatsApp (2-4 phrases maximum par message, jamais de pavé de texte).
- Pose UNE SEULE question à la fois, jamais plusieurs questions dans le même message.
- Utilise un ton naturel et chaleureux, pas robotique.
- Utilise des emojis avec modération pour rester engageant.

[IDENTITÉ ET RÔLE]
${identity}

[TON CONVERSATIONNEL]
${tone}

[RÈGLES DE VENTE]
${salesRules}
- IMPORTANT : Ne jamais négocier les prix à la baisse ou offrir des remises non autorisées.
- Ne propose que les produits disponibles dans le catalogue ci-dessous.
- RÈGLE ABSOLUE : Ne demande JAMAIS son numéro de téléphone au client. Le système le connaît automatiquement depuis son numéro WhatsApp et l'outil create_order l'obtiendra automatiquement.
${returningCustomerContext}

[RÈGLES D'ESCALADE / REPRISE HUMAINE]
${escalationRules}
- Si les règles d'escalade sont déclenchées ou si le client demande expressément à parler à un humain/conseiller/responsable, appelle l'outil 'escalate_to_human'.

[OUTILS DISPONIBLES ET LEUR USAGE]
Tu as accès à des outils. Utilise-les dès que nécessaire :
- Pour chercher des produits, utilise 'search_products'.
- Pour vérifier le coût et le délai d'une zone de livraison, utilise 'check_delivery_zone'.
- Pour enregistrer la commande finale du client, utilise 'create_order'.
- Pour vérifier le statut d'une commande existante, utilise 'get_order_status'.
- Pour transférer à un humain, utilise 'escalate_to_human'.
- Pour envoyer une photo/témoignage, utilise 'send_product_visual'.

[CATALOGUE PRODUITS ACTUEL]
${JSON.stringify(products || [], null, 2)}

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

    const formattedMessages: any[] = historyToMap.map((m: any) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    // Append current incoming message (with image visual content if applicable)
    if (messageObject.type === "image" && base64Data) {
      formattedMessages.push({
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
      formattedMessages.push({
        role: "user" as const,
        content: messageText || ""
      });
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
            zone_name: { type: "string", description: "Le nom de la zone de livraison (ex: Medina, Almadies, Plateau, Yoff, Pikine)." },
          },
          required: ["zone_name"],
        },
      },
      {
        name: "create_order",
        description: "Crée une commande ferme dans la base de données Supabase.",
        input_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Nom complet du client." },
            customer_address: { type: "string", description: "Adresse physique exacte pour la livraison." },
            delivery_zone: { type: "string", description: "Nom de la zone de livraison validée." },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string", description: "Nom exact du produit." },
                  quantity: { type: "number", description: "Quantité désirée." },
                },
                required: ["product_name", "quantity"],
              },
            },
          },
          required: ["customer_name", "delivery_zone", "items"],
        },
      },
      {
        name: "get_order_status",
        description: "Récupère le statut actuel d'une commande via son ID de commande.",
        input_schema: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "L'identifiant de la commande (ex: CMD-2026-001)." },
          },
          required: ["order_id"],
        },
      },
      {
        name: "escalate_to_human",
        description: "Transfère immédiatement la discussion à un conseiller humain (reprise manuelle).",
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
        description: "Envoie un visuel produit ou un témoignage client au format image sur le WhatsApp du client.",
        input_schema: {
          type: "object",
          properties: {
            image_type: { 
              type: "string", 
              description: "Le type de visuel à envoyer (ex: 'produit', 'temoignage_1', 'temoignage_2', etc. selon la bibliothèque de médias)." 
            },
            caption: {
              type: "string",
              description: "Une légende explicative courte à joindre avec l'image."
            }
          },
          required: ["image_type"],
        },
      },
    ];

    // Call Anthropic
    let response = await anthropic.messages.create({
      model: "claude-sonnet-5",
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
            await updateCustomerTag("intéressé");
            const queryStr = (input.query || "").toLowerCase();
            const filteredProducts = (products || []).filter(
              (p) =>
                p.name.toLowerCase().includes(queryStr) ||
                p.category.toLowerCase().includes(queryStr)
            );
            resultData = { products: filteredProducts };
          } else if (name === "check_delivery_zone") {
            await updateCustomerTag("intéressé");
            const zName = (input.zone_name || "").toLowerCase();
            const matchedZone = (zones || []).find((z) =>
              z.name.toLowerCase().includes(zName)
            );
            if (matchedZone) {
              resultData = { found: true, zone: matchedZone };
            } else {
              resultData = { found: false, error: "Zone non trouvée. Veuillez choisir parmi les zones disponibles." };
            }
          } else if (name === "get_order_status") {
            const { data: order } = await supabaseServer
              .from("orders")
              .select("*")
              .eq("id", input.order_id)
              .maybeSingle();

            if (order) {
              resultData = { found: true, status: order.status, payment_status: order.payment_status, total: order.total };
            } else {
              resultData = { found: false, error: "Commande non trouvée." };
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
            const captionStr = input.caption || "";
            const mediaLib = business?.agent_media_library as Record<string, string> || {};
            const imageUrl = mediaLib[imgType];

            if (imageUrl) {
              const success = await sendWhatsAppImage(customerPhone, imageUrl, captionStr, businessId);
              
              // Save visually sent image message in history
              const msgTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              await supabaseServer.from("messages").insert({
                conversation_id: conversationId,
                sender: "ai",
                text: `[Image envoyée : ${imgType}] ${imageUrl}`,
                time: msgTime
              });

              resultData = { success, message: `Image '${imgType}' envoyée avec succès.` };
            } else {
              resultData = { success: false, error: `Type d'image '${imgType}' non configuré dans la bibliothèque de médias.` };
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
        model: "claude-sonnet-5",
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

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Error in webhook POST route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
