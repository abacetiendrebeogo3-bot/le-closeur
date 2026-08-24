-- Migration: 20260824030000_willshop_seed.sql
-- Update default KB items & Rules insertion function with WillShop custom defaults

CREATE OR REPLACE FUNCTION public.populate_business_defaults(target_business_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert default knowledge base if empty (or replace if desired)
  -- Clear any previous default KB and Rules to avoid mixing with old placeholder values
  DELETE FROM public.agent_knowledge_base WHERE business_id = target_business_id;
  DELETE FROM public.agent_rules WHERE business_id = target_business_id;

  INSERT INTO public.agent_knowledge_base (business_id, question, reponse, active) VALUES
  (target_business_id, 'Où êtes-vous situés / où est la boutique ?', 'Nous sommes à Ouagadougou, précisément à Kossodo.', true),
  (target_business_id, 'Comment venir à la boutique ?', 'Vous arrivez jusqu''à la pharmacie de Kossodo, puis vous appelez le 55 00 27 96 — quelqu''il viendra vous accueillir et vous conduire jusqu''à la boutique.', true),
  (target_business_id, 'Quels sont vos horaires d''ouverture ?', '24h/24', true),
  (target_business_id, 'Que contient le Kit Minceur ?', 'Le Kit Minceur contient un thé (Fit Tea, cure de 28 jours) et des gélules (Slim Fit Tablet, cure de 28 jours).', true),
  (target_business_id, 'Quel est le prix du Kit Minceur ?', '6 500 F.', true),
  (target_business_id, 'Que contient le Kit Maca ?', 'Le Kit Maca contient de la poudre pureMaca (200g) et un sirop Mixtuie (250-350ml).', true),
  (target_business_id, 'Quel est le prix du Kit Maca ?', '6 500 F.', true),
  (target_business_id, 'Quels sont vos moyens de paiement pour une commande hors Ouagadougou ?', 'Orange Money au 66 57 64 20 (nom sur le compte : Sare Mariam) ou Moov Money au 72 01 95 24 (nom sur le compte : Tiendrebeogo Wilfried Abace).', true),
  (target_business_id, 'Quels sont les frais de livraison à Ouagadougou ?', 'Gratuit pour les zones proches, 1 000 F pour les zones éloignées (la marge de livraison est déjà incluse dans le prix produit selon la zone).', true),
  (target_business_id, 'Quels sont les frais pour une expédition hors Ouagadougou ?', 'Prix du produit + 1 000 F de frais d''expédition. Le client choisit sa compagnie de transport (Staff, TSR, Rakieta, Saramaya...).', true),
  (target_business_id, 'Quels sont les autres produits disponibles ?', 'Kit Maca, Kit Minceur, masque Green Mask, masseur à percussion Megawise, aspirateur portable pour voiture (8 500 F), kit dentaire blancheur (6 500 F).', true),
  (target_business_id, 'Y a-t-il une garantie ou une politique de retour ?', '[À COMPLÉTER]', true),
  (target_business_id, 'Le kit est-il vraiment efficace / y a-t-il des résultats garantis ?', 'Plusieurs de nos clientes nous ont partagé de bons retours après utilisation. Nous ne donnons pas de chiffre de résultat garanti, chaque personne réagit différemment.', true),
  (target_business_id, 'Y a-t-il une promotion en cours ?', '[À COMPLÉTER — ne remplir que si une promo réelle est active, avec sa date de fin exacte. Ne jamais laisser l''agent improviser une urgence si ce champ est vide.]', true);

  -- Insert default rules
  INSERT INTO public.agent_rules (business_id, condition, action, active) VALUES
  (target_business_id, 'Le client nomme un produit ou exprime un besoin qui pointe vers un produit du catalogue (ex. "ventre plat", "mince", "je veux maigrir")', 'confirmer la disponibilité + envoyer l''image du produit dans le même message, sans poser de question de diagnostic avant.', true),
  (target_business_id, 'Le client demande où se trouve la boutique', 'répondre avec l''adresse Kossodo + le repère pharmacie + le numéro 55 00 27 96 (voir base de connaissances).', true),
  (target_business_id, 'Le client exprime un doute et qu''une promo réelle est active dans la base de connaissances', 's''appuyer sur cette urgence réelle (stock/promo) pour relancer la décision, jamais inventer un compte à rebours ou un niveau de stock non confirmé.', true),
  (target_business_id, 'L''agent propose des témoignages et que le client accepte', 'envoyer les témoignages puis s''arrêter — ne pas poser de nouvelle question dans la foulée, laisser le client répondre de lui-même.', true),
  (target_business_id, 'Une information demandée n''existe ni dans le catalogue ni dans la base de connaissances', 'répondre honnêtement que l''info n''est pas disponible pour le moment, ou rester silencieux — ne jamais dire "je vérifie" ni inventer.', true),
  (target_business_id, 'Le client demande un prix, un délai ou un résultat produit non confirmé', 'ne jamais donner de chiffre inventé (ex. "-4kg", "livré en 2h") — rester sur les données confirmées uniquement.', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-populate defaults for all existing businesses with these new custom items
DO $$
DECLARE
  bus RECORD;
BEGIN
  FOR bus IN SELECT id FROM public.businesses LOOP
    PERFORM public.populate_business_defaults(bus.id);
  END LOOP;
END;
$$;
