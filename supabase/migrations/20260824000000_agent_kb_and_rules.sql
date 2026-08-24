-- Migration: 20260824000000_agent_kb_and_rules.sql
-- Create Agent Knowledge Base table
CREATE TABLE IF NOT EXISTS public.agent_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    reponse TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Knowledge Base
ALTER TABLE public.agent_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for Knowledge Base
DROP POLICY IF EXISTS "Allow access by business tenant" ON public.agent_knowledge_base;
CREATE POLICY "Allow access by business tenant" ON public.agent_knowledge_base
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- Create Agent Rules table
CREATE TABLE IF NOT EXISTS public.agent_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    condition TEXT NOT NULL,
    action TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Agent Rules
ALTER TABLE public.agent_rules ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for Agent Rules
DROP POLICY IF EXISTS "Allow access by business tenant" ON public.agent_rules;
CREATE POLICY "Allow access by business tenant" ON public.agent_rules
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );
