-- Script de Seed SQL pour Mon Closeur
-- Fichier : supabase/seed.sql

-- 1. Insertion des Produits (Products)
INSERT INTO public.products (id, name, price, category, active, stock) VALUES
('PROD-001', 'Disque SSD 1TB Enterprise', 150000, 'Composants', TRUE, 12),
('PROD-002', 'RAM DDR5 32GB Corsair', 65000, 'Composants', TRUE, 3),
('PROD-003', 'Processeur AMD Ryzen 9', 250000, 'Composants', TRUE, 0),
('PROD-004', 'Clavier Mécanique RGB', 45000, 'Périphériques', TRUE, 15),
('PROD-005', 'Souris Gamer Sans Fil', 35000, 'Périphériques', TRUE, 8),
('PROD-006', 'Écran 27" Quad HD 144Hz', 180000, 'Périphériques', TRUE, 2)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    price = EXCLUDED.price, 
    category = EXCLUDED.category, 
    active = EXCLUDED.active, 
    stock = EXCLUDED.stock;

-- 2. Insertion des Zones de livraison (Delivery Zones)
INSERT INTO public.delivery_zones (id, name, fee, delivery_time) VALUES
('ZONE-001', 'Medina', 1500, '24h'),
('ZONE-002', 'Almadies', 2500, '24h'),
('ZONE-003', 'Plateau', 2000, '12h'),
('ZONE-004', 'Yoff', 2000, '24h'),
('ZONE-005', 'Pikine', 3000, '48h')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    fee = EXCLUDED.fee, 
    delivery_time = EXCLUDED.delivery_time;

-- 3. Insertion des Clients (Customers)
INSERT INTO public.customers (id, name, phone, email, address, first_contact, tags, total_spent) VALUES
('CUST-001', 'Youssou Ndiaye', '+221 77 654 32 10', 'youssou@domain.sn', 'Almadies, Villa 12, Dakar', '14/08/2026', ARRAY['Client VIP', 'Tech'], 0),
('CUST-002', 'Fatou Diome', '+221 78 123 45 67', 'fatou@domain.sn', 'Medina, Rue 6, Dakar', '12/08/2026', ARRAY['Nouveau'], 151500),
('CUST-003', 'Mariama Bâ', '+221 70 987 65 43', 'mariama@ba-associates.sn', 'Plateau, Immeuble A, Dakar', '01/08/2026', ARRAY['Fidèle'], 350000)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    phone = EXCLUDED.phone, 
    email = EXCLUDED.email, 
    address = EXCLUDED.address, 
    first_contact = EXCLUDED.first_contact, 
    tags = EXCLUDED.tags, 
    total_spent = EXCLUDED.total_spent;

-- 4. Insertion des Discussions (Conversations)
-- Nous insérons avec des IDs fixes pour pouvoir mapper proprement les messages et commandes
INSERT INTO public.conversations (id, customer_name, customer_phone, status, avatar, unread) VALUES
(1, 'Youssou Ndiaye', '+221 77 654 32 10', 'ai_active', 'YN', TRUE),
(2, 'Fatou Diome', '+221 78 123 45 67', 'human_takeover', 'FD', TRUE),
(3, 'Mariama Bâ', '+221 70 987 65 43', 'closed', 'MB', FALSE)
ON CONFLICT (id) DO UPDATE SET 
    customer_name = EXCLUDED.customer_name, 
    customer_phone = EXCLUDED.customer_phone, 
    status = EXCLUDED.status, 
    avatar = EXCLUDED.avatar, 
    unread = EXCLUDED.unread;

-- Pour les autoincrements d'ID sur conversations
SELECT setval(pg_get_serial_sequence('public.conversations', 'id'), coalesce(max(id), 1) + 1) FROM public.conversations;

-- 5. Insertion des Messages (Messages)
-- Nous vidons d'abord les anciens messages fictifs liés à ces conversations pour éviter les doublons au seed
DELETE FROM public.messages WHERE conversation_id IN (1, 2, 3);

