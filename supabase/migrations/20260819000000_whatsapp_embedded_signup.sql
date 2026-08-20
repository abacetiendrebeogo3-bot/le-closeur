-- Migration to add WhatsApp credentials/configuration to public.businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS whatsapp_waba_id TEXT;
