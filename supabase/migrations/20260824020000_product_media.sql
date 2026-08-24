-- Migration: 20260824020000_product_media.sql
-- 1. Create product_media table
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policy
DROP POLICY IF EXISTS "Allow access by business tenant" ON public.product_media;
CREATE POLICY "Allow access by business tenant" ON public.product_media
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        business_id IN (
            SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
        )
    );

-- 2. Migrate existing agent_media_library (JSONB) to product_media table
INSERT INTO public.product_media (business_id, label, url, product_id, media_type)
SELECT 
  b.id AS business_id,
  kv.key AS label,
  CASE 
    WHEN jsonb_typeof(kv.value) = 'object' THEN (kv.value->>'url')
    ELSE (kv.value->>0)
  END AS url,
  CASE 
    WHEN jsonb_typeof(kv.value) = 'object' THEN (kv.value->>'productId')
    ELSE NULL 
  END AS product_id,
  'image' AS media_type
FROM 
  public.businesses b,
  LATERAL jsonb_each(b.agent_media_library) kv
WHERE 
  b.agent_media_library IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Default KB items & Rules insertion function
CREATE OR REPLACE FUNCTION public.populate_business_defaults(target_business_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert default knowledge base if empty
  IF NOT EXISTS (SELECT 1 FROM public.agent_knowledge_base WHERE business_id = target_business_id) THEN
    INSERT INTO public.agent_knowledge_base (business_id, question, reponse, active) VALUES
    (target_business_id, 'Comment puis-je payer ?', 'Nous acceptons Mobile Money (Orange Money, Moov Money) et le paiement à la livraison selon la zone.', true),
    (target_business_id, 'Livrez-vous chez moi ?', 'Précisez votre quartier/ville, je vérifie tout de suite si votre zone est couverte et les frais de livraison.', true),
    (target_business_id, 'Combien de temps prend la livraison ?', 'Le délai dépend de votre zone, généralement entre quelques heures et 48h.', true),
    (target_business_id, 'Le prix est-il négociable ?', 'Nos prix sont fixes et déjà calculés au plus juste, merci de votre compréhension.', true),
    (target_business_id, 'Puis-je annuler ma commande ?', 'Oui, tant qu''elle n''est pas encore envoyée au livreur, contactez-nous rapidement.', true),
    (target_business_id, 'Avez-vous d''autres couleurs/tailles/modèles ?', 'Je vérifie dans notre catalogue actuel et je vous dis ce qui est disponible.', true),
    (target_business_id, 'Comment savoir si ma commande est confirmée ?', 'Vous recevez une confirmation ici même sur WhatsApp dès validation de votre commande.', true),
    (target_business_id, 'Avez-vous une boutique physique ?', 'Nous vendons principalement via WhatsApp avec livraison, c''est plus pratique et rapide pour vous.', true);
  END IF;

  -- Insert default rules if empty
  IF NOT EXISTS (SELECT 1 FROM public.agent_rules WHERE business_id = target_business_id) THEN
    INSERT INTO public.agent_rules (business_id, condition, action, active) VALUES
    (target_business_id, 'Le client demande une réduction de prix', 'Ne jamais accorder de réduction sans validation du propriétaire ; rappeler poliment le prix catalogue.', true),
    (target_business_id, 'Le client signale un produit défectueux ou demande un remboursement', 'Transférer immédiatement à un humain via escalate_to_human.', true),
    (target_business_id, 'Le client demande explicitement à parler à un humain', 'Transférer immédiatement via escalate_to_human, sans insister pour continuer avec l''IA.', true),
    (target_business_id, 'Le client demande un produit absent du catalogue', 'Ne jamais inventer un produit ou un prix ; proposer les alternatives réellement disponibles.', true),
    (target_business_id, 'Le client pose une question de santé/médicale sur un produit bien-être (ex: Kit Minceur)', 'Ne jamais donner de conseil médical ; préciser que ce n''est pas un avis médical et orienter vers un professionnel de santé si besoin.', true),
    (target_business_id, 'Le client demande une livraison hors des zones couvertes', 'Informer poliment que la zone n''est pas couverte et proposer une alternative si disponible.', true),
    (target_business_id, 'Le client est agressif ou insultant', 'Rester poli en toutes circonstances ; proposer un transfert humain si ça persiste.', true),
    (target_business_id, 'Le client demande une grosse quantité (achat en gros/revente)', 'Transférer à un conseiller humain pour discuter des tarifs de gros.', true),
    (target_business_id, 'Le client demande le statut d''une commande déjà passée', 'Toujours utiliser l''outil get_order_status avant de répondre, ne jamais deviner.', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Populate defaults for all existing businesses
DO $$
DECLARE
  bus RECORD;
BEGIN
  FOR bus IN SELECT id FROM public.businesses LOOP
    PERFORM public.populate_business_defaults(bus.id);
  END LOOP;
END;
$$;

-- Trigger function for new businesses insertion
CREATE OR REPLACE FUNCTION public.populate_new_business_defaults_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.populate_business_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS tr_populate_new_business_defaults ON public.businesses;
CREATE TRIGGER tr_populate_new_business_defaults
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.populate_new_business_defaults_trigger();
