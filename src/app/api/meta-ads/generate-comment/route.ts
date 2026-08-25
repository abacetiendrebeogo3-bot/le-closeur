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

    // 2. Fetch daily ad insights
    const { data: adsInsights } = await supabaseServer
      .from("ads_daily_insights")
      .select("*")
      .eq("business_id", businessId)
      .eq("date", date);

    if (!adsInsights || adsInsights.length === 0) {
      return NextResponse.json({ error: "Aucune donnée publicitaire enregistrée pour cette date." }, { status: 404 });
    }

    // 3. Fetch daily finance entry
    const { data: financeToday } = await supabaseServer
      .from("finance_daily_entries")
      .select("ca_realise, depenses")
      .eq("business_id", businessId)
      .eq("date", date)
      .maybeSingle();

    // 4. Construct prompt for Claude
    const contextPayload = {
      date: date,
      business_name: businessName,
      campagnes_publicitaires: adsInsights.map((ad: any) => ({
        nom_campagne: ad.campaign_name,
        depense: ad.spend,
        clics: ad.clicks,
        impressions: ad.impressions,
        cpc: ad.cpc,
        ctr: ad.ctr,
        conversions_ou_resultats: ad.results
      })),
      finance_du_jour: financeToday ? {
        ca_realise: financeToday.ca_realise,
        depenses_pub_manuelles: financeToday.depenses?.pub || 0
      } : null
    };

    const systemPrompt = `Tu es l'analyste traffic manager et contrôleur de gestion publicitaire de ${businessName}. Chaque soir, tu reçois les données de performance réelles des campagnes Meta publicitaires de la journée. Ton rôle : donner une lecture honnête, pragmatique et directe des performances, comme si tu t'adressais au fondateur.

RÈGLES STRICTES :
- Analyse uniquement les campagnes fournies dans le contexte (dépenses, clics, impressions, CPC, CTR, résultats/conversions).
- Sois direct et concret. Si le coût d'acquisition ou le CPC est anormalement haut, ou le CTR trop bas (ex. sous 1%), indique-le directement par campagne sans ménager l'utilisateur.
- Identifie les campagnes qui mangent le budget sans apporter de résultats et celles qui performent le mieux.
- Reste bref : 3 à 5 phrases maximum.
- Pas de langue de bois ou d'encouragement généraliste.`;

    const userMessage = `Voici les données publicitaires du jour à analyser :
\`\`\`json
${JSON.stringify(contextPayload, null, 2)}
\`\`\``;

    // 5. Call Claude
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.1
    });

    const commentText = (message.content[0] as any)?.text?.trim() || "";

    // 6. Save comment in finance_daily_entries. If no daily entry exists, create one
    const { data: existingEntry } = await supabaseServer
      .from("finance_daily_entries")
      .select("id")
      .eq("business_id", businessId)
      .eq("date", date)
      .maybeSingle();

    if (existingEntry) {
      await supabaseServer
        .from("finance_daily_entries")
        .update({ commentaire_ads_ia: commentText })
        .eq("id", existingEntry.id);
    } else {
      await supabaseServer
        .from("finance_daily_entries")
        .insert({
          business_id: businessId,
          date: date,
          ca_realise: 0,
          depenses: { pub: 0, stock: 0, livraison: 0, salaires: 0, autres: 0 },
          commentaire_ads_ia: commentText
        });
    }

    return NextResponse.json({ success: true, comment: commentText });
  } catch (err: any) {
    console.error("Error in meta ads generate comment route:", err);
    return NextResponse.json({ error: err.message || "Failed to generate ad critique" }, { status: 500 });
  }
}
