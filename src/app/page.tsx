"use client";

import { useState } from "react";
import { 
  LayoutDashboard, 
  MessageSquare, 
  ShoppingBag, 
  Users, 
  Truck, 
  Clock, 
  Settings, 
  Download, 
  Send, 
  UserCheck, 
  Database,
  Plus,
  X,
  Check,
  AlertTriangle
} from "lucide-react";

interface Message {
  sender: "customer" | "ai" | "human";
  text: string;
  time: string;
}

interface Conversation {
  id: number;
  customerName: string;
  customerPhone: string;
  status: "ai_active" | "human_takeover" | "closed";
  avatar: string;
  unread: boolean;
  messages: Message[];
}

interface Order {
  id: string;
  customer: string;
  date: string;
  status: "discussing" | "confirmed" | "sent_to_courier" | "delivered" | "paid" | "cancelled";
  paymentStatus: "paid" | "pending" | "overdue";
  total: number;
}

interface Customer {
  name: string;
  phone: string;
  firstContact: string;
  tags: string[];
  totalSpent: number;
}

interface Courier {
  name: string;
  phone: string;
  active: boolean;
  load: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [showOrderModal, setShowOrderModal] = useState<boolean>(false);
  const [followupsActive, setFollowupsActive] = useState<boolean>(true);
  
  // Modal states
  const [modalCustomer, setModalCustomer] = useState<string>("1");
  const [modalProduct, setModalProduct] = useState<string>("150000");
  const [modalZone, setModalZone] = useState<string>("Medina");

