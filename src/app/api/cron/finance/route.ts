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
    console.log(`Cron finance CFO & Ads comments triggered for date: ${todayStr}`);

    // Fetch all active businesses
    const { data: businesses, error: busErr } = await supabaseServer
      .from("businesses")
      .select("id, name, meta_ads_access_token, meta_ads_account_id");

    if (busErr || !businesses) {
      console.error("Error fetching businesses for finance cron:", busErr);
      return NextResponse.json({ error: "Failed to fetch businesses" }, { status: 500 });
    }

    let generatedCfoCount = 0;
    let generatedAdsCount = 0;

    for (const bus of businesses) {
      const businessId = bus.id;
      const businessName = bus.name;

      // ----------------------------------------------------
      // SECTION A: CFO FINANCIAL COMMENTARY
      // ----------------------------------------------------
      const { data: entry } = await supabaseServer
        .from("finance_daily_entries")
        .select("*")
        .eq("business_id", businessId)
        .eq("date", todayStr)
        .maybeSingle();

      if (entry && !entry.commentaire_ia) {
        try {
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
- Reste bref : 3 à 5 sentences maximum, format lisible en 20 secondes le soir.
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

          await supabaseServer
            .from("finance_daily_entries")
            .update({ commentaire_ia: commentText })
            .eq("id", entry.id);

          generatedCfoCount++;
        } catch (err) {
          console.error(`Error generating CFO comment for business ${businessId}:`, err);
        }
      }

      // ----------------------------------------------------
      // SECTION B: META ADS FETCH & ANALYSIS
      // ----------------------------------------------------
      if (bus.meta_ads_access_token && bus.meta_ads_account_id) {
        try {
          const accessToken = bus.meta_ads_access_token;
          const rawAccountId = bus.meta_ads_account_id.trim();
          const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;

          // 1. Fetch Insights
          const timeRange = JSON.stringify({ since: todayStr, until: todayStr });
          const url = new URL(`https://graph.facebook.com/v19.0/${adAccountId}/insights`);
          url.searchParams.set("fields", "campaign_name,campaign_id,spend,clicks,impressions,cpc,ctr,actions");
          url.searchParams.set("time_range", timeRange);
          url.searchParams.set("level", "campaign");
          url.searchParams.set("access_token", accessToken);

          const response = await fetch(url.toString());
          const data = await response.json();

          if (response.ok && data.data && data.data.length > 0) {
            const adsInsights = data.data;

            // 2. Save insights
            for (const item of adsInsights) {
              const campaignId = item.campaign_id;
              const campaignName = item.campaign_name;
              const spend = parseFloat(item.spend) || 0;
              const clicks = parseInt(item.clicks) || 0;
              const impressions = parseInt(item.impressions) || 0;
              const cpc = parseFloat(item.cpc) || 0;
              const ctr = parseFloat(item.ctr) || 0;

              let results = 0;
              if (item.actions && Array.isArray(item.actions)) {
                const messageAction = item.actions.find(
                  (act: any) =>
                    act.action_type === "onsite_conversion.messaging_first_reply" ||
                    act.action_type === "link_click" ||
                    act.action_type === "lead"
                );
                results = messageAction ? parseInt(messageAction.value) || 0 : 0;
              }

              await supabaseServer
                .from("ads_daily_insights")
                .upsert({
                  business_id: businessId,
                  date: todayStr,
                  campaign_id: campaignId,
                  campaign_name: campaignName,
                  spend,
                  clicks,
                  impressions,
                  cpc,
                  ctr,
                  results
                }, { onConflict: "business_id, date, campaign_id" });
            }

            // 3. Generate Ads Commentary
            const contextPayload = {
              date: todayStr,
              business_name: businessName,
              campagnes_publicitaires: adsInsights.map((ad: any) => ({
                nom_campagne: ad.campaign_name,
                depense: ad.spend,
                clics: ad.clicks,
                impressions: ad.impressions,
                cpc: ad.cpc,
                ctr: ad.ctr,
                conversions_ou_resultats: 0 // Simplification inside cron
              }))
            };

            const adsSystemPrompt = `Tu es l'analyste traffic manager et contrôleur de gestion publicitaire de ${businessName}. Chaque soir, tu reçois les données de performance réelles des campagnes Meta publicitaires de la journée. Ton rôle : donner une lecture honnête, pragmatique et directe des performances, comme si tu t'adressais au fondateur.

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

            const adsCommentMessage = await anthropic.messages.create({
              model: CLAUDE_MODEL,
              max_tokens: 400,
              system: adsSystemPrompt,
              messages: [{ role: "user", content: userMessage }],
              temperature: 0.1
            });

            const adsCommentText = (adsCommentMessage.content[0] as any)?.text?.trim() || "";

            // Upsert in finance_daily_entries
            const { data: existingEntry } = await supabaseServer
              .from("finance_daily_entries")
              .select("id")
              .eq("business_id", businessId)
              .eq("date", todayStr)
              .maybeSingle();

            if (existingEntry) {
              await supabaseServer
                .from("finance_daily_entries")
                .update({ commentaire_ads_ia: adsCommentText })
                .eq("id", existingEntry.id);
            } else {
              await supabaseServer
                .from("finance_daily_entries")
                .insert({
                  business_id: businessId,
                  date: todayStr,
                  ca_realise: 0,
                  depenses: { pub: 0, stock: 0, livraison: 0, salaires: 0, autres: 0 },
                  commentaire_ads_ia: adsCommentText
                });
            }

            generatedAdsCount++;
          }
        } catch (err) {
          console.error(`Error processing Meta Ads cron for business ${businessId}:`, err);
        }
      }
    }

    return NextResponse.json({ 
      status: "success", 
      generatedCfo: generatedCfoCount,
      generatedAds: generatedAdsCount
    });
  } catch (error: any) {
    console.error("Error running Cron finance CFO route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
