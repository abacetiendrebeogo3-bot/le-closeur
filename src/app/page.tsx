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
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  UserPlus
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

interface OrderItem {
  product: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customer: string;
  customerPhone: string;
  customerAddress: string;
  date: string;
  status: "discussing" | "confirmed" | "sent_to_courier" | "delivered" | "paid" | "cancelled";
  paymentStatus: "paid" | "pending" | "overdue";
  total: number;
  shippingFee: number;
  deliveryZone: string;
  items: OrderItem[];
  courier?: string;
  chatId?: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
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
  const [followupsActive, setFollowupsActive] = useState<boolean>(true);

  // Filters for Orders Tab
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");

  // Subviews within Tabs
  const [ordersSubView, setOrdersSubView] = useState<"list" | "create" | "detail" | "edit">("list");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerSubView, setCustomerSubView] = useState<"list" | "history">("list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Modals / Modifiers
  const [showDeleteConfirmOrder, setShowDeleteConfirmOrder] = useState<string | null>(null);
  const [showDeleteConfirmCustomer, setShowDeleteConfirmCustomer] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState<{ mode: "create" | "edit", customerId?: string } | null>(null);

  // Zones catalog
  const zones = [
    { name: "Medina", fee: 1500 },
    { name: "Almadies", fee: 2500 },
    { name: "Plateau", fee: 2000 },
    { name: "Yoff", fee: 2000 },
    { name: "Pikine", fee: 3000 }
  ];

  // Products catalog
  const catalog = [
    { name: "Disque SSD 1TB Enterprise", price: 150000 },
    { name: "RAM DDR5 32GB Corsair", price: 65000 },
    { name: "Processeur AMD Ryzen 9", price: 250000 },
    { name: "Clavier Mécanique RGB", price: 45000 },
    { name: "Souris Gamer Sans Fil", price: 35000 }
  ];

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

  const [customers, setCustomers] = useState<Customer[]>([
    { id: "CUST-001", name: "Youssou Ndiaye", phone: "+221 77 654 32 10", email: "youssou@domain.sn", address: "Almadies, Villa 12, Dakar", firstContact: "14/08/2026", tags: ["Client VIP", "Tech"], totalSpent: 0 },
    { id: "CUST-002", name: "Fatou Diome", phone: "+221 78 123 45 67", email: "fatou@domain.sn", address: "Medina, Rue 6, Dakar", firstContact: "12/08/2026", tags: ["Nouveau"], totalSpent: 151500 },
    { id: "CUST-003", name: "Mariama Bâ", phone: "+221 70 987 65 43", email: "mariama@ba-associates.sn", address: "Plateau, Immeuble A, Dakar", firstContact: "01/08/2026", tags: ["Fidèle"], totalSpent: 350000 }
  ]);

  const [orders, setOrders] = useState<Order[]>([
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
  ]);

  const [couriers, setCouriers] = useState<Courier[]>([
    { name: "Moussa Sarr", phone: "+221 77 555 11 22", active: true, load: 1 },
    { name: "Ousmane Sow", phone: "+221 77 444 33 22", active: true, load: 0 },
    { name: "Ibrahima Diallo", phone: "+221 76 222 99 88", active: false, load: 0 }
  ]);

  // FORM STATES
  // Customer Form
  const [custFormName, setCustFormName] = useState("");
  const [custFormPhone, setCustFormPhone] = useState("");
  const [custFormEmail, setCustFormEmail] = useState("");
  const [custFormAddress, setCustFormAddress] = useState("");

  // Order Form
  const [orderFormId, setOrderFormId] = useState<string | null>(null); // null means create, string means edit
  const [orderFormCustomerId, setOrderFormCustomerId] = useState("CUST-001");
  const [orderFormNewClientInline, setOrderFormNewClientInline] = useState(false);
  const [orderFormInlineName, setOrderFormInlineName] = useState("");
  const [orderFormInlinePhone, setOrderFormInlinePhone] = useState("");
  const [orderFormDate, setOrderFormDate] = useState(new Date().toISOString().substring(0, 10));
  const [orderFormZone, setOrderFormZone] = useState("Medina");
  const [orderFormItems, setOrderFormItems] = useState<OrderItem[]>([{ product: "Disque SSD 1TB Enterprise", quantity: 1, price: 150000 }]);

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const triggerToast = (message: string, type: "success" | "warning" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatFCFA = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(Math.round(value)).replace("XOF", "FCFA");
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

  // ORDER FORM ACTIONS
  const getSelectedClientDetails = () => {
    if (orderFormNewClientInline) {
      return {
        name: orderFormInlineName || "Nouveau client",
        phone: orderFormInlinePhone || "",
        address: ""
      };
    }
    const found = customers.find(c => c.id === orderFormCustomerId);
    return found ? { name: found.name, phone: found.phone, address: found.address } : { name: "Inconnu", phone: "", address: "" };
  };

  const calculateFormSubtotal = () => {
    return orderFormItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const getFormDeliveryFee = () => {
    const matched = zones.find(z => z.name === orderFormZone);
    return matched ? matched.fee : 0;
  };

  const calculateFormTotal = () => {
    return calculateFormSubtotal() + getFormDeliveryFee();
  };

  const handleAddFormItemRow = () => {
    setOrderFormItems(prev => [...prev, { product: "Disque SSD 1TB Enterprise", quantity: 1, price: 150000 }]);
  };

  const handleRemoveFormItemRow = (index: number) => {
    if (orderFormItems.length <= 1) {
      triggerToast("Une commande doit contenir au moins une ligne.", "warning");
      return;
    }
    setOrderFormItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateFormItemProduct = (index: number, productName: string) => {
    const matchedProduct = catalog.find(p => p.name === productName);
    const price = matchedProduct ? matchedProduct.price : 0;
    setOrderFormItems(prev => prev.map((item, idx) => idx === index ? { ...item, product: productName, price } : item));
  };

  const handleUpdateFormItemField = (index: number, field: keyof OrderItem, value: any) => {
    setOrderFormItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const handleSaveOrder = (status: "discussing" | "confirmed") => {
    let clientName = "";
    let clientPhone = "";
    let clientAddress = "";

    if (orderFormNewClientInline) {
      if (!orderFormInlineName.trim() || !orderFormInlinePhone.trim()) {
        triggerToast("Le nom et le numéro WhatsApp du nouveau client sont requis.", "warning");
        return;
      }
      // Add client to clients list
      const newCustId = `CUST-0${customers.length + 1}`;
      const newCustomer: Customer = {
        id: newCustId,
        name: orderFormInlineName.trim(),
        phone: orderFormInlinePhone.trim(),
        email: "",
        address: "",
        firstContact: new Date().toLocaleDateString('fr-FR'),
        tags: ["Nouveau"],
        totalSpent: 0
      };
      setCustomers(prev => [...prev, newCustomer]);
      clientName = newCustomer.name;
      clientPhone = newCustomer.phone;
      clientAddress = "";
      
      // reset fields
      setOrderFormInlineName("");
      setOrderFormInlinePhone("");
    } else {
      const details = getSelectedClientDetails();
      clientName = details.name;
      clientPhone = details.phone;
      clientAddress = details.address;
    }

    const subtotal = calculateFormSubtotal();
    const deliveryFee = getFormDeliveryFee();
    const grandTotal = subtotal + deliveryFee;

    if (orderFormId) {
      // Editing
      setOrders(prev => prev.map(o => {
        if (o.id === orderFormId) {
          return {
            ...o,
            customer: clientName,
            customerPhone: clientPhone,
            customerAddress: clientAddress,
            date: orderFormDate,
            deliveryZone: orderFormZone,
            shippingFee: deliveryFee,
            items: orderFormItems,
            total: grandTotal,
            status: status
          };
        }
        return o;
      }));
      triggerToast(`Commande ${orderFormId} mise à jour avec succès.`, "success");
    } else {
      // Creating
      const newId = `CMD-2026-0${orders.length + 1}`;
      const newOrder: Order = {
        id: newId,
        customer: clientName,
        customerPhone: clientPhone,
        customerAddress: clientAddress,
        date: orderFormDate,
        status: status,
        paymentStatus: "pending",
        deliveryZone: orderFormZone,
        shippingFee: deliveryFee,
        items: orderFormItems,
        total: grandTotal
      };
      setOrders(prev => [newOrder, ...prev]);
      triggerToast(`Commande ${newId} enregistrée en statut : ${status === "discussing" ? "En discussion" : "Confirmée"}.`, "success");
    }

    // Go back to list
    setOrdersSubView("list");
  };

  // ORDER ACTIONS (DETAIL VIEW)
  const handleAdvanceOrderStatus = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let nextStatus: Order["status"] = o.status;
        let nextPayment = o.paymentStatus;
        if (o.status === "discussing") nextStatus = "confirmed";
        else if (o.status === "confirmed") nextStatus = "sent_to_courier";
        else if (o.status === "sent_to_courier") nextStatus = "delivered";
        else if (o.status === "delivered") {
          nextStatus = "paid";
          nextPayment = "paid";
          // update customer total spent
          updateCustomerSpend(o.customer, o.total);
        }
        
        triggerToast(`Statut de la commande ${o.id} mis à jour : ${nextStatus}`, "success");
        return { ...o, status: nextStatus, paymentStatus: nextPayment };
      }
      return o;
    }));
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        triggerToast(`Commande ${o.id} annulée.`, "info");
        return { ...o, status: "cancelled" };
      }
      return o;
    }));
  };

  const updateCustomerSpend = (customerName: string, amount: number) => {
    setCustomers(prev => prev.map(c => {
      if (c.name === customerName) {
        return { ...c, totalSpent: c.totalSpent + amount };
      }
      return c;
    }));
  };

  const handleAssignCourier = (orderId: string, courierName: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        triggerToast(`Livreur ${courierName} assigné à la commande ${o.id}.`, "success");
        return { ...o, courier: courierName, status: "sent_to_courier" };
      }
      return o;
    }));

    // update courier active load
    setCouriers(prev => prev.map(c => {
      if (c.name === courierName) {
        return { ...c, load: c.load + 1 };
      }
      return c;
    }));
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setShowDeleteConfirmOrder(null);
    setOrdersSubView("list");
    triggerToast(`Commande ${orderId} supprimée.`, "warning");
  };

  // CUSTOMER ACTIONS
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custFormName.trim() || !custFormPhone.trim()) {
      triggerToast("Le nom et le numéro WhatsApp sont requis.", "warning");
      return;
    }

    if (showCustomerModal?.mode === "edit" && showCustomerModal.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === showCustomerModal.customerId) {
          return {
            ...c,
            name: custFormName.trim(),
            phone: custFormPhone.trim(),
            email: custFormEmail.trim(),
            address: custFormAddress.trim()
          };
        }
        return c;
      }));
      // update orders client name if updated
      const oldCust = customers.find(c => c.id === showCustomerModal.customerId);
      if (oldCust && oldCust.name !== custFormName.trim()) {
        setOrders(prev => prev.map(o => o.customer === oldCust.name ? { ...o, customer: custFormName.trim() } : o));
      }
      triggerToast("Informations du client mises à jour.", "success");
    } else {
      const newId = `CUST-0${customers.length + 1}`;
      const newCustomer: Customer = {
        id: newId,
        name: custFormName.trim(),
        phone: custFormPhone.trim(),
        email: custFormEmail.trim(),
        address: custFormAddress.trim(),
        firstContact: new Date().toLocaleDateString('fr-FR'),
        tags: ["Nouveau"],
        totalSpent: 0
      };
      setCustomers(prev => [...prev, newCustomer]);
      triggerToast("Client ajouté avec succès.", "success");
    }

    // Reset Form
    setCustFormName("");
    setCustFormPhone("");
    setCustFormEmail("");
    setCustFormAddress("");
    setShowCustomerModal(null);
  };

  const handleDeleteCustomer = (customerId: string) => {
    const c = customers.find(c => c.id === customerId);
    setCustomers(prev => prev.filter(cust => cust.id !== customerId));
    setShowDeleteConfirmCustomer(null);
    triggerToast(`Client ${c?.name} supprimé.`, "warning");
  };

  const openEditCustomerModal = (customer: Customer) => {
    setCustFormName(customer.name);
    setCustFormPhone(customer.phone);
    setCustFormEmail(customer.email || "");
    setCustFormAddress(customer.address || "");
    setShowCustomerModal({ mode: "edit", customerId: customer.id });
  };

  const openCreateCustomerModal = () => {
    setCustFormName("");
    setCustFormPhone("");
    setCustFormEmail("");
    setCustFormAddress("");
    setShowCustomerModal({ mode: "create" });
  };

  const openEditOrderForm = (order: Order) => {
    setOrderFormId(order.id);
    const custObj = customers.find(c => c.name === order.customer);
    setOrderFormCustomerId(custObj ? custObj.id : "CUST-001");
    setOrderFormNewClientInline(false);
    setOrderFormDate(order.date);
    setOrderFormZone(order.deliveryZone);
    setOrderFormItems(order.items);
    setOrdersSubView("edit");
  };

  const openCreateOrderForm = () => {
    setOrderFormId(null);
    setOrderFormCustomerId(customers[0]?.id || "");
    setOrderFormNewClientInline(false);
    setOrderFormDate(new Date().toISOString().substring(0, 10));
    setOrderFormZone("Medina");
    setOrderFormItems([{ product: "Disque SSD 1TB Enterprise", quantity: 1, price: 150000 }]);
    setOrdersSubView("create");
  };

  const activeChat = conversations.find(c => c.id === activeChatId);

  const orderBadges = {
    discussing: <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">En discussion</span>,
    confirmed: <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Confirmée</span>,
    sent_to_courier: <span className="bg-orange-100 text-orange-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Chez livreur</span>,
    delivered: <span className="bg-cyan-100 text-cyan-800 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">En livraison</span>,
    paid: <span className="bg-green-100 text-green-900 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">Livrée & Payée</span>,
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
              <span className="text-xs">Vue d’ensemble</span>
            </button>
            <button onClick={() => { setActiveTab("conversations"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "conversations" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <MessageSquare className="w-4.5 h-4.5" />
              <span className="text-xs flex-1">Conversations</span>
              <span className="text-[10px] bg-corail text-white px-2 py-0.5 rounded-full font-bold">2</span>
            </button>
            <button onClick={() => { setActiveTab("orders"); setOrdersSubView("list"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "orders" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
              <ShoppingBag className="w-4.5 h-4.5" />
              <span className="text-xs">Commandes</span>
            </button>
            <button onClick={() => { setActiveTab("customers"); setCustomerSubView("list"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "customers" ? 'bg-corail text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
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
          <div className="flex items-center gap-3">
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
              {activeTab === "dashboard" && "Vue d’ensemble"}
              {activeTab === "conversations" && "Conversations WhatsApp"}
              {activeTab === "orders" && (
                ordersSubView === "list" ? "Commandes clients" :
                ordersSubView === "create" ? "Créer une commande" :
                ordersSubView === "edit" ? "Modifier la commande" :
                "Détail de la commande"
              )}
              {activeTab === "customers" && (
                customerSubView === "list" ? "Fichier Clients" : "Historique client"
              )}
              {activeTab === "couriers" && "Suivi des Livreurs"}
              {activeTab === "followups" && "Campagnes de Relances"}
              {activeTab === "settings" && "Paramètres du Business"}
            </h1>
            <p className="text-xs text-encre/50 mt-0.5">
              {activeTab === "dashboard" && "Suivi en temps réel de vos ventes et de vos agents de closing IA."}
              {activeTab === "conversations" && "Simulez, supervisez et répondez aux messages de vos acheteurs."}
              {activeTab === "orders" && (
                ordersSubView === "list" ? "Cycle de vie complet de facturation et d’expédition des commandes." :
                ordersSubView === "create" ? "Ajouter une nouvelle transaction client manuellement." :
                ordersSubView === "edit" ? "Formulaire de modification de la transaction sélectionnée." :
                "Consulter la progression de livraison et le détail des produits commandés."
              )}
              {activeTab === "customers" && (
                customerSubView === "list" ? "Statistiques d’achat et classification de votre clientèle." : "Historique complet des commandes passées par le client."
              )}
              {activeTab === "couriers" && "Assignation de courses et charges de livraison."}
              {activeTab === "followups" && "Configurez des relances automatiques par templates Meta WhatsApp."}
              {activeTab === "settings" && "Modifiez les consignes système de l’IA et vos zones logistiques."}
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
                    <span className="text-xl font-bold tabular-nums">{orders.length}</span>
                    <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +12% cette semaine</span>
                  </div>
                </div>

                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Montant Facturé</span>
                    <span className="text-xs font-bold text-corail">XOF</span>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">
                      {formatFCFA(orders.reduce((acc, o) => acc + o.total, 0))}
                    </span>
                    <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +8.4% ce mois</span>
                  </div>
                </div>

                <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between text-encre/50">
                    <span className="text-[9px] uppercase tracking-widest font-bold">Montant Payé</span>
                    <span className="text-[10px] font-bold text-green-600">Reçu</span>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-xl font-bold tabular-nums">
                      {formatFCFA(orders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0))}
                    </span>
                    <span className="text-[10px] text-orange-600 font-semibold mt-1 truncate block">
                      {formatFCFA(orders.filter(o => o.status !== "paid" && o.status !== "cancelled").reduce((acc, o) => acc + o.total, 0))} en attente
                    </span>
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
                    <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut de l’Agent IA</span>
                    <h3 className="text-sm font-bold text-encre mt-0.5">Assistant WhatsApp Live</h3>
                    <p className="text-xs text-encre/60 mt-2 leading-relaxed">
                      L’IA de Mon Closeur analyse et répond en direct à vos prospects pour accélérer la prise de commande.
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
                  <button onClick={() => { setActiveTab("orders"); setOrdersSubView("list"); }} className="text-xs text-corail font-semibold hover:underline flex items-center gap-1">
                    <span>Voir tout</span>
                  </button>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
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
                        <tr key={order.id} onClick={() => { setActiveTab("orders"); setSelectedOrderId(order.id); setOrdersSubView("detail"); }} className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer">
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
                            <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${activeChat.status === "ai_active" ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{activeChat.status === "ai_active" ? "IA active" : "Reprise manuelle"}</span>
                          </div>
                          <span className="text-[10px] text-encre/40">{activeChat.customerPhone}</span>
                        </div>
                      </div>
                      <button onClick={toggleTakeover} className="magnetic-btn px-4 py-1.5 rounded-lg bg-white border border-graphite/20 hover:border-corail text-[10px] font-bold shadow-sm transition-all">
                        {activeChat.status === "human_takeover" ? "Laisser l’IA répondre" : "Prendre la main"}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neige/10">
                      {activeChat.messages.map((msg, idx) => (
                        <div key={idx} className={`flex w-full ${msg.sender === "customer" ? 'justify-start' : 'justify-end'}`}>
                          <div className="max-w-[70%] flex flex-col gap-0.5">
                            <span className="text-[9px] text-encre/40 px-1">{msg.sender === "customer" ? "Client" : (msg.sender === "ai" ? "Assistant IA" : "Wilfried")}</span>
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
              
              {/* SUBVIEW: LIST */}
              {ordersSubView === "list" && (
                <>
                  <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-graphite/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Search Bar */}
                      <div className="relative flex-1 max-w-md">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-encre/30">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          placeholder="Rechercher par nom de client..."
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          className="w-full bg-neige border border-graphite/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-corail"
                        />
                      </div>
                      
                      <button onClick={openCreateOrderForm} className="magnetic-btn bg-corail text-neige px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start md:self-auto shrink-0">
                        <Plus className="w-4 h-4" />
                        <span>Créer une commande</span>
                      </button>
                    </div>

                    {/* Filters bar */}
                    <div className="flex flex-col gap-3 pt-3 border-t border-graphite/5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut de la commande</span>
                        <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-1">
                          {[
                            { id: "all", label: "Toutes" },
                            { id: "discussing", label: "En discussion" },
                            { id: "confirmed", label: "Confirmée" },
                            { id: "sent_to_courier", label: "Chez livreur" },
                            { id: "delivered", label: "En livraison" },
                            { id: "paid", label: "Livrée & Payée" },
                            { id: "cancelled", label: "Annulée" }
                          ].map(filter => (
                            <button
                              key={filter.id}
                              onClick={() => setOrderFilter(filter.id)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-block shrink-0 ${orderFilter === filter.id ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut du paiement</span>
                        <div className="flex gap-2">
                          {[
                            { id: "all", label: "Tous" },
                            { id: "pending", label: "En attente" },
                            { id: "paid", label: "Payé" },
                            { id: "overdue", label: "En retard" }
                          ].map(filter => (
                            <button
                              key={filter.id}
                              onClick={() => setPaymentFilter(filter.id)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-block shrink-0 ${paymentFilter === filter.id ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
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
                          {orders
                            .filter(o => orderFilter === "all" || o.status === orderFilter)
                            .filter(o => paymentFilter === "all" || o.paymentStatus === paymentFilter)
                            .filter(o => o.customer.toLowerCase().includes(orderSearchQuery.toLowerCase()))
                            .map(order => (
                              <tr
                                key={order.id}
                                onClick={() => { setSelectedOrderId(order.id); setOrdersSubView("detail"); }}
                                className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                              >
                                <td className="py-3.5 px-4 font-semibold text-encre">{order.id}</td>
                                <td className="py-3.5 px-4 font-semibold">{order.customer}</td>
                                <td className="py-3.5 px-4">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                                <td className="py-3.5 px-4">{orderBadges[order.status]}</td>
                                <td className="py-3.5 px-4">{paymentBadges[order.paymentStatus]}</td>
                                <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                              </tr>
                            ))}
                          {orders.filter(o => orderFilter === "all" || o.status === orderFilter).filter(o => paymentFilter === "all" || o.paymentStatus === paymentFilter).filter(o => o.customer.toLowerCase().includes(orderSearchQuery.toLowerCase())).length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-encre/30 font-semibold">Aucune commande ne correspond à vos filtres.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* SUBVIEW: CREATE / EDIT */}
              {(ordersSubView === "create" || ordersSubView === "edit") && (
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setOrdersSubView("list")} className="text-encre/50 hover:text-corail p-1 bg-neige rounded-lg border border-graphite/10">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-bold text-encre">
                      {orderFormId ? `Modifier la commande ${orderFormId}` : "Créer une commande manuelle"}
                    </h3>
                  </div>

                  <div className="flex flex-col gap-5">
                    {/* Customer Info Selection */}
                    <div className="p-4 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-encre/50">Sélection du client</span>
                        <button
                          type="button"
                          onClick={() => setOrderFormNewClientInline(!orderFormNewClientInline)}
                          className="text-[10px] font-bold text-corail flex items-center gap-1.5 hover:underline"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{orderFormNewClientInline ? "Sélectionner client existant" : "Créer un nouveau client"}</span>
                        </button>
                      </div>

                      {!orderFormNewClientInline ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={orderFormCustomerId}
                            onChange={(e) => setOrderFormCustomerId(e.target.value)}
                            className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold text-encre"
                          >
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 bg-white rounded-lg border border-graphite/5">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase font-bold text-encre/50">Nom complet *</label>
                            <input
                              type="text"
                              value={orderFormInlineName}
                              onChange={(e) => setOrderFormInlineName(e.target.value)}
                              placeholder="Ex: Amadou Fall"
                              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail font-semibold"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase font-bold text-encre/50">Numéro WhatsApp *</label>
                            <input
                              type="text"
                              value={orderFormInlinePhone}
                              onChange={(e) => setOrderFormInlinePhone(e.target.value)}
                              placeholder="Ex: +221 77 000 00 00"
                              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail font-semibold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Date */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-encre/50">Date de la commande</label>
                        <input
                          type="date"
                          value={orderFormDate}
                          onChange={(e) => setOrderFormDate(e.target.value)}
                          className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold"
                        />
                      </div>

                      {/* Shipping Zone */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-encre/50">Zone de livraison</label>
                        <select
                          value={orderFormZone}
                          onChange={(e) => setOrderFormZone(e.target.value)}
                          className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold text-encre"
                        >
                          {zones.map(z => (
                            <option key={z.name} value={z.name}>{z.name} (+{formatFCFA(z.fee)})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Order Lines */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] uppercase font-bold text-encre/50">Lignes de la commande</span>
                      <div className="flex flex-col gap-2.5">
                        {orderFormItems.map((item, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row gap-2.5 items-end md:items-center bg-neige/50 p-3 rounded-xl border border-graphite/5">
                            {/* Product selection / description */}
                            <div className="flex-1 w-full">
                              <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">Produit / Description</label>
                              <select
                                value={catalog.find(p => p.name === item.product) ? item.product : "custom"}
                                onChange={(e) => {
                                  if (e.target.value === "custom") {
                                    handleUpdateFormItemField(idx, "product", "");
                                    handleUpdateFormItemField(idx, "price", 0);
                                  } else {
                                    handleUpdateFormItemProduct(idx, e.target.value);
                                  }
                                }}
                                className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail font-semibold"
                              >
                                {catalog.map(cat => (
                                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                                ))}
                                <option value="custom">Saisie libre...</option>
                              </select>
                              {(!catalog.find(p => p.name === item.product)) && (
                                <input
                                  type="text"
                                  placeholder="Description personnalisée..."
                                  value={item.product}
                                  onChange={(e) => handleUpdateFormItemField(idx, "product", e.target.value)}
                                  className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail font-semibold mt-1.5"
                                />
                              )}
                            </div>

                            {/* Qty */}
                            <div className="w-20">
                              <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">Qté</label>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleUpdateFormItemField(idx, "quantity", parseInt(e.target.value) || 1)}
                                className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail text-center font-bold"
                              />
                            </div>

                            {/* Price */}
                            <div className="w-32">
                              <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">P. Unit (FCFA)</label>
                              <input
                                type="number"
                                min={0}
                                value={item.price}
                                onChange={(e) => handleUpdateFormItemField(idx, "price", parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-corail text-right font-bold"
                              />
                            </div>

                            {/* Total Line */}
                            <div className="w-32 text-right text-xs font-bold text-encre/70 tabular-nums">
                              {formatFCFA(item.price * item.quantity)}
                            </div>

                            {/* Delete Line */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFormItemRow(idx)}
                              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddFormItemRow}
                        className="magnetic-btn border border-dashed border-corail/50 text-corail py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-corail/5 mt-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter un produit</span>
                      </button>
                    </div>

                    {/* Totaux summary */}
                    <div className="mt-4 pt-4 border-t border-graphite/10 flex flex-col gap-2 align-end text-right">
                      <div className="text-xs text-encre/60">
                        <span>Sous-total produits : </span>
                        <span className="font-bold tabular-nums text-encre">{formatFCFA(calculateFormSubtotal())}</span>
                      </div>
                      <div className="text-xs text-encre/60">
                        <span>Frais de livraison ({orderFormZone}) : </span>
                        <span className="font-bold tabular-nums text-encre">{formatFCFA(getFormDeliveryFee())}</span>
                      </div>
                      <div className="text-sm font-extrabold text-encre mt-1">
                        <span>Montant total à payer : </span>
                        <span className="text-corail font-black tabular-nums">{formatFCFA(calculateFormTotal())}</span>
                      </div>
                    </div>

                    {/* Form actions */}
                    <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => handleSaveOrder("discussing")}
                        className="magnetic-btn bg-neige border border-graphite/20 hover:border-encre text-encre font-bold py-3 px-5 rounded-xl text-xs"
                      >
                        Enregistrer en discussion
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveOrder("confirmed")}
                        className="magnetic-btn bg-corail text-neige font-bold py-3 px-6 rounded-xl text-xs shadow-md shadow-corail/25"
                      >
                        {orderFormId ? "Mettre à jour la commande" : "Confirmer la commande"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW: DETAIL */}
              {ordersSubView === "detail" && selectedOrderId && (() => {
                const orderObj = orders.find(o => o.id === selectedOrderId);
                if (!orderObj) return <div className="text-center py-8">Commande introuvable</div>;
                
                const clientObj = customers.find(c => c.name === orderObj.customer);

                return (
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full">
                    {/* Header detail */}
                    <div className="flex items-center justify-between border-b border-graphite/5 pb-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setOrdersSubView("list")} className="text-encre/50 hover:text-corail p-1 bg-neige rounded-lg border border-graphite/10">
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                          <h3 className="text-sm font-bold text-encre flex items-center gap-2.5">
                            <span>Fiche Commande {orderObj.id}</span>
                            {orderBadges[orderObj.status]}
                          </h3>
                          <span className="text-[10px] text-encre/40">Enregistré le {new Date(orderObj.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditOrderForm(orderObj)} className="text-xs font-semibold text-encre/70 hover:text-corail p-2 bg-neige border border-graphite/10 rounded-xl flex items-center gap-1.5 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button onClick={() => setShowDeleteConfirmOrder(orderObj.id)} className="text-xs font-semibold text-red-600 hover:bg-red-50 p-2 border border-red-200/50 rounded-xl flex items-center gap-1.5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Client info */}
                      <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-2">
                        <span className="text-[9px] uppercase font-bold text-encre/40">Coordonnées Client</span>
                        <div className="text-xs font-bold text-encre">{orderObj.customer}</div>
                        <div className="text-xs text-encre/70">WhatsApp : {orderObj.customerPhone || clientObj?.phone}</div>
                        {clientObj?.email && <div className="text-xs text-encre/70">Email : {clientObj.email}</div>}
                        {orderObj.chatId && (
                          <button
                            onClick={() => {
                              setActiveChatId(orderObj.chatId!);
                              setActiveTab("conversations");
                            }}
                            className="text-[10px] font-bold text-corail flex items-center gap-1 hover:underline mt-2 self-start"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Voir la discussion WhatsApp d’origine</span>
                          </button>
                        )}
                      </div>

                      {/* Delivery info */}
                      <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-2">
                        <span className="text-[9px] uppercase font-bold text-encre/40">Logistique de livraison</span>
                        <div className="text-xs text-encre/80"><span className="font-bold">Zone :</span> {orderObj.deliveryZone}</div>
                        <div className="text-xs text-encre/80"><span className="font-bold">Frais de livraison :</span> {formatFCFA(orderObj.shippingFee)}</div>
                        <div className="text-xs text-encre/80"><span className="font-bold">Adresse complète :</span> {orderObj.customerAddress || clientObj?.address || "Non spécifiée"}</div>
                        {orderObj.courier ? (
                          <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200 mt-2 font-semibold">
                            Livreur assigné : {orderObj.courier}
                          </div>
                        ) : (
                          orderObj.status !== "cancelled" && orderObj.status !== "paid" && (
                            <div className="flex flex-col gap-1.5 mt-2">
                              <label className="text-[9px] uppercase font-bold text-encre/40">Assigner un coursier</label>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) handleAssignCourier(orderObj.id, e.target.value);
                                }}
                                defaultValue=""
                                className="bg-white border border-graphite/10 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-corail font-semibold text-encre"
                              >
                                <option value="" disabled>-- Choisir un livreur --</option>
                                {couriers.filter(c => c.active).map(c => (
                                  <option key={c.name} value={c.name}>{c.name} (charge active: {c.load})</option>
                                ))}
                              </select>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Order items detail */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[9px] uppercase font-bold text-encre/40">Articles Commandés</span>
                      <div className="border border-graphite/10 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neige font-bold text-[9px] uppercase tracking-widest text-encre/50 border-b border-graphite/10">
                            <tr>
                              <th className="py-2.5 px-4">Article</th>
                              <th className="py-2.5 px-4 text-center">Quantité</th>
                              <th className="py-2.5 px-4 text-right">Prix Unitaire</th>
                              <th className="py-2.5 px-4 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderObj.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-graphite/5">
                                <td className="py-3 px-4 font-semibold">{item.product}</td>
                                <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                                <td className="py-3 px-4 text-right tabular-nums">{formatFCFA(item.price)}</td>
                                <td className="py-3 px-4 text-right font-bold tabular-nums">{formatFCFA(item.price * item.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Totaux summary details */}
                    <div className="text-right flex flex-col gap-1.5 pt-3 border-t border-graphite/10">
                      <div className="text-xs text-encre/60">
                        <span>Sous-total produits : </span>
                        <span className="font-semibold text-encre tabular-nums">{formatFCFA(orderObj.total - orderObj.shippingFee)}</span>
                      </div>
                      <div className="text-xs text-encre/60">
                        <span>Frais de livraison : </span>
                        <span className="font-semibold text-encre tabular-nums">{formatFCFA(orderObj.shippingFee)}</span>
                      </div>
                      <div className="text-sm font-extrabold text-encre">
                        <span>Total de la facture : </span>
                        <span className="text-corail font-black tabular-nums">{formatFCFA(orderObj.total)}</span>
                      </div>
                      <div className="text-xs mt-1">
                        <span>Statut du paiement : </span>
                        {paymentBadges[orderObj.paymentStatus]}
                      </div>
                    </div>

                    {/* Actions workflow */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-neige p-4 rounded-xl border border-graphite/10 mt-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-encre/40 block">Cycle de vie de la commande</span>
                        <span className="text-xs font-semibold text-encre">Faire avancer l’état logistique de la commande.</span>
                      </div>

                      <div className="flex gap-2">
                        {orderObj.status !== "paid" && orderObj.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelOrder(orderObj.id)}
                            className="magnetic-btn bg-white hover:bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-bold"
                          >
                            Annuler la commande
                          </button>
                        )}
                        
                        {orderObj.status !== "paid" && orderObj.status !== "cancelled" && (
                          <button
                            onClick={() => handleAdvanceOrderStatus(orderObj.id)}
                            className="magnetic-btn bg-encre text-neige hover:bg-corail px-5 py-2.5 rounded-xl text-xs font-bold"
                          >
                            {orderObj.status === "discussing" && "Confirmer la commande"}
                            {orderObj.status === "confirmed" && "Expédier (Chez livreur)"}
                            {orderObj.status === "sent_to_courier" && "En livraison"}
                            {orderObj.status === "delivered" && "Marquer comme payée"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === "customers" && (
            <div className="flex flex-col gap-6">
              
              {/* SUBVIEW: LIST */}
              {customerSubView === "list" && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-graphite/10">
                    <h3 className="text-sm font-bold text-encre">Clients inscrits ({customers.length})</h3>
                    <button
                      onClick={openCreateCustomerModal}
                      className="magnetic-btn bg-corail text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter un client</span>
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-graphite/10">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                            <th className="py-3 px-4">Nom</th>
                            <th className="py-3 px-4">WhatsApp</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Adresse</th>
                            <th className="py-3 px-4 text-center">Commandes</th>
                            <th className="py-3 px-4 text-right">Dépenses</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {customers.map((customer) => {
                            const clientOrders = orders.filter(o => o.customer === customer.name);
                            const orderCount = clientOrders.length;
                            const totalSpentVal = clientOrders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);

                            return (
                              <tr
                                key={customer.id}
                                className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                                onClick={() => {
                                  setSelectedCustomerId(customer.id);
                                  setCustomerSubView("history");
                                }}
                              >
                                <td className="py-3.5 px-4 font-semibold text-encre">{customer.name}</td>
                                <td className="py-3.5 px-4 font-mono">{customer.phone}</td>
                                <td className="py-3.5 px-4 text-encre/60">{customer.email || "-"}</td>
                                <td className="py-3.5 px-4 text-encre/60 truncate max-w-[150px]">{customer.address || "-"}</td>
                                <td className="py-3.5 px-4 text-center font-bold tabular-nums">{orderCount}</td>
                                <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(totalSpentVal)}</td>
                                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => openEditCustomerModal(customer)}
                                      className="text-encre/60 hover:text-corail p-1 bg-neige border border-graphite/10 rounded-lg"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setShowDeleteConfirmCustomer(customer.id)}
                                      className="text-red-500 hover:text-red-700 p-1 bg-red-50 border border-red-100 rounded-lg"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* SUBVIEW: HISTORY */}
              {customerSubView === "history" && selectedCustomerId && (() => {
                const customerObj = customers.find(c => c.id === selectedCustomerId);
                if (!customerObj) return <div className="text-center py-8">Client introuvable</div>;

                const clientOrders = orders.filter(o => o.customer === customerObj.name);

                return (
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full">
                    <div className="flex items-center justify-between border-b border-graphite/5 pb-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setCustomerSubView("list")} className="text-encre/50 hover:text-corail p-1 bg-neige rounded-lg border border-graphite/10">
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                          <h3 className="text-sm font-bold text-encre">Historique des achats de {customerObj.name}</h3>
                          <span className="text-[10px] text-encre/40">WhatsApp: {customerObj.phone} | Adresse: {customerObj.address || "Non renseignée"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[10px] uppercase font-bold text-encre/40">Commandes du client ({clientOrders.length})</span>
                      
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                              <th className="py-2.5 px-3">ID Commande</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Statut Commande</th>
                              <th className="py-2.5 px-3">Statut Paiement</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientOrders.map(order => (
                              <tr
                                key={order.id}
                                onClick={() => {
                                  setSelectedOrderId(order.id);
                                  setOrdersSubView("detail");
                                  setActiveTab("orders");
                                }}
                                className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                              >
                                <td className="py-3 px-3 font-semibold text-encre">{order.id}</td>
                                <td className="py-3 px-3">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                                <td className="py-3 px-3">{orderBadges[order.status]}</td>
                                <td className="py-3 px-3">{paymentBadges[order.paymentStatus]}</td>
                                <td className="py-3 px-3 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                              </tr>
                            ))}
                            {clientOrders.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-encre/30 font-semibold">Aucune commande enregistrée pour ce client.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                  <p className="text-[10px] text-encre/50 mt-0.5">Conformes aux fenêtres de 24h de l’API Meta WhatsApp Business Cloud.</p>
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
                    <span className="text-[10px] text-corail font-bold uppercase">Étape 1 — Après 1 heure d’inactivité</span>
                    <span className="text-xs font-bold text-encre">Rappel Panier Abandonné</span>
                    <p className="text-xs text-encre/60 mt-1 italic">
                      {"« Bonjour {{name}}, nous avons remarqué que vous n’avez pas validé votre panier pour {{total_amount}} FCFA. Souhaitez-vous de l’aide ? »"}
                    </p>
                    <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : « cart_recovery_fr »</span>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-corail rounded-full border-4 border-white"></span>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-corail font-bold uppercase">Étape 2 — Après 24 heures</span>
                    <span className="text-xs font-bold text-encre">Offre de livraison prioritaire</span>
                    <p className="text-xs text-encre/60 mt-1 italic">
                      {"« Bonjour {{name}} ! Finalisez votre commande aujourd’hui et profitez d’une expédition rapide pour {{delivery_zone}}. »"}
                    </p>
                    <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : « delivery_incentive_fr »</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col gap-5">
                <h3 className="text-sm font-bold text-encre">Instructions de l’Agent IA</h3>
                
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
                  <h3 className="text-sm font-bold text-encre">Zones de livraison & Tarifs</h3>
                  
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
                    <span className="font-bold">Sécurité d’accès</span><br />
                    L’API Meta requiert un jeton d’accès permanent stocké de manière isolée pour Tiedrebeogo Wilfried.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* CONFIRMATION DELETE ORDER MODAL */}
      {showDeleteConfirmOrder && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-graphite/10 p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Supprimer la commande ?</span>
            </h3>
            <p className="text-xs text-encre/60">Êtes-vous sûr de vouloir supprimer la commande {showDeleteConfirmOrder} ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3.5 mt-2">
              <button onClick={() => setShowDeleteConfirmOrder(null)} className="px-3.5 py-2 bg-neige border border-graphite/10 rounded-xl text-xs font-semibold">Annuler</button>
              <button onClick={() => handleDeleteOrder(showDeleteConfirmOrder)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DELETE CUSTOMER MODAL */}
      {showDeleteConfirmCustomer && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-graphite/10 p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Supprimer le client ?</span>
            </h3>
            <p className="text-xs text-encre/60">Êtes-vous sûr de vouloir supprimer ce client ? Toutes ses informations de contact seront effacées.</p>
            <div className="flex justify-end gap-3.5 mt-2">
              <button onClick={() => setShowDeleteConfirmCustomer(null)} className="px-3.5 py-2 bg-neige border border-graphite/10 rounded-xl text-xs font-semibold">Annuler</button>
              <button onClick={() => handleDeleteCustomer(showDeleteConfirmCustomer)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CUSTOMER MODAL */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-2xl border border-graphite/10 p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-encre">
                {showCustomerModal.mode === "create" ? "Ajouter un nouveau client" : "Modifier le client"}
              </h3>
              <button onClick={() => setShowCustomerModal(null)} className="text-encre/50 hover:text-corail">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={custFormName}
                  onChange={(e) => setCustFormName(e.target.value)}
                  placeholder="Ex: Youssou Ndiaye"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Numéro WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={custFormPhone}
                  onChange={(e) => setCustFormPhone(e.target.value)}
                  placeholder="Ex: +221 77 654 32 10"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Email (optionnel)</label>
                <input
                  type="email"
                  value={custFormEmail}
                  onChange={(e) => setCustFormEmail(e.target.value)}
                  placeholder="Ex: client@domain.sn"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Adresse</label>
                <input
                  type="text"
                  value={custFormAddress}
                  onChange={(e) => setCustFormAddress(e.target.value)}
                  placeholder="Ex: Almadies, Villa 12, Dakar"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-corail font-semibold"
                />
              </div>

              <button type="submit" className="magnetic-btn bg-corail text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-md shadow-corail/20">
                Enregistrer le client
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
