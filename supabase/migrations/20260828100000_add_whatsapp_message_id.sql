-- Migration to add whatsapp_message_id to messages table for deduplication
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT UNIQUE;
