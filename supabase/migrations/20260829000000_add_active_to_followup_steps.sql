-- Migration: Add active column to followup_steps and seed default templates
-- 1. Recreate followup_steps if missing (due to schema cache or table drop issues)
CREATE TABLE IF NOT EXISTS public.followup_steps (
    id TEXT PRIMARY KEY,
    business_id UUID REFERENCES public.businesses(id) DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
    delay_value INTEGER NOT NULL,
    delay_unit TEXT NOT NULL CHECK (delay_unit IN ('hours', 'days')),
    name TEXT NOT NULL,
    message_text TEXT NOT NULL,
    meta_template_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add active column if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'followup_steps' 
      AND column_name = 'active'
  ) THEN
    ALTER TABLE public.followup_steps ADD COLUMN active BOOLEAN DEFAULT false NOT NULL;
  END IF;
END $$;

-- Enable RLS and create policy if not exists
ALTER TABLE public.followup_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access by business tenant" ON public.followup_steps;
CREATE POLICY "Allow access by business tenant" ON public.followup_steps
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

-- 3. Delete old steps for Wilfried's business to seed fresh templates
DELETE FROM public.followup_steps WHERE business_id = 'd7d6da2e-eb32-4aed-9440-80617ddfaac2';

-- 4. Seed J1, J3, J5, J7, J12, J15, J21 templates (2 templates per day step, 1 active per step)
INSERT INTO public.followup_steps (id, business_id, delay_value, delay_unit, name, message_text, meta_template_name, active) VALUES
-- J1 (1 day)
('wil-j1-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 1, 'days', 'J1 - Suivi Relationnel (Actif)', 'Bonjour {name}, je voulais simplement m''assurer que vous avez bien reçu toutes les informations nécessaires concernant notre Kit Minceur. Y a-t-il quelque chose qui bloque ?', 'nurture_followup_fr', true),
('wil-j1-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 1, 'days', 'J1 - Curiosité Douce', 'Coucou {name} ! Avez-vous eu le temps de jeter un œil à notre conversation d''hier ? Je suis là si vous voulez commander.', 'nurture_followup_fr', false),

-- J3 (3 days)
('wil-j3-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 3, 'days', 'J3 - Motivation Cure (Actif)', 'Hello {name} ! C''est le moment idéal pour lancer votre cure Kit Minceur et obtenir vos premiers résultats sous 28 jours. On valide ensemble ?', 'nurture_followup_fr', true),
('wil-j3-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 3, 'days', 'J3 - Urgence Stock', 'Bonjour {name}, j''ai pensé à vous aujourd''hui. Notre stock de Kit Minceur diminue vite. Souhaitez-vous que je vous en réserve un ?', 'nurture_followup_fr', false),

-- J5 (5 days)
('wil-j5-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 5, 'days', 'J5 - Témoignages Preuve (Actif)', 'Bonjour {name}, plusieurs clientes viennent de partager leurs résultats incroyables après 1 semaine de cure ! Souhaitez-vous voir leurs photos ?', 'nurture_followup_fr', true),
('wil-j5-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 5, 'days', 'J5 - Question Conseils', 'Bonjour {name}, est-ce que vous avez des questions sur la posologie ou l''utilisation du Kit Minceur ?', 'nurture_followup_fr', false),

-- J7 (7 days)
('wil-j7-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 7, 'days', 'J7 - Livraison Offerte (Actif)', 'Bonjour {name} ! Bonne nouvelle : j''ai réussi à obtenir une livraison gratuite pour votre colis aujourd''hui. Profitez-en pour commander !', 'nurture_followup_fr', true),
('wil-j7-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 7, 'days', 'J7 - Réduction Wilfried', 'Coucou {name}, c''est Wilfried. Je vous offre -10% de réduction sur votre commande aujourd''hui si vous la validez maintenant !', 'nurture_followup_fr', false),

-- J12 (12 days)
('wil-j12-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 12, 'days', 'J12 - Prochain Groupe (Actif)', 'Bonjour {name}, nous allons clôturer les commandes de ce mois. Souhaitez-vous faire partie de notre prochain groupe d''accompagnement ?', 'nurture_followup_fr', true),
('wil-j12-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 12, 'days', 'J12 - Objectifs Perte', 'Hello {name}, toujours partant pour atteindre vos objectifs perte de poids cette saison ?', 'nurture_followup_fr', false),

-- J15 (15 days)
('wil-j15-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 15, 'days', 'J15 - Solution Alternative (Actif)', 'Bonjour {name}, c''est juste Wilfried. Je voulais savoir si vous aviez trouvé une autre solution ou si vous souhaitez toujours essayer le Kit Minceur ?', 'nurture_followup_fr', true),
('wil-j15-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 15, 'days', 'J15 - Petit Coucou', 'Bonjour {name}, un petit coucou pour savoir comment vous allez !', 'nurture_followup_fr', false),

-- J21 (21 days)
('wil-j21-a', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 21, 'days', 'J21 - Dernier Message (Actif)', 'Bonjour {name}, c''est mon dernier message pour ne pas vous encombrer. Si vous changez d''avis, notre porte reste grande ouverte ! Prenez soin de vous 😊', 'nurture_followup_fr', true),
('wil-j21-b', 'd7d6da2e-eb32-4aed-9440-80617ddfaac2', 21, 'days', 'J21 - Salutation Chaleureuse', 'Hello {name}, je vous envoie un dernier au revoir chaleureux !', 'nurture_followup_fr', false);
