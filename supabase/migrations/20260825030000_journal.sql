-- Migration: 20260825030000_journal.sql

-- 1. Create journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    contenu TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_id, date)
);

-- Enable RLS on journal_entries
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for journal_entries
DROP POLICY IF EXISTS "Allow journal entries access by business tenant" ON public.journal_entries;
CREATE POLICY "Allow journal entries access by business tenant" ON public.journal_entries
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 2. Create daily_todos table
CREATE TABLE IF NOT EXISTS public.daily_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    item TEXT NOT NULL,
    done BOOLEAN DEFAULT false NOT NULL,
    source TEXT DEFAULT 'ia' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on daily_todos
ALTER TABLE public.daily_todos ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for daily_todos
DROP POLICY IF EXISTS "Allow daily todos access by business tenant" ON public.daily_todos;
CREATE POLICY "Allow daily todos access by business tenant" ON public.daily_todos
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 3. Create campaign_checklists table
CREATE TABLE IF NOT EXISTS public.campaign_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    titre TEXT NOT NULL,
    produit_associe TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on campaign_checklists
ALTER TABLE public.campaign_checklists ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for campaign_checklists
DROP POLICY IF EXISTS "Allow campaign checklists access by business tenant" ON public.campaign_checklists;
CREATE POLICY "Allow campaign checklists access by business tenant" ON public.campaign_checklists
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );
