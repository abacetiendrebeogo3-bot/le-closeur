-- Migration pour ajouter les colonnes de configuration de l'agent IA à la table businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS agent_identity TEXT DEFAULT 'Tu es l''agent IA de vente de notre commerce. Accueille chaleureusement le client et propose le catalogue en FCFA...';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS agent_sales_rules TEXT DEFAULT 'Nos prix sont fermes. Pas de remise sans validation préalable.';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS agent_escalation_rules TEXT DEFAULT 'Transférer immédiatement si le client demande un conseiller humain ou s''énerve.';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS agent_tone TEXT DEFAULT 'Chaleureux et Respectueux';
