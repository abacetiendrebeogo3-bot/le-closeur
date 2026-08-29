-- Migration: Create caisse tables and define RLS policies
-- 1. Table for Cash Transactions
CREATE TABLE IF NOT EXISTS public.caisse_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
    montant NUMERIC NOT NULL,
    categorie TEXT NOT NULL CHECK (categorie IN ('vente', 'salaire', 'facture', 'achat_stock', 'transport', 'autre')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for caisse_transactions
ALTER TABLE public.caisse_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access by business tenant" ON public.caisse_transactions;
CREATE POLICY "Allow access by business tenant" ON public.caisse_transactions
    FOR ALL
    TO authenticated
    USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 2. Table for Cash Objectives
CREATE TABLE IF NOT EXISTS public.caisse_objectifs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    target_date DATE NOT NULL,
    montant_cible NUMERIC NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for caisse_objectifs
ALTER TABLE public.caisse_objectifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access by business tenant" ON public.caisse_objectifs;
CREATE POLICY "Allow access by business tenant" ON public.caisse_objectifs
    FOR ALL
    TO authenticated
    USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );
