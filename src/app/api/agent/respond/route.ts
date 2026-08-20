import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder-anthropic-key",
});

export async function POST(req: NextRequest) {
  try {
    const { conversationId, text, businessId, messages } = await req.json();

    if (!conversationId || !text || !businessId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Clé API Anthropic manquante" }, { status: 500 });
    }

    // 1. Fetch Business Config
    const { data: business } = await supabaseServer
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    const identity = business?.agent_identity || "Tu es un agent d'aide à la vente.";
    const salesRules = business?.agent_sales_rules || "";
    const escalationRules = business?.agent_escalation_rules || "";
    const tone = business?.agent_tone || "Chaleureux et Respectueux";

    // 2. Fetch Products
    const { data: products } = await supabaseServer
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true);

    // 3. Fetch Delivery Zones
    const { data: zones } = await supabaseServer
      .from("delivery_zones")
      .select("*")
      .eq("business_id", businessId);

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

    // 5. Build conversation history for Claude
    const formattedMessages = (messages || []).map((m: any) => ({
      role: m.sender === "customer" ? "user" : "assistant",
      content: m.text,
    }));

    // Add current user message
    formattedMessages.push({
      role: "user",
      content: text,
    });

    // 6. Define Tools for Anthropic
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
      model: "claude-3-5-sonnet-20241022",
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
              business_id: businessId,
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

      // 7. Get final reply from Claude with tool outputs
      const secondResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
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

    // 8. Store the AI answer in Supabase messages
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    await supabaseServer.from("messages").insert({
      conversation_id: conversationId,
      sender: "ai",
      text: assistantMessage,
      time: timeStr,
    });

    return NextResponse.json({
      text: assistantMessage,
      toolsCalled: toolCalls.map((t) => ({ name: t.name, input: t.input })),
    });
  } catch (error: any) {
    console.error("AI responding API route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
