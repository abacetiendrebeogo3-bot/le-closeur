-- Migration: 20260824010000_conversations_engagement_status.sql
-- Add engagement_status column to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS engagement_status TEXT DEFAULT 'nouveau';