INSERT INTO public.messages (conversation_id, sender, text, time) VALUES
(1, 'customer', 'Bonjour, est-ce que vous avez le processeur Ryzen 9 en stock ?', '14:15'),
(1, 'ai', 'Bonjour Youssou ! Oui, nous avons le processeur AMD Ryzen 9 en stock au prix de 250 000 FCFA. Souhaitez-vous le commander ?', '14:16'),
(1, 'customer', 'Oui super, je le prends. Livraison aux Almadies s''il vous plaît.', '14:20'),

(2, 'customer', 'Bonjour, j''aimerais modifier l''adresse de livraison pour ma commande de SSD s''il vous plaît.', '11:02'),
(2, 'ai', 'Bonjour Fatou, je passe immédiatement votre demande à un conseiller pour ajuster l''adresse.', '11:03'),

(3, 'customer', 'Merci pour la livraison rapide ! J''ai bien reçu la RAM.', 'Hier'),
(3, 'ai', 'Avec grand plaisir Mariama ! Excellente installation à vous et à bientôt.', 'Hier');

-- 6. Insertion des Commandes (Orders)
INSERT INTO public.orders (id, customer, customer_phone, customer_address, date, status, payment_status, delivery_zone, shipping_fee, total, courier_name, chat_id) VALUES
('CMD-2026-001', 'Youssou Ndiaye', '+221 77 654 32 10', 'Almadies, Villa 12, Dakar', '2026-08-14', 'discussing', 'pending', 'Almadies', 2500, 252500, NULL, 1),
('CMD-2026-002', 'Fatou Diome', '+221 78 123 45 67', 'Medina, Rue 6, Dakar', '2026-08-14', 'confirmed', 'pending', 'Medina', 1500, 151500, NULL, 2),
('CMD-2026-003', 'Mariama Bâ', '+221 70 987 65 43', 'Plateau, Immeuble A, Dakar', '2026-08-13', 'paid', 'paid', 'Plateau', 2000, 102000, 'Moussa Sarr', 3)
ON CONFLICT (id) DO UPDATE SET 
    customer = EXCLUDED.customer, 
    customer_phone = EXCLUDED.customer_phone, 
    customer_address = EXCLUDED.customer_address, 
    date = EXCLUDED.date, 
    status = EXCLUDED.status, 
    payment_status = EXCLUDED.payment_status, 
    delivery_zone = EXCLUDED.delivery_zone, 
    shipping_fee = EXCLUDED.shipping_fee, 
    total = EXCLUDED.total, 
    courier_name = EXCLUDED.courier_name, 
    chat_id = EXCLUDED.chat_id;

-- 7. Insertion des Lignes de commande (Order Items)
DELETE FROM public.order_items WHERE order_id IN ('CMD-2026-001', 'CMD-2026-002', 'CMD-2026-003');

INSERT INTO public.order_items (order_id, product, quantity, price) VALUES
('CMD-2026-001', 'Processeur AMD Ryzen 9', 1, 250000),
('CMD-2026-002', 'Disque SSD 1TB Enterprise', 1, 150000),
('CMD-2026-003', 'RAM DDR5 32GB Corsair', 1, 65000),
('CMD-2026-003', 'Souris Gamer Sans Fil', 1, 35000);

-- 8. Insertion des Livreurs (Couriers)
INSERT INTO public.couriers (id, name, phone, active, load) VALUES
('COURIER-001', 'Moussa Sarr', '+221 77 555 11 22', TRUE, 1),
('COURIER-002', 'Ousmane Sow', '+221 77 444 33 22', TRUE, 0),
('COURIER-003', 'Ibrahima Diallo', '+221 76 222 99 88', FALSE, 0)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    phone = EXCLUDED.phone, 
    active = EXCLUDED.active, 
    load = EXCLUDED.load;
