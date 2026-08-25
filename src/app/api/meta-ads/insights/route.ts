import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { businessId, date } = await req.json();

    if (!businessId) {
      return NextResponse.json({ error: "businessId parameter is required" }, { status: 400 });
    }

    // Default to today if date not provided
    const targetDate = date || new Date().toISOString().split("T")[0];

    // 1. Fetch credentials from businesses table
    const { data: business } = await supabaseServer
      .from("businesses")
      .select("meta_ads_access_token, meta_ads_account_id")
      .eq("id", businessId)
      .maybeSingle();

    if (!business || !business.meta_ads_access_token || !business.meta_ads_account_id) {
      return NextResponse.json(
        { error: "Meta Ads account not connected for this business" },
        { status: 400 }
      );
    }

    const accessToken = business.meta_ads_access_token;
    const rawAccountId = business.meta_ads_account_id.trim();
    // Ensure account ID doesn't have double "act_" prefix
    const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;

    // 2. Fetch Insights from Meta Marketing API
    // time_range is {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
    const timeRange = JSON.stringify({ since: targetDate, until: targetDate });
    const url = new URL(`https://graph.facebook.com/v19.0/${adAccountId}/insights`);
    url.searchParams.set("fields", "campaign_name,campaign_id,spend,clicks,impressions,cpc,ctr,actions");
    url.searchParams.set("time_range", timeRange);
    url.searchParams.set("level", "campaign");
    url.searchParams.set("access_token", accessToken);

    console.log(`Fetching Meta Ads Insights for account ${adAccountId} on date ${targetDate}...`);
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("Meta Marketing API error:", data);
      return NextResponse.json(
        { error: "Failed to fetch data from Meta API", details: data },
        { status: 500 }
      );
    }

    const insights = data.data || [];
    const savedEntries = [];

    // 3. Process and upsert daily records
    for (const item of insights) {
      const campaignId = item.campaign_id;
      const campaignName = item.campaign_name;
      const spend = parseFloat(item.spend) || 0;
      const clicks = parseInt(item.clicks) || 0;
      const impressions = parseInt(item.impressions) || 0;
      const cpc = parseFloat(item.cpc) || 0;
      const ctr = parseFloat(item.ctr) || 0;

      // Extract results (e.g. conversation starters or messaging actions)
      let results = 0;
      if (item.actions && Array.isArray(item.actions)) {
        // Look for messaging replies or lead actions or conversions
        const messageAction = item.actions.find(
          (act: any) =>
            act.action_type === "onsite_conversion.messaging_first_reply" ||
            act.action_type === "link_click" ||
            act.action_type === "lead"
        );
        results = messageAction ? parseInt(messageAction.value) || 0 : 0;
      }

      const payload = {
        business_id: businessId,
        date: targetDate,
        campaign_id: campaignId,
        campaign_name: campaignName,
        spend,
        clicks,
        impressions,
        cpc,
        ctr,
        results
      };

      const { data: upserted, error: upsertErr } = await supabaseServer
        .from("ads_daily_insights")
        .upsert(payload, { onConflict: "business_id, date, campaign_id" })
        .select()
        .single();

      if (upsertErr) {
        console.error("Error upserting daily ad insights:", upsertErr);
      } else {
        savedEntries.push(upserted);
      }
    }

    return NextResponse.json({ success: true, count: savedEntries.length, data: savedEntries });
  } catch (err: any) {
    console.error("Error running Meta Ads daily insights retrieval:", err);
    return NextResponse.json({ error: err.message || "Failed to retrieve insights" }, { status: 500 });
  }
}
