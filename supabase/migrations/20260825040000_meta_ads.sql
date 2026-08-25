-- Migration: 20260825040000_meta_ads.sql

-- 1. Add Meta Ads columns to businesses table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS meta_ads_access_token TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS meta_ads_account_id TEXT;

-- Add Meta Ads commentary column to finance_daily_entries
ALTER TABLE public.finance_daily_entries ADD COLUMN IF NOT EXISTS commentaire_ads_ia TEXT;

-- 2. Create ads_daily_insights table
CREATE TABLE IF NOT EXISTS public.ads_daily_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    spend NUMERIC NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    cpc NUMERIC,
    ctr NUMERIC,
    results INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_id, date, campaign_id)
);

-- Enable RLS on ads_daily_insights
ALTER TABLE public.ads_daily_insights ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for ads_daily_insights
DROP POLICY IF EXISTS "Allow ads daily insights access by business tenant" ON public.ads_daily_insights;
CREATE POLICY "Allow ads daily insights access by business tenant" ON public.ads_daily_insights
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );
