import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder-anthropic-key",
});

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

      // --- RULE C: RELANCE PROSPECT NON-CONVERTI LE LENDEMAIN MATIN (9h-10h UTC) ---
      const isMorningTime = currentUTCHour >= 9 && currentUTCHour <= 10;
      if (isMorningTime && !order) {
        // Check if last message was sent yesterday (between 12 and 36 hours ago)
        const lastMsgTime = new Date(lastMsg.created_at).getTime();
        const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
        const thirtySixHoursAgo = Date.now() - 36 * 60 * 60 * 1000;

        if (lastMsgTime > thirtySixHoursAgo && lastMsgTime < twelveHoursAgo) {
          // Check if already sent next_morning followup today
          const { data: followupSent } = await supabaseServer
            .from("followup_runs")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("type", "next_morning")
            .eq("target_date", todayStr)
            .maybeSingle();

          if (!followupSent) {
            console.log(`Generating Personalized Morning followup to ${customerPhone} for conv ${conversationId}`);

            // Use Claude to generate a personalized draft based on discussed products
            const formattedHistory = history.map((m) => `${m.sender === "customer" ? "Client" : "Agent"}: ${m.text}`).join("\n");

            try {
              const response = await anthropic.messages.create({
                model: "claude-sonnet-5",
                max_tokens: 150,
                system: "Tu es un agent commercial de suivi client par messagerie. Rédige un message court (1-2 phrases maximum, style WhatsApp, ton naturel, amical et chaleureux) pour reprendre des nouvelles concernant le produit dont le client a discuté hier. Ne dis JAMAIS que tu es une IA ou un robot. Exemple : 'Bonjour, je voulais juste prendre de vos nouvelles concernant le [nom du produit] — je reste à votre disposition si vous avez des questions !'",
                messages: [
                  {
                    role: "user",
                    content: `Voici l'historique de notre conversation d'hier :\n\n${formattedHistory}\n\nRédige uniquement le message de suivi personnalisé prêt à être envoyé au client. Pas de salutations d'en-tête ou de formatage superflu, juste le message brut.`
                  }
                ]
              });

              const morningText = response.content.find((c) => c.type === "text")?.text || "Bonjour, je voulais juste prendre de vos nouvelles — je reste à votre disposition si vous avez des questions ! 😊";
              
              const sent = await sendWhatsAppMessage(customerPhone, morningText, businessId);
              if (sent) {
                const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                await supabaseServer.from("messages").insert({
                  conversation_id: conversationId,
                  sender: "ai",
                  text: morningText,
                  time: timeStr,
                });

                await supabaseServer.from("followup_runs").insert({
                  conversation_id: conversationId,
                  type: "next_morning",
                  target_date: todayStr
                });
                processedCount++;
              }
            } catch (err) {
              console.error("Error running Claude for next_morning followup:", err);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "success", processed: processedCount });
  } catch (error: any) {
    console.error("Error running Cron followups route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
