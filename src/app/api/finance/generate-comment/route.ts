import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { businessId, date } = await req.json();

    if (!businessId || !date) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Clé API Anthropic manquante" }, { status: 500 });
    }

    // 1. Fetch Business details
    const { data: business } = await supabaseServer
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle();

    const businessName = business?.name || "Notre boutique";

    // 2. Fetch target daily entry
    const { data: entry } = await supabaseServer
      .from("finance_daily_entries")
      .select("*")
      .eq("business_id", businessId)
      .eq("date", date)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json({ error: "Aucun bilan enregistré pour cette date." }, { status: 404 });
    }

    // 3. Fetch 30-day history
    const { data: historyData } = await supabaseServer
      .from("finance_daily_entries")
      .select("date, ca_realise, depenses")
      .eq("business_id", businessId)
      .lt("date", date)
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

    // 4. Fetch finance settings
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

    // 4.5 Fetch Caisse transactions and calculate cash balance
    const { data: txs } = await supabaseServer
      .from("caisse_transactions")
      .select("type, montant")
      .eq("business_id", businessId);

    const caisseSolde = (txs || []).reduce((acc: number, t: any) => {
      const amt = Number(t.montant) || 0;
      return acc + (t.type === "entree" ? amt : -amt);
    }, 0);

    // Fetch active cash objectives targeting current or future dates
    const { data: objs } = await supabaseServer
      .from("caisse_objectifs")
      .select("montant_cible, label, target_date")
      .eq("business_id", businessId)
      .gte("target_date", date);

    // 5. Construct context for Claude
    const contextPayload = {
      date: date,
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
      seuils_alerte: seuils,
      caisse_solde: caisseSolde,
      objectifs_caisse: objs || []
    };

    const systemPrompt = `Tu es le directeur financier de ${businessName}. Chaque soir, tu reçois les chiffres réels de la journée, le solde actuel de la caisse (liquidités réelles), les objectifs financiers, et l'historique récent. Ton rôle : donner une lecture honnête, directe et factuelle de la situation, comme un DG s'adresserait à son fondateur — pas de langue de bois, pas de flatterie ni de dramatisation.

RÈGLES STRICTES :
- Tu ne commentes que les chiffres fournis dans le contexte (CA, dépenses, bénéfice net, solde de caisse actuel, objectifs de caisse et progression). Tu n'inventes jamais de données.
- Analyse le solde de caisse actuel (disponible en cash réel) par rapport aux objectifs de caisse définis dans "objectifs_caisse" (montant cible et date de fin). Commente si les liquidités réelles permettent d'envisager sereinement l'avenir ou si des coupures de dépenses s'imposent.
- Si un objectif (CA, bénéfice ou caisse) n'est pas atteint, identifie la cause dans les chiffres (ex. hausse des salaires ou du transport, sous-performance des ventes, etc.).
- Reste bref : 3 à 5 phrases maximum, format direct et lisible en 20 secondes.`;

    const userMessage = `Voici les données financières réelles du jour à analyser :
\`\`\`json
${JSON.stringify(contextPayload, null, 2)}
\`\`\``;

    // 6. Call Claude
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.1
    });

    const commentText = (message.content[0] as any)?.text?.trim() || "";

    // 7. Update database record with generated comment
    const { error: updateErr } = await supabaseServer
      .from("finance_daily_entries")
      .update({ commentaire_ia: commentText })
      .eq("id", entry.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, comment: commentText });
  } catch (err: any) {
    console.error("Error in finance generate comment route:", err);
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}
