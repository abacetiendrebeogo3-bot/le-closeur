import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { businessId, date } = await req.json();

    if (!businessId || !date) {
      return NextResponse.json({ error: "Parameters businessId and date are required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Clé API Anthropic manquante" }, { status: 500 });
    }

    // 1. Fetch journal entries of last 7 days
    const sevenDaysAgo = new Date(date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: journals } = await supabaseServer
      .from("journal_entries")
      .select("date, contenu")
      .eq("business_id", businessId)
      .gte("date", sevenDaysAgoStr)
      .lte("date", date)
      .order("date", { ascending: false });

    // 2. Fetch finance daily entries of today + settings
    const { data: financeToday } = await supabaseServer
      .from("finance_daily_entries")
      .select("*")
      .eq("business_id", businessId)
      .eq("date", date)
      .maybeSingle();

    const { data: financeSettings } = await supabaseServer
      .from("finance_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    // 3. Fetch count of orders to deliver / in progress for today
    const { data: todayOrders } = await supabaseServer
      .from("orders")
      .select("status, payment_status")
      .eq("business_id", businessId)
      .eq("date", date);

    const pendingOrdersCount = (todayOrders || []).filter(
      (o: any) => o.status !== "cancelled" && o.status !== "paid" && o.payment_status !== "paid"
    ).length;

    // 4. Construct prompt for Claude
    const journalText = (journals || []).map((j: any) => `Date: ${j.date}\nEntrée: ${j.contenu}`).join("\n\n");
    
    const context = {
      date,
      journal_entries_last_7_days: journalText || "Aucune note récente.",
      finance_aujourd_hui: financeToday ? {
        objectif_ca: financeToday.objectif_ca,
        ca_realise: financeToday.ca_realise,
        depenses: financeToday.depenses,
        commentaire_ia: financeToday.commentaire_ia
      } : "Aucun bilan financier pour aujourd'hui.",
      repartition_settings: financeSettings?.repartition || "Défaut : 10/40/40/10",
      commandes_en_cours_ou_a_livrer_aujourd_hui: pendingOrdersCount
    };

    const systemPrompt = `Tu es un assistant d'exploitation de direction de projet. À partir du contexte réel fourni (notes libres du journal de l'utilisateur, état financier, commandes à livrer), génère une liste de 3 à 6 actions / tâches prioritaires, concrètes et opérationnelles pour la journée.

RÈGLES STRICTES :
- Ne propose QUE des tâches directement reliées aux données fournies (ex. si le journal mentionne 'vérifier la livraison de Mme X', ou si les chiffres montrent que les dépenses Ads sont trop élevées par rapport au CA, ou s'il y a des commandes en attente).
- Reste factuel, précis et opérationnel. Pas de grands conseils théoriques ou de phrases de motivation d'école de commerce.
- Renvoie uniquement les tâches sous forme de liste de lignes textuelles brutes, une par ligne, sans puces de numérotation, sans introduction ni conclusion.`;

    const userMessage = `Voici le contexte d'exploitation de la journée :
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\``;

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.2
    });

    const outputText = (message.content[0] as any)?.text?.trim() || "";
    const items = outputText
      .split("\n")
      .map((line: string) => line.replace(/^[-*+\d.]\s*/, "").trim())
      .filter((line: string) => line.length > 0);

    // 5. Save generated todos in database
    if (items.length > 0) {
      const inserts = items.map((it: string) => ({
        business_id: businessId,
        date: date,
        item: it,
        done: false,
        source: "ia"
      }));

      const { error: insertErr } = await supabaseServer
        .from("daily_todos")
        .insert(inserts);

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error("Error generating todos from journal:", err);
    return NextResponse.json({ error: err.message || "Failed to generate tasks" }, { status: 500 });
  }
}
