import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

// Helper to save message safely to DB (preventing base64 or long messages from bloating DB / client)
async function saveMessageSafe(
  conversationId: string,
  sender: "ai" | "customer" | "system",
  text: string,
  time: string
) {
  let textToSave = text || "";
  const isTooLong = textToSave.length > 2000;
  const hasBase64 = textToSave.toLowerCase().includes("base64") || textToSave.includes("data:");
  
  if (isTooLong || hasBase64) {
    console.error(`[CRITICAL] Message safety check triggered in respond API! Length: ${textToSave.length}, Contains base64: ${hasBase64}. Blocked contents.`);
    textToSave = "Un instant, je vous transmets ça 🙏";
  }

  return await supabaseServer.from("messages").insert({
    conversation_id: conversationId,
    sender,
    text: textToSave,
    time
  });
}

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

    // 3. Fetch Delivery Zones
    const { data: zones } = await supabaseServer
      .from("delivery_zones")
      .select("*")
      .eq("business_id", businessId);

    // 4. Fetch Knowledge Base
    const { data: kbData } = await supabaseServer
      .from("agent_knowledge_base")
      .select("question, reponse")
      .eq("business_id", businessId)
      .eq("active", true);

    const formattedKB = (kbData || [])
      .map((k: any) => `Q: ${k.question}\nR: ${k.reponse}`)
      .join("\n\n");

    // 5. Fetch Auto Rules
    const { data: rulesData } = await supabaseServer
      .from("agent_rules")
      .select("condition, action")
      .eq("business_id", businessId)
      .eq("active", true);

    const formattedRules = (rulesData || [])
      .map((r: any) => `Si ${r.condition}, alors ${r.action}.`)
      .join("\n");

    // 6. Construct System Prompt
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
- RÈGLES DE VALIDATION DE COMMANDE DIRECTES : Dès que le client exprime de l'intérêt ou choisit un produit, récapitule immédiatement la commande (Produit, prix, zone de livraison) et demande sa confirmation (ex: "C'est noté, je vous livre le Kit Minceur à 6 500F à Benego. C'est bien cela ?").
- Pas de questions répétitives ou de demandes d'informations géographiques redondantes. Si le client mentionne un quartier (ex: "Benego"), ne pose plus de questions de précision sur le quartier (comme "c'est où?", "quartier, repère?") avant d'enregistrer la commande. Valide directement. Une fois qu'il confirme la commande par "Oui", appelle immédiatement l'outil "create_order" pour enregistrer la commande.

[RÈGLES D'EXTRACTION DE CONTEXTE - ABSOLUES]
- Si le client a déjà fourni son nom (ex: "Je m'appelle Amadou") ou son quartier/adresse (ex: "Je suis à Benego") dans l'historique de la conversation, tu ne dois JAMAIS lui redemander ces informations. Déduis-les directement de l'historique et utilise-les pour remplir les arguments des outils ou valider la commande.
- Ne reconfirme pas non plus inutilement des informations déjà clairement validées. Sois direct et fluide.

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

[RÈGLES AUTOMATIQUES (SI/ALORS)]
${formattedRules || "Aucune règle automatique définie."}

[RÈGLES D'ESCALADE / REPRISE HUMAINE]
${escalationRules}
- Si les règles d'escalade sont déclenchées ou si le client demande expressément à parler à un humain/conseiller/responsable, appelle l'outil 'escalate_to_human'.

[BASE DE CONNAISSANCES]
${formattedKB || "Aucune information supplémentaire dans la base de connaissances."}

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

    // 5. Build conversation history for Claude (server-side safety limit to 20 messages)
    const limitedMessages = (messages || []).slice(-20);
    const rawHistory = [
      ...limitedMessages.map((m: any) => {
        let cleanText = m.text || "";
        if (cleanText.startsWith("[WA_MSG_ID: ")) {
          const index = cleanText.indexOf("]");
          if (index !== -1) {
            cleanText = cleanText.substring(index + 1).trim();
          }
        }
        return {
          role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
          content: cleanText,
        };
      }),
      {
        role: "user" as const,
        content: text,
      }
    ];

    const formattedMessages: any[] = [];
    for (const msg of rawHistory) {
      if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === msg.role) {
        formattedMessages[formattedMessages.length - 1].content += "\n" + msg.content;
      } else {
        formattedMessages.push({ role: msg.role, content: msg.content });
      }
    }

    while (formattedMessages.length > 0 && formattedMessages[0].role === "assistant") {
      formattedMessages.shift();
    }

    // Helper to update tags dynamically
    const updateCustomerTag = async (newTag: string) => {
      try {
        const { data: conv } = await supabaseServer
          .from("conversations")
          .select("customer_phone")
          .eq("id", conversationId)
          .maybeSingle();

        if (conv) {
          const { data: cust } = await supabaseServer
            .from("customers")
            .select("id, tags")
            .eq("phone", conv.customer_phone)
            .eq("business_id", businessId)
            .maybeSingle();

          if (cust) {
            const tagsList = cust.tags || [];
            if (!tagsList.includes(newTag)) {
              await supabaseServer
                .from("customers")
                .update({ tags: [...tagsList, newTag] })
                .eq("id", cust.id);
            }
          }
        }
      } catch (err) {
        console.error("Error updating customer tag:", err);
      }
    };

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
        },
        cache_control: { type: "ephemeral" }
      } as any
    ];

    // Call Anthropic with explicit prompt caching
    let response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }
      ] as any,
      messages: formattedMessages,
      tools: tools,
    } as any);

    console.log("[USAGE]", {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cache_write: response.usage.cache_creation_input_tokens,
      cache_read: response.usage.cache_read_input_tokens,
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

            if (imageUrl && !imageUrl.startsWith("data:")) {
              resultData = { success: true, message: `Image envoyée (simulation). URL: ${imageUrl}` };
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
              customer_phone: input.customer_phone,
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

      // 7. Get final reply from Claude with tool outputs (with prompt caching)
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
        tools: tools,
      } as any);

      console.log("[USAGE]", {
        input: secondResponse.usage.input_tokens,
        output: secondResponse.usage.output_tokens,
        cache_write: secondResponse.usage.cache_creation_input_tokens,
        cache_read: secondResponse.usage.cache_read_input_tokens,
      });

      assistantMessage = secondResponse.content.find((c) => c.type === "text")?.text || "";
    }

    // 8. Store the AI answer in Supabase messages safely
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    await saveMessageSafe(conversationId, "ai", assistantMessage, timeStr);

    return NextResponse.json({
      text: assistantMessage,
      toolsCalled: toolCalls.map((t) => ({ name: t.name, input: t.input })),
    });
  } catch (error: any) {
    console.error("AI responding API route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
