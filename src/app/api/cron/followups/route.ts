import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    // Verify Vercel Cron Signature if present, or allow execution for local testing
    if (process.env.VERCEL_ENV === "production") {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const now = new Date();
    const currentUTCHour = now.getUTCHours();

    console.log(`Cron followups triggered. Time: ${now.toISOString()}, UTC Hour: ${currentUTCHour}`);

    // Fetch all active conversations
    const { data: conversations, error: convsErr } = await supabaseServer
      .from("conversations")
      .select("*")
      .neq("status", "human_takeover");

    if (convsErr || !conversations) {
      console.error("Error fetching conversations for followup:", convsErr);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    let processedCount = 0;

    for (const conv of conversations) {
      const conversationId = conv.id;
      const customerPhone = conv.customer_phone;
      const businessId = conv.business_id;

      // Fetch business details
      const { data: business } = await supabaseServer
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .maybeSingle();

      if (!business) continue;

      // Fetch messages history
      const { data: history } = await supabaseServer
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!history || history.length === 0) continue;

      // Check if an order exists
      const { data: order } = await supabaseServer
        .from("orders")
        .select("id")
        .eq("chat_id", conversationId)
        .maybeSingle();

      const lastMsg = history[history.length - 1];

      // --- RULE A: RELANCE SILENCE ---
      // Last message is from customer, elapsed > 1 hour, no order created, not yet messaged for this silence
      if (lastMsg.sender === "customer" && !order) {
        const lastMsgTime = new Date(lastMsg.created_at).getTime();
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        if (lastMsgTime < oneHourAgo) {
          // Check if we already followed up for this silence
          const { data: lastSilenceRun } = await supabaseServer
            .from("followup_runs")
            .select("*")
            .eq("conversation_id", conversationId)
            .eq("type", "silence")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const alreadySentForThisSilence = lastSilenceRun && new Date(lastSilenceRun.created_at).getTime() > lastMsgTime;

          if (!alreadySentForThisSilence) {
            const silenceText = "Bonjour, êtes-vous toujours intéressé(e) ? Je reste disponible pour répondre à vos questions 😊";
            console.log(`Sending Silence followup to ${customerPhone} for conv ${conversationId}`);
            
            const sent = await sendWhatsAppMessage(customerPhone, silenceText, businessId);
            if (sent) {
              const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              await supabaseServer.from("messages").insert({
                conversation_id: conversationId,
                sender: "ai",
                text: silenceText,
                time: timeStr,
              });

              await supabaseServer.from("followup_runs").insert({
                conversation_id: conversationId,
                type: "silence",
                target_date: todayStr
              });
              processedCount++;
            }
          }
        }
      }

      // --- RULE B: RELANCE COMMANDE LE SOIR (19h-20h UTC) ---
      const isEveningTime = currentUTCHour >= 19 && currentUTCHour <= 20;
      if (isEveningTime) {
        // Fetch order created today for this conversation
        const { data: todayOrder } = await supabaseServer
          .from("orders")
          .select("id")
          .eq("chat_id", conversationId)
          .eq("date", todayStr)
          .maybeSingle();

        if (todayOrder) {
          // Check if already sent evening_order followup today
          const { data: followupSent } = await supabaseServer
            .from("followup_runs")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("type", "evening_order")
            .eq("target_date", todayStr)
            .maybeSingle();

          if (!followupSent) {
            const eveningText = "Bonjour, avez-vous bien reçu votre commande aujourd'hui ? N'hésitez pas si vous avez besoin d'aide 🙏";
            console.log(`Sending Evening Order followup to ${customerPhone} for conv ${conversationId}`);

            const sent = await sendWhatsAppMessage(customerPhone, eveningText, businessId);
            if (sent) {
              const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              await supabaseServer.from("messages").insert({
                conversation_id: conversationId,
                sender: "ai",
                text: eveningText,
                time: timeStr,
              });

              await supabaseServer.from("followup_runs").insert({
                conversation_id: conversationId,
                type: "evening_order",
                target_date: todayStr
              });
              processedCount++;
            }
          }
        }
      }
      // --- RULE C: RELANCES PROSPECTS MULTI-PALIERS (9h-10h UTC) ---
      const isMorningTime = currentUTCHour >= 9 && currentUTCHour <= 10;
      if (isMorningTime && !order) {
        const lastCustomerMsg = [...history].reverse().find((m) => m.sender === "customer");
        if (lastCustomerMsg) {
          const lastCustomerTime = new Date(lastCustomerMsg.created_at).getTime();
          const elapsedMs = Date.now() - lastCustomerTime;
          const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

          const daySteps = [
            { days: 21, type: "day_21" },
            { days: 15, type: "day_15" },
            { days: 12, type: "day_12" },
            { days: 7, type: "day_7" },
            { days: 5, type: "day_5" },
            { days: 3, type: "day_3" },
            { days: 1, type: "next_morning" }, // Keep next_morning for backward compatibility (J1)
          ];

          // Find the highest step matching elapsedDays
          const activeStepToTrigger = daySteps.find(step => elapsedDays >= step.days);

          if (activeStepToTrigger) {
            // Check if already sent this followup
            const { data: followupSent } = await supabaseServer
              .from("followup_runs")
              .select("id")
              .eq("conversation_id", conversationId)
              .eq("type", activeStepToTrigger.type)
              .maybeSingle();

            if (!followupSent) {
              let followupText = "";
              const delayValue = activeStepToTrigger.days;

              // Query supabase for active template for this delay
              const { data: dbTemplate } = await supabaseServer
                .from("followup_steps")
                .select("message_text")
                .eq("business_id", businessId)
                .eq("delay_value", delayValue)
                .eq("delay_unit", "days")
                .eq("active", true)
                .maybeSingle();

              if (dbTemplate && dbTemplate.message_text) {
                const firstName = conv.customer_name ? conv.customer_name.split(" ")[0] : "client";
                followupText = dbTemplate.message_text
                  .replace(/\{name\}/g, firstName)
                  .replace(/\{\{name\}\}/g, firstName);
                console.log(`Using active database template for J${delayValue} followup to ${customerPhone}`);
              } else {
                // Fallback to Claude personalized generation
                console.log(`No active DB template for J${delayValue}. Generating personalized followup via Claude.`);
                const formattedHistory = history.map((m) => `${m.sender === "customer" ? "Client" : "Agent"}: ${m.text}`).join("\n");
                
                try {
                  const systemPrompt = delayValue === 1 
                    ? "Tu es un agent commercial de suivi client par messagerie. Rédige un message court (1-2 phrases maximum, style WhatsApp, ton naturel, amical et chaleureux) pour reprendre des nouvelles concernant le produit dont le client a discuté hier. Ne dis JAMAIS que tu es une IA ou un robot. Exemple : 'Bonjour, je voulais juste prendre de vos nouvelles concernant le [nom du produit] — je reste à votre disposition si vous avez des questions !'"
                    : `Tu es un agent commercial de suivi client par messagerie. Rédige un message court (1-2 phrases maximum, style WhatsApp, ton naturel, amical et chaleureux) pour relancer gentiment un prospect qui n'a pas répondu depuis ${delayValue} jours concernant les produits de notre catalogue. Ne dis JAMAIS que tu es une IA.`;

                  const userContent = delayValue === 1
                    ? `Voici l'historique de notre conversation d'hier :\n\n${formattedHistory}\n\nRédige uniquement le message de suivi personnalisé prêt à être envoyé au client. Pas de salutations d'en-tête ou de formatage superflu, juste le message brut.`
                    : `Voici l'historique de la conversation :\n\n${formattedHistory}\n\nRédige uniquement le message de relance amical et court, sans en-tête ni fioritures.`;

                  const response = await anthropic.messages.create({
                    model: CLAUDE_MODEL,
                    max_tokens: 150,
                    system: systemPrompt,
                    messages: [
                      { role: "user", content: userContent }
                    ]
                  });
                  
                  followupText = response.content.find((c) => c.type === "text")?.text || "";
                } catch (err) {
                  console.error(`Error running Claude for J${delayValue} followup fallback:`, err);
                }
              }

              if (followupText) {
                const sent = await sendWhatsAppMessage(customerPhone, followupText, businessId);
                if (sent) {
                  const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                  await supabaseServer.from("messages").insert({
                    conversation_id: conversationId,
                    sender: "ai",
                    text: followupText,
                    time: timeStr,
                  });

                  await supabaseServer.from("followup_runs").insert({
                    conversation_id: conversationId,
                    type: activeStepToTrigger.type,
                    target_date: todayStr
                  });
                  processedCount++;
                }
              }
            }
          }
        }
      }

      // --- RULE D: AUTOMATICALLY MARK AS FROID AFTER 24H INACTIVITY FROM CLIENT ---
      if (lastMsg.sender === "ai" && !order) {
        const lastMsgTime = new Date(lastMsg.created_at).getTime();
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (lastMsgTime < twentyFourHoursAgo && conv.engagement_status !== "froid") {
          await supabaseServer
            .from("conversations")
            .update({ engagement_status: "froid" })
            .eq("id", conversationId);
          console.log(`Conversation ${conversationId} marked as 'froid' due to 24h+ client inactivity after agent message`);
        }
      }
    }

    return NextResponse.json({ status: "success", processed: processedCount });
  } catch (error: any) {
    console.error("Error running Cron followups route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