  // State data
  const [conversations, setConversations] = useState<Conversation[]>([
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
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: "CMD-2026-001", customer: "Youssou Ndiaye", date: "14/08/2026", status: "discussing", paymentStatus: "pending", total: 252500 },
    { id: "CMD-2026-002", customer: "Fatou Diome", date: "14/08/2026", status: "confirmed", paymentStatus: "pending", total: 151500 },
    { id: "CMD-2026-003", customer: "Mariama Bâ", date: "13/08/2026", status: "paid", paymentStatus: "paid", total: 66500 },
    { id: "CMD-2026-004", customer: "Amadou Diallo", date: "12/08/2026", status: "sent_to_courier", paymentStatus: "pending", total: 402500 },
    { id: "CMD-2026-005", customer: "Khady Sy", date: "10/08/2026", status: "delivered", paymentStatus: "overdue", total: 85000 }
  ]);

  const [customers] = useState<Customer[]>([
    { name: "Youssou Ndiaye", phone: "+221 77 654 32 10", firstContact: "14/08/2026", tags: ["Client VIP", "Tech"], totalSpent: 0 },
    { name: "Fatou Diome", phone: "+221 78 123 45 67", firstContact: "12/08/2026", tags: ["Nouveau"], totalSpent: 151500 },
    { name: "Mariama Bâ", phone: "+221 70 987 65 43", firstContact: "01/08/2026", tags: ["Fidèle"], totalSpent: 350000 }
  ]);

  const [couriers] = useState<Courier[]>([
    { name: "Moussa Sarr", phone: "+221 77 555 11 22", active: true, load: 2 },
    { name: "Ousmane Sow", phone: "+221 77 444 33 22", active: true, load: 0 },
    { name: "Ibrahima Diallo", phone: "+221 76 222 99 88", active: false, load: 0 }
  ]);

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const triggerToast = (message: string, type: "success" | "warning" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatFCFA = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(value).replace("XOF", "FCFA");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || activeChatId === null) return;

    setConversations(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          messages: [
            ...c.messages,
            {
              sender: "human",
              text: chatInput.trim(),
              time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return c;
    }));

    setChatInput("");
  };

  const toggleTakeover = () => {
    if (activeChatId === null) return;
    setConversations(prev => prev.map(c => {
      if (c.id === activeChatId) {
        const nextStatus = c.status === "human_takeover" ? "ai_active" : "human_takeover";
        triggerToast(
          nextStatus === "human_takeover" 
            ? "Reprise manuelle activée. L'IA est suspendue." 
            : "L'Agent IA de Mon Closeur a repris la main.",
          nextStatus === "human_takeover" ? "warning" : "info"
        );
        return { ...c, status: nextStatus as "ai_active" | "human_takeover" };
      }
      return c;
    }));
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const cName = modalCustomer === "1" ? "Youssou Ndiaye" : modalCustomer === "2" ? "Fatou Diome" : "Mariama Bâ";
    const basePrice = parseInt(modalProduct);
    const deliveryPrice = modalZone === "Almadies" ? 2500 : 1500;
    const totalAmount = basePrice + deliveryPrice;
    const newId = `CMD-2026-0${orders.length + 1}`;

    const newOrder: Order = {
      id: newId,
      customer: cName,
      date: new Date().toLocaleDateString('fr-FR'),
      status: "confirmed",
      paymentStatus: "pending",
      total: totalAmount
    };

    setOrders(prev => [newOrder, ...prev]);
    setShowOrderModal(false);
    triggerToast(`Commande ${newId} créée avec succès. Facturation envoyée par WhatsApp.`, "success");
  };

  const triggerPDFDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    const content = `RAPPORT DE COMPTABILITE MON CLOSEUR\nPropriétaire: Tiedrebeogo Wilfried\nExportation du: ${new Date().toLocaleDateString('fr-FR')}\nTotal Facturé: 5 840 000 FCFA\nTotal Payé: 4 920 000 FCFA\nTaux Closing IA: 78.5%`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `mon-closeur-rapport-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    triggerToast("Rapport des ventes exporté avec succès.", "success");
  };

  const activeChat = conversations.find(c => c.id === activeChatId);

  const orderBadges = {
    discussing: <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">En discussion</span>,
    confirmed: <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Confirmée</span>,
    sent_to_courier: <span className="bg-orange-100 text-orange-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Envoyée au livreur</span>,
    delivered: <span className="bg-green-100 text-green-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Livrée</span>,
    paid: <span className="bg-emerald-200 text-emerald-900 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Payée</span>,
    cancelled: <span className="bg-red-100 text-red-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Annulée</span>
  };

  const paymentBadges = {
    paid: <span className="bg-green-100 text-green-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Payé</span>,
    pending: <span className="bg-orange-100 text-orange-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">En attente</span>,
    overdue: <span className="bg-red-100 text-red-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">En retard</span>
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row antialiased">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden w-full bg-encre text-neige px-6 py-4 flex items-center justify-between border-b border-graphite sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight text-corail">MON CLOSEUR</span>
          <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-green-950 text-green-400 rounded font-semibold">IA active</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-neige hover:text-corail focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
      </header>

      {/* Navigation Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-80 bg-encre text-neige flex flex-col justify-between border-r border-graphite p-8 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40 md:sticky md:h-screen shrink-0`}>
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-neige">MON CLOSEUR</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <span className="text-[10px] text-neige/50 mt-1 uppercase tracking-wider">Espace Client</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-neige/60 hover:text-corail">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            <button onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "dashboard" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span className="text-xs">Vue d'ensemble</span>
            </button>
            <button onClick={() => { setActiveTab("conversations"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "conversations" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <MessageSquare className="w-4.5 h-4.5" />
              <span className="text-xs flex-1">Conversations</span>
              <span className="text-[10px] bg-corail text-white px-2 py-0.5 rounded-full font-bold">2</span>
            </button>
            <button onClick={() => { setActiveTab("orders"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "orders" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <ShoppingBag className="w-4.5 h-4.5" />
              <span className="text-xs">Commandes</span>
            </button>
            <button onClick={() => { setActiveTab("customers"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "customers" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <Users className="w-4.5 h-4.5" />
              <span className="text-xs">Clients</span>
            </button>
            <button onClick={() => { setActiveTab("couriers"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "couriers" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <Truck className="w-4.5 h-4.5" />
              <span className="text-xs">Livreurs</span>
            </button>
            <button onClick={() => { setActiveTab("followups"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "followups" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <Clock className="w-4.5 h-4.5" />
              <span className="text-xs">Relances</span>
            </button>
            <button onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "settings" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <Settings className="w-4.5 h-4.5" />
              <span className="text-xs">Paramètres</span>
            </button>
          </nav>
        </div>

        <div className="flex flex-col gap-4 pt-6 border-t border-graphite">
          <div class="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-graphite flex items-center justify-center text-neige font-bold border border-corail/30 text-xs">
              WT
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-neige">Tiedrebeogo Wilfried</span>
              <span className="text-[9px] text-neige/40 font-semibold uppercase">Propriétaire</span>
            </div>
          </div>
          <div className="text-[9px] text-neige/40 font-semibold flex items-center justify-between">
            <span>Fait avec le vibe coding</span>
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-ping"></span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-neige">
        
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-10 py-6 border-b border-graphite/10 bg-white">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-encre">
              {activeTab === "dashboard" && "Vue d'ensemble"}
              {activeTab === "conversations" && "Conversations WhatsApp"}
              {activeTab === "orders" && "Commandes clients"}
              {activeTab === "customers" && "Fichier Clients"}
              {activeTab === "couriers" && "Suivi des Livreurs"}
              {activeTab === "followups" && "Campagnes de Relances"}
              {activeTab === "settings" && "Paramètres du Business"}
            </h1>
            <p className="text-xs text-encre/50 mt-0.5">
              {activeTab === "dashboard" && "Suivi en temps réel de vos ventes et de vos agents de closing IA."}
              {activeTab === "conversations" && "Simulez, supervisez et répondez aux messages de vos acheteurs."}
              {activeTab === "orders" && "Cycle de vie complet de facturation et d'expédition des commandes."}
              {activeTab === "customers" && "Statistiques d'achat et classification de votre clientèle."}
              {activeTab === "couriers" && "Assignation de courses et charges de livraison."}
              {activeTab === "followups" && "Configurez des relances automatiques par templates Meta WhatsApp."}
              {activeTab === "settings" && "Modifiez les consignes système de l'IA et vos zones logistiques."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neige px-3.5 py-1.5 rounded-lg border border-graphite/10 text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>Websocket connecté</span>
            </div>
            <button onClick={triggerPDFDownload} className="magnetic-btn bg-encre text-neige hover:bg-corail hover:text-neige font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all">
              <Download className="w-3.5 h-3.5" />
              <span>Exporter le rapport</span>
            </button>
          </div>
        </header>

        {/* Scrollable body content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
          
          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Total Commandes</span>
                    <ShoppingBag className="w-4 h-4 text-corail" />
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">142</span>
                    <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +12% cette semaine</span>
                  </div>
                </div>

                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Montant Facturé</span>
                    <span className="text-xs font-bold text-corail">XOF</span>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">5 840 000 FCFA</span>
                    <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +8.4% ce mois</span>
                  </div>
                </div>

                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Montant Payé</span>
                    <span className="text-[10px] font-bold text-green-600">Reçu</span>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">4 920 000 FCFA</span>
                    <span className="text-[10px] text-orange-600 font-semibold mt-1 truncate block">920 000 FCFA en attente</span>
                  </div>
                </div>

                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Taux de Conversion</span>
                    <UserCheck className="w-4 h-4 text-encre/30" />
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">78.5 %</span>
                    <span className="text-[10px] text-green-600 font-semibold mt-1">Closing Agent IA</span>
                  </div>
                </div>

              </div>

              {/* Graphic Performance and quick parameters info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="bg-white p-5 rounded-2xl border border-graphite/10 lg:col-span-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Performance IA vs Humain</span>
                      <span className="block text-sm font-bold text-encre mt-0.5">Évolution hebdomadaire</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-corail rounded-full"></span>
                        <span>IA Closeur</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-encre rounded-full"></span>
                        <span>Reprise Wilfried</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG graph mockup */}
                  <div className="w-full h-44 relative">
                    <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
                      <line x1="40" y1="170" x2="480" y2="170" stroke="#2D2D2D" strokeWidth="1" />
                      <line x1="40" y1="10" x2="40" y2="170" stroke="#2D2D2D" strokeWidth="1" />
                      <line x1="40" y1="130" x2="480" y2="130" stroke="#F0F0F2" strokeWidth="1" />
                      <line x1="40" y1="90" x2="480" y2="90" stroke="#F0F0F2" strokeWidth="1" />
                      <line x1="40" y1="50" x2="480" y2="50" stroke="#F0F0F2" strokeWidth="1" />
                      <line x1="40" y1="10" x2="480" y2="10" stroke="#F0F0F2" strokeWidth="1" />
                      <path d="M 50 130 L 120 70 L 190 98 L 260 30 L 330 50 L 400 2 L 470 58 L 470 170 L 50 170 Z" fill="url(#grad-corail)" opacity="0.15" />
                      <path d="M 50 130 L 120 70 L 190 98 L 260 30 L 330 50 L 400 2 L 470 58" fill="none" stroke="#E8634A" strokeWidth="2.5" />
                      <circle cx="50" cy="130" r="3" fill="#E8634A" />
                      <circle cx="120" cy="70" r="3" fill="#E8634A" />
                      <circle cx="190" cy="98" r="3" fill="#E8634A" />
                      <circle cx="260" cy="30" r="3" fill="#E8634A" />
                      <circle cx="330" cy="50" r="3" fill="#E8634A" />
                      <circle cx="400" cy="2" r="3" fill="#E8634A" />
                      <circle cx="470" cy="58" r="3" fill="#E8634A" />
                      <path d="M 50 150 L 120 138 L 190 122 L 260 130 L 330 110 L 400 98 L 470 126 L 470 170 L 50 170 Z" fill="url(#grad-encre)" opacity="0.05" />
                      <path d="M 50 150 L 120 138 L 190 122 L 260 130 L 330 110 L 400 98 L 470 126" fill="none" stroke="#1C1C1E" strokeWidth="1.5" strokeDasharray="3" />
                      <defs>
                        <linearGradient id="grad-corail" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#E8634A" />
                          <stop offset="100%" stopColor="#FAFAFA" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="grad-encre" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#1C1C1E" />
                          <stop offset="100%" stopColor="#FAFAFA" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="flex justify-between mt-2 text-[9px] text-encre/40 px-10">
                      <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut de l'Agent IA</span>
                    <h3 className="text-sm font-bold text-encre mt-0.5">Assistant WhatsApp Live</h3>
                    <p className="text-xs text-encre/60 mt-2 leading-relaxed">
                      L'IA de Mon Closeur analyse et répond en direct à vos prospects pour accélérer la prise de commande.
                    </p>
                    
                    <div className="mt-4 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between p-3 bg-neige rounded-xl border border-graphite/10">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span className="text-xs font-semibold">Tonalité active</span>
                        </div>
                        <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-graphite/10 text-corail">Chaleureux</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neige rounded-xl border border-graphite/10">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-encre/40" />
                          <span className="text-xs font-semibold">Workspace</span>
                        </div>
                        <span className="text-[9px] font-bold text-green-600 uppercase">Wilfried Tiedrebeogo</span>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => setActiveTab("settings")} className="magnetic-btn w-full bg-encre text-neige hover:bg-corail hover:text-neige font-bold py-2.5 rounded-xl text-center text-xs transition-all mt-4 flex items-center justify-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Ajuster les consignes</span>
                  </button>
                </div>

              </div>

              {/* Latest Orders */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-encre">Dernières commandes enregistrées</h3>
                    <p className="text-[10px] text-encre/50">Traitement en direct des fiches de ventes.</p>
                  </div>
                  <button onClick={() => setActiveTab("orders")} className="text-xs text-corail font-semibold hover:underline flex items-center gap-1">
                    <span>Voir tout</span>
                  </button>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest">
                        <th className="py-2.5 px-3">ID Commande</th>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Statut Commande</th>
                        <th className="py-2.5 px-3">Statut Paiement</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {orders.slice(0, 3).map(order => (
                        <tr key={order.id} className="border-b border-graphite/5 hover:bg-neige/40 transition-colors">
                          <td className="py-3 px-3 font-semibold text-encre">{order.id}</td>
                          <td className="py-3 px-3 font-semibold">{order.customer}</td>
                          <td className="py-3 px-3">{order.date}</td>
                          <td className="py-3 px-3">{orderBadges[order.status]}</td>
                          <td className="py-3 px-3">{paymentBadges[order.paymentStatus]}</td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONVERSATIONS */}
          {activeTab === "conversations" && (
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] min-h-0">
              
              {/* Left sidebar */}
              <div className="w-full lg:w-80 bg-white rounded-2xl border border-graphite/10 flex flex-col min-h-0 shrink-0">
                <div className="p-4 border-b border-graphite/10">
                  <input type="text" placeholder="Rechercher une discussion..." className="w-full bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-corail" />
                </div>
                
                <div className="flex-1 overflow-y-auto divide-y divide-graphite/5">
                  {conversations.map(conv => {
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    const badgeStyles = {
                      ai_active: "bg-green-100 text-green-800",
                      human_takeover: "bg-orange-100 text-orange-800",
                      closed: "bg-gray-100 text-gray-800"
                    };
                    const badgeLabels = {
                      ai_active: "IA active",
                      human_takeover: "Reprise",
                      closed: "Clôturée"
                    };

                    return (
                      <button key={conv.id} onClick={() => setActiveChatId(conv.id)} className={`w-full text-left p-4 flex flex-col gap-1.5 transition-colors hover:bg-neige/60 ${activeChatId === conv.id ? 'bg-neige-dark border-l-4 border-corail' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-encre">{conv.customerName}</span>
                          <span className="text-[9px] text-encre/40">{lastMsg ? lastMsg.time : ''}</span>
                        </div>
                        <p className="text-xs text-encre/60 truncate">{lastMsg ? lastMsg.text : ''}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${badgeStyles[conv.status]}`}>{badgeLabels[conv.status]}</span>
                          {conv.unread && <span className="w-2 h-2 bg-corail rounded-full"></span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 bg-white rounded-2xl border border-graphite/10 flex flex-col min-h-0">
                {activeChat ? (
                  <>
                    <div className="px-6 py-4 border-b border-graphite/10 flex items-center justify-between bg-neige/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-graphite text-neige font-bold flex items-center justify-center border border-corail/30 text-xs">
                          {activeChat.avatar}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-encre">{activeChat.customerName}</span>
                            <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${activeChat.status === "ai_active" ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{activeChat.status === "ai_active" ? 'IA active' : 'Reprise manuelle'}</span>
                          </div>
                          <span className="text-[10px] text-encre/40">{activeChat.customerPhone}</span>
                        </div>
                      </div>
                      <button onClick={toggleTakeover} className="magnetic-btn px-4 py-1.5 rounded-lg bg-white border border-graphite/20 hover:border-corail text-[10px] font-bold shadow-sm transition-all">
                        {activeChat.status === "human_takeover" ? "Laisser l'IA répondre" : "Prendre la main"}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neige/10">
                      {activeChat.messages.map((msg, idx) => (
                        <div key={idx} className={`flex w-full ${msg.sender === "customer" ? 'justify-start' : 'justify-end'}`}>
                          <div className="max-w-[70%] flex flex-col gap-0.5">
                            <span className="text-[9px] text-encre/40 px-1">{msg.sender === "customer" ? 'Client' : (msg.sender === "ai" ? 'Assistant IA' : 'Wilfried')}</span>
                            <div className={`px-4 py-2.5 rounded-[1.2rem] text-xs leading-relaxed ${msg.sender === "customer" ? 'bg-white border border-graphite/10 text-encre' : 'bg-encre text-neige'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-encre/30 px-1 text-right">{msg.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 border-t border-graphite/10 flex gap-3 bg-white">
                      <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={activeChat.status !== "human_takeover"} type="text" placeholder={`Répondre en tant que Tiedrebeogo Wilfried (reprise manuelle)...`} className="flex-1 bg-neige border border-graphite/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-corail" />
                      <button type="submit" disabled={activeChat.status !== "human_takeover"} className="magnetic-btn bg-encre text-neige px-4 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-corail transition-all">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-encre/30 text-xs gap-3">
                    <MessageSquare className="w-10 h-10 text-corail/60" />
                    <span className="font-semibold text-center max-w-xs leading-relaxed">Choisissez une discussion dans la liste de gauche pour interagir et simuler des réponses.</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB: ORDERS */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-graphite/10">
                <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-2 md:pb-0 w-full md:w-auto">
                  <button onClick={() => setOrderFilter("all")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "all" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>Toutes</button>
                  <button onClick={() => setOrderFilter("discussing")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "discussing" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>En discussion</button>
                  <button onClick={() => setOrderFilter("confirmed")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "confirmed" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>Confirmées</button>
                  <button onClick={() => setOrderFilter("sent_to_courier")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "sent_to_courier" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>Chez livreur</button>
                  <button onClick={() => setOrderFilter("delivered")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "delivered" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>Livrées</button>
                  <button onClick={() => setOrderFilter("paid")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-block shrink-0 ${orderFilter === "paid" ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}>Payées</button>
                </div>
                
                <button onClick={() => setShowOrderModal(true)} className="magnetic-btn bg-corail text-neige px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0">
                  <Plus className="w-4 h-4" />
                  <span>Créer une commande</span>
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-graphite/10">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                        <th className="py-3 px-4">ID Commande</th>
                        <th className="py-3 px-4">Client</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Statut Commande</th>
                        <th className="py-3 px-4">Statut Paiement</th>
                        <th className="py-3 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {orders.filter(o => orderFilter === "all" || o.status === orderFilter).map(order => (
                        <tr key={order.id} className="border-b border-graphite/5 hover:bg-neige/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-encre">{order.id}</td>
                          <td className="py-3.5 px-4 font-semibold">{order.customer}</td>
                          <td className="py-3.5 px-4">{order.date}</td>
                          <td className="py-3.5 px-4">{orderBadges[order.status]}</td>
                          <td className="py-3.5 px-4">{paymentBadges[order.paymentStatus]}</td>
                          <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === "customers" && (
            <div className="bg-white p-6 rounded-2xl border border-graphite/10">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                      <th className="py-3 px-4">Nom</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">Première interaction</th>
                      <th className="py-3 px-4">Tags</th>
                      <th className="py-3 px-4 text-right">Total dépensé</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {customers.map((customer, idx) => (
                      <tr key={idx} className="border-b border-graphite/5 hover:bg-neige/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold">{customer.name}</td>
                        <td className="py-3.5 px-4">{customer.phone}</td>
                        <td className="py-3.5 px-4">{customer.firstContact}</td>
                        <td className="py-3.5 px-4">
                          {customer.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="bg-graphite/5 text-graphite text-[10px] px-2 py-0.5 rounded border border-graphite/10 mr-1">{tag}</span>
                          ))}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(customer.totalSpent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: COURIERS */}
          {activeTab === "couriers" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {couriers.map((courier, idx) => (
                <div key={idx} className="interactive-card bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col justify-between h-40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-neige border border-graphite/10 rounded-full flex items-center justify-center font-bold text-xs text-encre/70">
                        {courier.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-encre">{courier.name}</span>
                        <span className="text-[10px] text-encre/40 font-semibold">{courier.phone}</span>
                      </div>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${courier.active ? 'bg-green-500' : 'bg-red-400'}`}></span>
                  </div>

                  <div className="flex items-center justify-between mt-4 border-t border-graphite/5 pt-3">
                    <span className="text-[10px] uppercase font-bold text-encre/40">Commandes actives</span>
                    <span className="text-base font-bold text-corail tabular-nums">{courier.load}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: FOLLOWUPS */}
          {activeTab === "followups" && (
            <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-encre">Relances WhatsApp Automatiques</h3>
                  <p className="text-[10px] text-encre/50 mt-0.5">Conformes aux fenêtres de 24h de l'API Meta WhatsApp Business Cloud.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-encre/60">Statut Global</span>
                  <button onClick={() => { setFollowupsActive(!followupsActive); triggerToast(followupsActive ? "Relances automatiques suspendues." : "Campagnes de relances réactivées.", followupsActive ? "warning" : "success"); }} className={`w-11 h-6 rounded-full relative transition-colors ${followupsActive ? 'bg-green-500' : 'bg-graphite'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${followupsActive ? 'left-6' : 'left-1'}`}></span>
                  </button>
                </div>
              </div>

              <div className="mt-4 border-l-2 border-corail/30 pl-6 ml-4 space-y-6">
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-corail rounded-full border-4 border-white"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-corail font-bold uppercase">Étape 1 — Après 1 heure d'inactivité</span>
                    <span className="text-xs font-bold text-encre">Rappel Panier Abandonné</span>
                    <p className="text-xs text-encre/60 mt-1 italic">
                      "Bonjour {{name}}, nous avons remarqué que vous n'avez pas validé votre panier pour {{total_amount}} FCFA. Souhaitez-vous de l'aide ?"
                    </p>
                    <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : "cart_recovery_fr"</span>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-corail rounded-full border-4 border-white"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-corail font-bold uppercase">Étape 2 — Après 24 heures</span>
                    <span className="text-xs font-bold text-encre">Offre de livraison prioritaire</span>
                    <p className="text-xs text-encre/60 mt-1 italic">
                      "Bonjour {{name}} ! Finalisez votre commande aujourd'hui et profitez d'une expédition rapide pour {{delivery_zone}}."
                    </p>
                    <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : "delivery_incentive_fr"</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col gap-5">
                <h3 className="text-sm font-bold text-encre">Instructions de l'Agent IA</h3>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-encre/50">Tonalité conversationnelle</label>
                  <select className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-corail font-bold">
                    <option>Chaleureux et Respectueux</option>
                    <option>Direct et Professionnel</option>
                    <option>Amical et Détendu</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-encre/50">Consignes système (Prompt de base)</label>
                  <textarea rows={5} className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-corail leading-relaxed" defaultValue="Tu es l'agent IA de vente de la boutique de Wilfried Tiedrebeogo. Tu vends des pièces de rechange et du matériel informatique de haute qualité. Parle de manière chaleureuse, accueille les clients avec politesse et réponds toujours en proposant les prix exacts en FCFA. Utilise les outils de calcul pour valider les coûts de livraison." />
                </div>

                <button onClick={() => triggerToast("Instructions enregistrées dans Supabase pour Tiedrebeogo Wilfried.", "success")} className="magnetic-btn bg-encre text-neige hover:bg-corail hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all">
                  Enregistrer la configuration IA
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-5">
                  <h3 class="text-sm font-bold text-encre">Zones de livraison & Tarifs</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-1">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Zone A (Proche)</span>
                      <span className="text-xs font-bold">1 500 FCFA</span>
                      <span className="text-[9px] text-encre/50">Délai : 2h à 4h</span>
                    </div>
                    
                    <div className="p-3 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-1">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Zone B (Éloignée)</span>
                      <span className="text-xs font-bold">2 500 FCFA</span>
                      <span className="text-[9px] text-encre/50">Délai : 3h à 5h</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-encre/50">Numéro WhatsApp Meta Business ID</label>
                    <input type="text" value="105943895748395" className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-corail font-mono" disabled />
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200/50 text-[10px] flex gap-2.5 items-start">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600" />
                  <div>
                    <span className="font-bold">Sécurité d'accès</span><br />
                    L'API Meta requiert un jeton d'accès permanent stocké de manière isolée pour Tiedrebeogo Wilfried.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Manual order modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-2xl border border-graphite/10 p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-encre">Créer une commande manuelle</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-encre/50 hover:text-corail">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Client</label>
                <select value={modalCustomer} onChange={(e) => setModalCustomer(e.target.value)} className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail">
                  <option value="1">Youssou Ndiaye</option>
                  <option value="2">Fatou Diome</option>
                  <option value="3">Mariama Bâ</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Article / Produit</label>
                <select value={modalProduct} onChange={(e) => setModalProduct(e.target.value)} className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail">
                  <option value="150000">Disque SSD 1TB Enterprise — 150 000 FCFA</option>
                  <option value="65000">RAM DDR5 32GB Corsair — 65 000 FCFA</option>
                  <option value="250000">Processeur AMD Ryzen 9 — 250 000 FCFA</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Zone de livraison</label>
                <select value={modalZone} onChange={(e) => setModalZone(e.target.value)} className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail">
                  <option value="Medina">Zone A (+1 500 FCFA)</option>
                  <option value="Almadies">Zone B (+2 500 FCFA)</option>
                </select>
              </div>

              <button type="submit" className="magnetic-btn bg-corail text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2">
                Créer et Facturer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Simulated toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-encre text-neige px-4 py-3 rounded-xl border border-graphite shadow-2xl flex items-center gap-3 z-50 transition-all duration-300">
          <span className={`w-2 h-2 rounded-full ${toast.type === "success" ? 'bg-green-500' : toast.type === "warning" ? 'bg-corail' : 'bg-blue-500'}`} />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
