import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { businessId } = await req.json();

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Clé API Anthropic manquante" }, { status: 500 });
    }

    // 1. Fetch conversations
    const { data: conversations, error: convsError } = await supabaseServer
      .from("conversations")
      .select("id, customer_name, customer_phone")
      .eq("business_id", businessId);

    if (convsError) throw convsError;

    // 2. Fetch all messages for these conversations
    const { data: allMessages, error: msgsError } = await supabaseServer
      .from("messages")
      .select("conversation_id, sender, text, created_at, conversations!inner(business_id)")
      .eq("conversations.business_id", businessId)
      .order("created_at", { ascending: true });

    if (msgsError) throw msgsError;

    const messagesByConv: { [key: number]: any[] } = {};
    for (const msg of (allMessages || [])) {
      if (!messagesByConv[msg.conversation_id]) {
        messagesByConv[msg.conversation_id] = [];
      }
      messagesByConv[msg.conversation_id].push(msg);
    }

    // 3. Identify silent conversations (last message from 'ai' and created > 24 hours ago)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const silentConversations = [];

    for (const conv of (conversations || [])) {
      const msgs = messagesByConv[conv.id] || [];
      if (msgs.length === 0) continue;
      const latestMsg = msgs[msgs.length - 1];
      const msgDate = new Date(latestMsg.created_at);
      if (latestMsg.sender === "ai" && msgDate < cutoff24h) {
        silentConversations.push({
          info: conv,
          messages: msgs,
          latestDate: msgDate
        });
      }
    }

    // 4. Sort by latest message date descending (most recent first) and select top 20
    silentConversations.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
    const selectedConvs = silentConversations.slice(0, 20);

    if (selectedConvs.length === 0) {
      return NextResponse.json({
        analysis: "### Rapport d'analyse du Coach IA\n\nAucune conversation silencieuse (> 24h sans réponse après un message de l'IA) n'a été détectée pour le moment. Félicitations, vos clients restent engagés !"
      });
    }

    // 5. Format transcripts for Claude
    let promptContent = "Voici les transcriptions des conversations silencieuses récentes (où le client a arrêté de répondre après le dernier message de l'IA) :\n\n";

    for (const c of selectedConvs) {
      promptContent += `--- CONVERSATION AVEC ${c.info.customer_name} (${c.info.customer_phone}) ---\n`;
      for (const m of c.messages) {
        promptContent += `[${m.sender === "customer" ? "Client" : "IA"}] : ${m.text}\n`;
      }
      promptContent += "\n";
    }

    // 6. Query Claude for analysis
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: `Tu es un Coach de Vente IA et un expert en Closing Commercial.
Ton rôle est d'analyser les transcriptions de conversations WhatsApp ci-dessous où les clients ont arrêté de répondre (conversations silencieuses).

Consignes strictes :
1. Analyse spécifiquement à quel moment exact ou après quel type de question/réponse de l'IA les clients cessent de répondre (ex: annonce du prix, demande d'adresse de livraison, relance agressive, réponses trop longues, etc.).
2. Identifie des points communs réels et factuels. Ne généralise pas au-delà des exemples fournis. Sois précis et cite des extraits ou des exemples de messages de l'IA qui ont causé le blocage.
3. Propose 2 ou 3 suggestions concrètes et directement applicables pour améliorer les règles de vente ('agent_sales_rules') afin d'éviter ces abandons.
4. Rédige ton analyse en français sous forme de rapport Markdown structuré et professionnel avec des titres clairs. Ne mets aucun texte introductif avant le premier titre Markdown (ex: "Voici l'analyse..."), commence directement par ton rapport.`,
      messages: [{ role: "user", content: promptContent }]
    });

    const textBlock = response.content.find((c: any) => c.type === "text") as any;
    const analysis = textBlock?.text || "Impossible de générer l'analyse.";

    return NextResponse.json({ analysis });
  } catch (err: any) {
    console.error("Coach Analysis API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
