import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder-anthropic-key",
});

const DEFAULT_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";

// Verify Signature from Meta (X-Hub-Signature-256)
function verifySignature(payload: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("WHATSAPP_APP_SECRET is not configured.");
    return false;
  }

  // Signature is in the format 'sha256=signature_value'
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const signature = parts[1];
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// GET Handler: Webhook verification
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
      if (token === verifyToken) {
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
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    // Verify signature
    if (!verifySignature(rawBody, signatureHeader)) {
      console.warn("Signature verification failed.");
      return NextResponse.json({ error: "Unauthorized signature validation failed" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Meta Webhook returns messages nested inside: entry -> changes -> value -> messages
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObject = value?.messages?.[0];

    // If it's not a message (could be a status update, delivery report, etc.), return 200 OK immediately
    if (!messageObject) {
      return NextResponse.json({ status: "ignored_non_message_payload" });
    }

    // Only process text messages for now
    if (messageObject.type !== "text") {
      return NextResponse.json({ status: "ignored_non_text_message" });
    }

    const customerPhone = messageObject.from; // e.g. "221776543210" or formatted phone
    const messageText = messageObject.text?.body;
    const contactName = value?.contacts?.[0]?.profile?.name || customerPhone;

    if (!messageText) {
      return NextResponse.json({ status: "ignored_empty_message" });
    }

    // Ensure customer exists in Supabase
    const { data: customer, error: customerFetchErr } = await supabaseServer
      .from("customers")
      .select("*")
      .eq("phone", customerPhone)
      .maybeSingle();

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
          business_id: DEFAULT_BUSINESS_ID,
          name: contactName,
          phone: customerPhone,
          first_contact: new Date().toLocaleDateString("fr-FR"),
          tags: ["WhatsApp"],
        })
        .select()
        .single();

      if (createCustErr) {
        console.error("Error creating customer in Supabase:", createCustErr);
        // Fallback to the generated ID even if insert failed (maybe RLS issue or conflict)
        customerId = newCustId;
      } else {
        customerId = newCust?.id;
      }
    }

    // Find or create conversation
    let { data: conversation, error: convFetchErr } = await supabaseServer
      .from("conversations")
      .select("*")
      .eq("customer_phone", customerPhone)
      .eq("business_id", DEFAULT_BUSINESS_ID)
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
          business_id: DEFAULT_BUSINESS_ID,
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

    // Save incoming message
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const { error: msgInsertErr } = await supabaseServer.from("messages").insert({
      conversation_id: conversationId,
      sender: "customer",
      text: messageText,
      time: timeStr,
    });

    if (msgInsertErr) {
      console.error("Error inserting message in Supabase:", msgInsertErr);
    }

    // If human takeover is active, stop here (do not call Claude / send AI reply)
    if (conversation.status === "human_takeover") {
      return NextResponse.json({ status: "success", message: "Conversation in human_takeover mode. AI response skipped." });
    }

    // Generate AI response (using exact same logic as in /api/agent/respond)
    // 1. Fetch Business Config
    const { data: business } = await supabaseServer
      .from("businesses")
      .select("*")
      .eq("id", DEFAULT_BUSINESS_ID)
      .maybeSingle();

    const identity = business?.agent_identity || "Tu es un agent d'aide à la vente.";
    const salesRules = business?.agent_sales_rules || "";
    const escalationRules = business?.agent_escalation_rules || "";
    const tone = business?.agent_tone || "Chaleureux et Respectueux";

    // 2. Fetch Products
    const { data: products } = await supabaseServer
      .from("products")
      .select("*")
      .eq("business_id", DEFAULT_BUSINESS_ID)
      .eq("active", true);

    // 3. Fetch Delivery Zones
    const { data: zones } = await supabaseServer
      .from("delivery_zones")
      .select("*")
      .eq("business_id", DEFAULT_BUSINESS_ID);

    // 4. Construct System Prompt
    const systemPrompt = `Tu es l'agent conversationnel IA intelligent et autonome de vente (closeur) pour l'entreprise "${business?.name || "Notre boutique"}".
Ton but est de conseiller les prospects, de les aider à choisir des produits, de calculer les frais de livraison, et de conclure des ventes (closing) en enregistrant leur commande.

[IDENTITÉ ET RÔLE]
${identity}

[TON CONVERSATIONNEL]
${tone}

[RÈGLES DE VENTE]
${salesRules}
- IMPORTANT : Ne jamais négocier les prix à la baisse ou offrir des remises non autorisées.
- Ne propose que les produits disponibles dans le catalogue ci-dessous.

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

[CATALOGUE PRODUITS ACTUEL]
${JSON.stringify(products || [], null, 2)}

[ZONES DE LIVRAISON DISPONIBLES]
${JSON.stringify(zones || [], null, 2)}
`;

    // 5. Fetch full conversation history from Supabase (to construct prompt)
    const { data: historyMessages } = await supabaseServer
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const formattedMessages: { role: "user" | "assistant"; content: string }[] = (historyMessages || []).map((m: any) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    // 6. Define Tools
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
            customer_phone: { type: "string", description: "Numéro de téléphone WhatsApp du client." },
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
          required: ["customer_name", "customer_phone", "delivery_zone", "items"],
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
    ];

    // Call Anthropic
    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
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
            const queryStr = (input.query || "").toLowerCase();
            const filteredProducts = (products || []).filter(
              (p) =>
                p.name.toLowerCase().includes(queryStr) ||
                p.category.toLowerCase().includes(queryStr)
            );
            resultData = { products: filteredProducts };
          } else if (name === "check_delivery_zone") {
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
              business_id: DEFAULT_BUSINESS_ID,
              customer: input.customer_name,
              customer_phone: input.customer_phone,
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
        model: "claude-3-5-sonnet-latest",
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
      await sendWhatsAppMessage(customerPhone, assistantMessage);

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
