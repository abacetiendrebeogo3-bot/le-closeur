-- Migration: 20260825020000_pilotage_financial.sql
-- 1. Create finance_settings table
CREATE TABLE IF NOT EXISTS public.finance_settings (
    business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    repartition JSONB NOT NULL DEFAULT '{"reserve_entreprise": 10, "part_perso": 40, "reinvestment": 40, "tampon": 10}'::jsonb,
    seuils_alerte JSONB NOT NULL DEFAULT '{"marge_orange": 15, "marge_rouge": 5, "jours_deficit_rouge": 3}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on finance_settings
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for finance_settings
DROP POLICY IF EXISTS "Allow finance settings access by business tenant" ON public.finance_settings;
CREATE POLICY "Allow finance settings access by business tenant" ON public.finance_settings
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 2. Create finance_daily_entries table
CREATE TABLE IF NOT EXISTS public.finance_daily_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    objectif_ca NUMERIC DEFAULT 0,
    objectif_benefice NUMERIC DEFAULT 0,
    ca_realise NUMERIC NOT NULL DEFAULT 0,
    depenses JSONB NOT NULL DEFAULT '{"pub": 0, "stock": 0, "livraison": 0, "salaires": 0, "autres": 0}'::jsonb,
    commentaire_ia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_id, date)
);

-- Enable RLS on finance_daily_entries
ALTER TABLE public.finance_daily_entries ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy for finance_daily_entries
DROP POLICY IF EXISTS "Allow finance daily entries access by business tenant" ON public.finance_daily_entries;
CREATE POLICY "Allow finance daily entries access by business tenant" ON public.finance_daily_entries
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 3. Default finance_settings trigger function
CREATE OR REPLACE FUNCTION public.populate_business_finance_defaults(target_business_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.finance_settings WHERE business_id = target_business_id) THEN
    INSERT INTO public.finance_settings (business_id, repartition, seuils_alerte) VALUES
    (target_business_id, 
     '{"reserve_entreprise": 10, "part_perso": 40, "reinvestment": 40, "tampon": 10}'::jsonb, 
     '{"marge_orange": 15, "marge_rouge": 5, "jours_deficit_rouge": 3}'::jsonb);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Populate finance settings for all existing businesses
DO $$
DECLARE
  bus RECORD;
BEGIN
  FOR bus IN SELECT id FROM public.businesses LOOP
    PERFORM public.populate_business_finance_defaults(bus.id);
  END LOOP;
END;
$$;

-- Trigger function for new businesses insertion
CREATE OR REPLACE FUNCTION public.populate_new_business_finance_defaults_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.populate_business_finance_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS tr_populate_new_business_finance_defaults ON public.businesses;
CREATE TRIGGER tr_populate_new_business_finance_defaults
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.populate_new_business_finance_defaults_trigger();
