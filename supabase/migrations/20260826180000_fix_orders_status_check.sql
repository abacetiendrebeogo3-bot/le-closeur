-- Migration: Fix check constraint on orders status to match the exact application statuses
-- Fichier: supabase/migrations/20260826180000_fix_orders_status_check.sql

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('discussing', 'confirmed', 'courier_assigned', 'sent_to_courier', 'shipping', 'delivered', 'paid', 'cancelled'));
