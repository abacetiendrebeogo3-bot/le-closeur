import { Conversation, Customer, Order, Courier, Product, Zone } from "../types";

export const initialZones: Zone[] = [
  { id: "ZONE-001", name: "Medina", fee: 1500, deliveryTime: "24h" },
  { id: "ZONE-002", name: "Almadies", fee: 2500, deliveryTime: "24h" },
  { id: "ZONE-003", name: "Plateau", fee: 2000, deliveryTime: "12h" },
  { id: "ZONE-004", name: "Yoff", fee: 2000, deliveryTime: "24h" },
  { id: "ZONE-005", name: "Pikine", fee: 3000, deliveryTime: "48h" }
];

export const initialCatalog: Product[] = [
  { id: "PROD-001", name: "Disque SSD 1TB Enterprise", price: 150000, category: "Composants", active: true, stock: 12 },
  { id: "PROD-002", name: "RAM DDR5 32GB Corsair", price: 65000, category: "Composants", active: true, stock: 3 },
  { id: "PROD-003", name: "Processeur AMD Ryzen 9", price: 250000, category: "Composants", active: true, stock: 0 },
  { id: "PROD-004", name: "Clavier Mécanique RGB", price: 45000, category: "Périphériques", active: true, stock: 15 },
  { id: "PROD-005", name: "Souris Gamer Sans Fil", price: 35000, category: "Périphériques", active: true, stock: 8 },
  { id: "PROD-006", name: "Écran 27\" Quad HD 144Hz", price: 180000, category: "Périphériques", active: true, stock: 2 }
];

export const initialConversations: Conversation[] = [
  {
    id: 1,
    customerName: "Youssou Ndiaye",
    customerPhone: "+221 77 654 32 10",
    status: "ai_active",
    avatar: "YN",
    unread: true,
    messages: [
      { sender: "customer", text: "Bonjour, est-ce que vous avez le processeur Ryzen 9 en stock ?", time: "14:15" },
      { sender: "ai", text: "Bonjour Youssou ! Oui, nous avons le processeur AMD Ryzen 9 en stock au prix de 250 000 FCFA. Souhaitez-vous le commander ?", time: "14:16" },
      { sender: "customer", text: "Oui super, je le prends. Livraison aux Almadies s'il vous plaît.", time: "14:20" }
    ]
  },
  {
    id: 2,
    customerName: "Fatou Diome",
    customerPhone: "+221 78 123 45 67",
    status: "human_takeover",
    avatar: "FD",
    unread: true,
    messages: [
      { sender: "customer", text: "Bonjour, j'aimerais modifier l'adresse de livraison pour ma commande de SSD s'il vous plaît.", time: "11:02" },
      { sender: "ai", text: "Bonjour Fatou, je passe immédiatement votre demande à un conseiller pour ajuster l'adresse.", time: "11:03" }
    ]
  },
  {
    id: 3,
    customerName: "Mariama Bâ",
    customerPhone: "+221 70 987 65 43",
    status: "closed",
    avatar: "MB",
    unread: false,
    messages: [
      { sender: "customer", text: "Merci pour la livraison rapide ! J'ai bien reçu la RAM.", time: "Hier" },
      { sender: "ai", text: "Avec grand plaisir Mariama ! Excellente installation à vous et à bientôt.", time: "Hier" }
    ]
  }
];

export const initialCustomers: Customer[] = [
  { id: "CUST-001", name: "Youssou Ndiaye", phone: "+221 77 654 32 10", email: "youssou@domain.sn", address: "Almadies, Villa 12, Dakar", firstContact: "14/08/2026", tags: ["Client VIP", "Tech"], totalSpent: 0 },
  { id: "CUST-002", name: "Fatou Diome", phone: "+221 78 123 45 67", email: "fatou@domain.sn", address: "Medina, Rue 6, Dakar", firstContact: "12/08/2026", tags: ["Nouveau"], totalSpent: 151500 },
  { id: "CUST-003", name: "Mariama Bâ", phone: "+221 70 987 65 43", email: "mariama@ba-associates.sn", address: "Plateau, Immeuble A, Dakar", firstContact: "01/08/2026", tags: ["Fidèle"], totalSpent: 350000 }
];

export const initialOrders: Order[] = [
  { 
    id: "CMD-2026-001", 
    customer: "Youssou Ndiaye", 
    customerPhone: "+221 77 654 32 10",
    customerAddress: "Almadies, Villa 12, Dakar",
    date: "2026-08-14", 
    status: "discussing", 
    paymentStatus: "pending", 
    deliveryZone: "Almadies",
    shippingFee: 2500,
    items: [{ product: "Processeur AMD Ryzen 9", quantity: 1, price: 250000 }],
    total: 252500,
    chatId: 1
  },
  { 
    id: "CMD-2026-002", 
    customer: "Fatou Diome", 
    customerPhone: "+221 78 123 45 67",
    customerAddress: "Medina, Rue 6, Dakar",
    date: "2026-08-14", 
    status: "confirmed", 
    paymentStatus: "pending", 
    deliveryZone: "Medina",
    shippingFee: 1500,
    items: [{ product: "Disque SSD 1TB Enterprise", quantity: 1, price: 150000 }],
    total: 151500,
    chatId: 2
  },
  { 
    id: "CMD-2026-003", 
    customer: "Mariama Bâ", 
    customerPhone: "+221 70 987 65 43",
    customerAddress: "Plateau, Immeuble A, Dakar",
    date: "2026-08-13", 
    status: "paid", 
    paymentStatus: "paid", 
    deliveryZone: "Plateau",
    shippingFee: 2000,
    items: [
      { product: "RAM DDR5 32GB Corsair", quantity: 1, price: 65000 },
      { product: "Souris Gamer Sans Fil", quantity: 1, price: 35000 }
    ],
    total: 102000,
    chatId: 3
  }
];

export const initialCouriers: Courier[] = [
  { name: "Moussa Sarr", phone: "+221 77 555 11 22", active: true, load: 1 },
  { name: "Ousmane Sow", phone: "+221 77 444 33 22", active: true, load: 0 },
  { name: "Ibrahima Diallo", phone: "+221 76 222 99 88", active: false, load: 0 }
];
