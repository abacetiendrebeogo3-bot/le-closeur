import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    // Verify Vercel Cron Signature in production
    if (process.env.VERCEL_ENV === "production") {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    console.log(`Cron finance CFO comments triggered for date: ${todayStr}`);

    // Fetch all active businesses
    const { data: businesses, error: busErr } = await supabaseServer
      .from("businesses")
      .select("id, name");

    if (busErr || !businesses) {
      console.error("Error fetching businesses for finance cron:", busErr);
      return NextResponse.json({ error: "Failed to fetch businesses" }, { status: 500 });
    }

    let generatedCount = 0;

    for (const bus of businesses) {
      const businessId = bus.id;
      const businessName = bus.name;

      // 1. Fetch daily entry for today
      const { data: entry, error: entryErr } = await supabaseServer
        .from("finance_daily_entries")
        .select("*")
        .eq("business_id", businessId)
        .eq("date", todayStr)
        .maybeSingle();

      // Only generate if entry exists and commentaire_ia is empty
      if (entry && !entry.commentaire_ia) {
        try {
          // 2. Fetch history (last 30 days)
          const { data: historyData } = await supabaseServer
            .from("finance_daily_entries")
            .select("date, ca_realise, depenses")
            .eq("business_id", businessId)
            .lt("date", todayStr)
            .order("date", { ascending: false })
            .limit(30);

          const historyList = (historyData || []).reverse().map((h: any) => {
            const depTotal = 
              (h.depenses?.pub ?? 0) + 
              (h.depenses?.stock ?? 0) + 
              (h.depenses?.livraison ?? 0) + 
              (h.depenses?.salaires ?? 0) + 
              (h.depenses?.autres ?? 0);
            return h.ca_realise - depTotal;
          });

          // 3. Fetch finance settings
          const { data: settings } = await supabaseServer
            .from("finance_settings")
            .select("*")
            .eq("business_id", businessId)
            .maybeSingle();

          const defaults = {
            repartition: { reserve_entreprise: 10, part_perso: 40, reinvestissement: 40, tampon: 10 },
            seuils_alerte: { marge_orange: 15, marge_rouge: 5, jours_deficit_rouge: 3 }
          };

          const seuils = settings?.seuils_alerte || defaults.seuils_alerte;

          const pubDep = entry.depenses?.pub ?? 0;
          const stockDep = entry.depenses?.stock ?? 0;
          const livrDep = entry.depenses?.livraison ?? 0;
          const salDep = entry.depenses?.salaires ?? 0;
          const autDep = entry.depenses?.autres ?? 0;

          const totalDepenses = pubDep + stockDep + livrDep + salDep + autDep;
          const beneficeNet = entry.ca_realise - totalDepenses;

          const contextPayload = {
            date: todayStr,
            objectif_ca: entry.objectif_ca,
            objectif_benefice: entry.objectif_benefice,
            ca_realise: entry.ca_realise,
            depenses: {
              pub: pubDep,
              stock: stockDep,
              livraison: livrDep,
              salaires: salDep,
              autres: autDep
            },
            benefice_net: beneficeNet,
            historique_recents_benefices: historyList,
            seuils_alerte: seuils
          };

          const systemPrompt = `Tu es le directeur financier de ${businessName}. Chaque soir, tu reçois les chiffres réels de la journée et de l'historique récent. Ton rôle : donner une lecture honnête et directe de la situation, comme un DG s'adresserait à son fondateur — pas un chatbot motivant, pas de langue de bois.

RÈGLES STRICTES :
- Tu ne commentes que les chiffres fournis dans le contexte (CA du jour, dépenses par catégorie, bénéfice net, objectif, historique des 7-30 derniers jours, seuils d'alerte définis par l'utilisateur). Tu ne inventes jamais un chiffre, une tendance ou une comparaison que les données ne permettent pas de calculer.
- Si l'objectif n'est pas atteint, dis-le clairement et identifie la cause la plus probable dans les données (ex. dépenses pub en hausse sans hausse de CA correspondante) plutôt qu'un encouragement générique.
- Si l'entreprise est en zone rouge/orange selon les seuils définis, le dis en premier, sans minimiser.
- Reste bref : 3 à 5 phrases maximum, format lisible en 20 secondes le soir.
- Pas de conseil financier générique de manuel ("épargnez 20% de vos revenus") — uniquement des observations liées aux chiffres réels de cette entreprise.
- Ton factuel et direct, pas de flatterie ni de dramatisation.`;

          const userMessage = `Voici les données financières du jour à analyser :
\`\`\`json
${JSON.stringify(contextPayload, null, 2)}
\`\`\``;

          const message = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 400,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
            temperature: 0.1
          });

          const commentText = (message.content[0] as any)?.text?.trim() || "";

          // Update DB record
          await supabaseServer
            .from("finance_daily_entries")
            .update({ commentaire_ia: commentText })
            .eq("id", entry.id);

          generatedCount++;
        } catch (err) {
          console.error(`Error generating CFO comment for business ${businessId}:`, err);
        }
      }
    }

    return NextResponse.json({ status: "success", generated: generatedCount });
  } catch (error: any) {
    console.error("Error running Cron finance CFO route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
