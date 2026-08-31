-- Migration: Pilotage enhancements (buying_price, employees, debts) & WhatsApp commercial pivot (business_phone_numbers)

-- 1. Add buying_price to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS buying_price INTEGER DEFAULT 0;

-- 2. Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    monthly_salary INTEGER NOT NULL DEFAULT 0,
    pay_day INTEGER NOT NULL CHECK (pay_day >= 1 AND pay_day <= 31),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & create policies for employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow employees access by business tenant" ON public.employees;
CREATE POLICY "Allow employees access by business tenant" ON public.employees
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 3. Create debts table
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & create policies for debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow debts access by business tenant" ON public.debts;
CREATE POLICY "Allow debts access by business tenant" ON public.debts
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 4. Create business_phone_numbers table
CREATE TABLE IF NOT EXISTS public.business_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    phone_number_id TEXT NOT NULL UNIQUE,
    waba_id TEXT,
    access_token TEXT,
    conversation_mode TEXT DEFAULT 'human_coexistence',
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was created previously with older schema
ALTER TABLE public.business_phone_numbers 
ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS waba_id TEXT,
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS conversation_mode TEXT DEFAULT 'human_coexistence',
ADD COLUMN IF NOT EXISTS label TEXT;

-- Ensure UNIQUE constraint exists for ON CONFLICT upserts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_phone_numbers_phone_number_id_key'
    ) THEN
        ALTER TABLE public.business_phone_numbers ADD CONSTRAINT business_phone_numbers_phone_number_id_key UNIQUE (phone_number_id);
    END IF;
END $$;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';

-- Enable RLS & create policies for phone numbers
ALTER TABLE public.business_phone_numbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow phone_numbers access by business tenant" ON public.business_phone_numbers;
CREATE POLICY "Allow phone_numbers access by business tenant" ON public.business_phone_numbers
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );
