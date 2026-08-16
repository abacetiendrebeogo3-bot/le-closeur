"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase/client";
import { 
  Download, 
  Menu
} from "lucide-react";

import { Conversation, Customer, Order, Courier, OrderItem, Product, Zone } from "../types";
import { 
  initialZones, 
  initialCatalog, 
  initialConversations, 
  initialCustomers, 
  initialOrders, 
  initialCouriers 
} from "../lib/mock-data";

import { Sidebar } from "../components/Sidebar";
import { DashboardView } from "../components/dashboard/DashboardView";
import { ConversationsView } from "../components/conversations/ConversationsView";
import { OrdersListView } from "../components/orders/OrdersListView";
import { OrderForm } from "../components/orders/OrderForm";
import { OrderDetailView } from "../components/orders/OrderDetailView";
import { CustomersView } from "../components/customers/CustomersView";
import { CustomerForm } from "../components/customers/CustomerForm";
import { CustomerHistoryView } from "../components/customers/CustomerHistoryView";
import { CouriersView } from "../components/couriers/CouriersView";
import { FollowupsView } from "../components/followups/FollowupsView";
import { CatalogView } from "../components/catalog/CatalogView";
import { SettingsView } from "../components/settings/SettingsView";
import { AgentConfigView } from "../components/agent/AgentConfigView";
import { Toast } from "../components/ui/Toast";
import { ConfirmModal } from "../components/ui/ConfirmModal";

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

  // State data
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [couriers, setCouriers] = useState<Courier[]>(initialCouriers);
  const [products, setProducts] = useState<Product[]>(initialCatalog);
  const [zones, setZones] = useState<Zone[]>(initialZones);

  // Dynamic Supabase Ingestion Effect
  useEffect(() => {
    const fetchSupabaseData = async () => {
      try {
        // Fetch products
        const { data: pData, error: pErr } = await supabase.from("products").select("*");
        if (!pErr && pData && pData.length > 0) {
          setProducts(pData as Product[]);
        }

        // Fetch delivery zones
        const { data: zData, error: zErr } = await supabase.from("delivery_zones").select("*");
        if (!zErr && zData && zData.length > 0) {
          setZones(zData as Zone[]);
        }

        // Fetch customers
        const { data: cData, error: cErr } = await supabase.from("customers").select("*");
        if (!cErr && cData && cData.length > 0) {
          setCustomers(cData.map(c => ({
            ...c,
            tags: c.tags || [],
          })) as Customer[]);
        }

        // Fetch couriers
        const { data: coData, error: coErr } = await supabase.from("couriers").select("*");
        if (!coErr && coData && coData.length > 0) {
          setCouriers(coData as Courier[]);
        }

        // Fetch conversations
        const { data: convData, error: convErr } = await supabase
          .from("conversations")
          .select("*, messages(*)");
        if (!convErr && convData && convData.length > 0) {
          const mappedConvs = convData.map((c: any) => ({
            id: c.id,
            customerName: c.customer_name,
            customerPhone: c.customer_phone,
            status: c.status,
            avatar: c.avatar,
            unread: c.unread,
            messages: (c.messages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((m: any) => ({
              id: m.id,
              sender: m.sender,
              text: m.text,
              time: m.time
            }))
          }));
          setConversations(mappedConvs as Conversation[]);
        }

        // Fetch orders
        const { data: oData, error: oErr } = await supabase
          .from("orders")
          .select("*, order_items(*)");
        if (!oErr && oData && oData.length > 0) {
          const mappedOrders = oData.map((o: any) => ({
            id: o.id,
            customer: o.customer,
            customerPhone: o.customer_phone,
            customerAddress: o.customer_address,
            date: o.date,
            status: o.status,
            paymentStatus: o.payment_status,
            deliveryZone: o.delivery_zone,
            shippingFee: o.shipping_fee,
            total: o.total,
            courier: o.courier_name,
            chatId: o.chat_id,
            items: (o.order_items || []).map((item: any) => ({
              product: item.product,
              quantity: item.quantity,
              price: item.price
            }))
          }));
          setOrders(mappedOrders as Order[]);
        }
      } catch (err) {
        console.error("Supabase dynamic loading error: ", err);
      }
    };

    fetchSupabaseData();
  }, []);

  // FORM STATES
  // Customer Form
  const [custFormName, setCustFormName] = useState("");
  const [custFormPhone, setCustFormPhone] = useState("");
  const [custFormEmail, setCustFormEmail] = useState("");
  const [custFormAddress, setCustFormAddress] = useState("");

  // Order Form
  const [orderFormId, setOrderFormId] = useState<string | null>(null);
  const [orderFormCustomerId, setOrderFormCustomerId] = useState("CUST-001");
  const [orderFormNewClientInline, setOrderFormNewClientInline] = useState(false);
  const [orderFormInlineName, setOrderFormInlineName] = useState("");
  const [orderFormInlinePhone, setOrderFormInlinePhone] = useState("");
  const [orderFormDate, setOrderFormDate] = useState(new Date().toISOString().substring(0, 10));
  const [orderFormZone, setOrderFormZone] = useState("Medina");
  const [orderFormItems, setOrderFormItems] = useState<OrderItem[]>([{ product: initialCatalog[0].name, quantity: 1, price: initialCatalog[0].price }]);

  // Agent configuration
  const [agentConfig, setAgentConfig] = useState({
    identity: "Tu es l'agent IA de vente de la boutique de Wilfried Tiedrebeogo. Accueille chaleureusement les clients avec politesse et réponds toujours en proposant les prix exacts en FCFA.",
    salesRules: "Nos prix sont fermes et calculés au plus juste. Pas de remise sans validation préalable. Ne promettez jamais une livraison en moins de 2h.",
    escalationRules: "Transférer à un conseiller humain (reprise manuelle) si le client demande un remboursement, s'il a une réclamation concernant un produit défectueux, ou s'il demande un produit sur-mesure hors catalogue.",
    tone: "Chaleureux et Respectueux"
  });

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const triggerToast = (message: string, type: "success" | "warning" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatFCFA = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(Math.round(value)).replace("XOF", "FCFA");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || activeChatId === null) return;

    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeChatId,
      sender: "human",
      text: chatInput.trim(),
      time: timeStr
    });

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setConversations(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          messages: [
            ...c.messages,
            {
              id: `msg-${Date.now()}`,
              sender: "human",
              text: chatInput.trim(),
              time: timeStr
            }
          ]
        };
      }
      return c;
    }));

    setChatInput("");
  };

  const toggleTakeover = async () => {
    if (activeChatId === null) return;
    const chat = conversations.find(c => c.id === activeChatId);
    if (!chat) return;
    const nextStatus = chat.status === "human_takeover" ? "ai_active" : "human_takeover";

    const { error } = await supabase.from("conversations").update({
      status: nextStatus
    }).eq("id", activeChatId);

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setConversations(prev => prev.map(c => {
      if (c.id === activeChatId) {
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

  const getFormDeliveryFee = () => {
    const matched = zones.find(z => z.name === orderFormZone);
    return matched ? matched.fee : 0;
  };

  const handleSaveOrder = async (status: "discussing" | "confirmed") => {
    let clientName = "";
    let clientPhone = "";
    let clientAddress = "";

    if (orderFormNewClientInline) {
      if (!orderFormInlineName.trim() || !orderFormInlinePhone.trim()) {
        triggerToast("Le nom et le numéro WhatsApp du nouveau client sont requis.", "warning");
        return;
      }
      const newCustId = `CUST-0${customers.length + 1}`;
      const { error: custErr } = await supabase.from("customers").insert({
        id: newCustId,
        name: orderFormInlineName.trim(),
        phone: orderFormInlinePhone.trim(),
        email: "",
        address: "",
        first_contact: new Date().toLocaleDateString('fr-FR'),
        tags: ["Nouveau"],
        total_spent: 0
      });

      if (custErr) {
        triggerToast(`Erreur Supabase (Client): ${custErr.message}`, "warning");
        return;
      }

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
      
      setOrderFormInlineName("");
      setOrderFormInlinePhone("");
    } else {
      const details = getSelectedClientDetails();
      clientName = details.name;
      clientPhone = details.phone;
      clientAddress = details.address;
    }

    const subtotal = orderFormItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const deliveryFee = getFormDeliveryFee();
    const grandTotal = subtotal + deliveryFee;

    if (orderFormId) {
      // Update order in Supabase
      const { error: orderErr } = await supabase.from("orders").update({
        customer: clientName,
        customer_phone: clientPhone,
        customer_address: clientAddress,
        date: orderFormDate,
        delivery_zone: orderFormZone,
        shipping_fee: deliveryFee,
        total: grandTotal,
        status: status
      }).eq("id", orderFormId);

      if (orderErr) {
        triggerToast(`Erreur Supabase (Order): ${orderErr.message}`, "warning");
        return;
      }

      // Recreate order items
      await supabase.from("order_items").delete().eq("order_id", orderFormId);
      await supabase.from("order_items").insert(
        orderFormItems.map(item => ({
          order_id: orderFormId,
          product: item.product,
          quantity: item.quantity,
          price: item.price
        }))
      );

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
      // Create new order in Supabase
      const newId = `CMD-2026-0${orders.length + 1}`;
      const { error: orderErr } = await supabase.from("orders").insert({
        id: newId,
        customer: clientName,
        customer_phone: clientPhone,
        customer_address: clientAddress,
        date: orderFormDate,
        status: status,
        payment_status: "pending",
        delivery_zone: orderFormZone,
        shipping_fee: deliveryFee,
        total: grandTotal
      });

      if (orderErr) {
        triggerToast(`Erreur Supabase (Order): ${orderErr.message}`, "warning");
        return;
      }

      // Insert order items
      await supabase.from("order_items").insert(
        orderFormItems.map(item => ({
          order_id: newId,
          product: item.product,
          quantity: item.quantity,
          price: item.price
        }))
      );

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

    setOrdersSubView("list");
  };

  // ORDER ACTIONS (DETAIL VIEW)
  const handleAdvanceOrderStatus = async (orderId: string) => {
    const o = orders.find(ord => ord.id === orderId);
    if (!o) return;
    let nextStatus: Order["status"] = o.status;
    let nextPayment = o.paymentStatus;
    if (o.status === "discussing") nextStatus = "confirmed";
    else if (o.status === "confirmed") nextStatus = "sent_to_courier";
    else if (o.status === "sent_to_courier") nextStatus = "delivered";
    else if (o.status === "delivered") {
      nextStatus = "paid";
      nextPayment = "paid";
    }

    const { error } = await supabase.from("orders").update({
      status: nextStatus,
      payment_status: nextPayment
    }).eq("id", orderId);

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    if (nextStatus === "paid") {
      const cust = customers.find(c => c.name === o.customer);
      if (cust) {
        const nextSpent = cust.totalSpent + o.total;
        await supabase.from("customers").update({
          total_spent: nextSpent
        }).eq("id", cust.id);

        setCustomers(cPrev => cPrev.map(c => c.id === cust.id ? { ...c, totalSpent: nextSpent } : c));
      }
    }

    setOrders(prev => prev.map(ord => ord.id === orderId ? { ...ord, status: nextStatus, paymentStatus: nextPayment } : ord));
    triggerToast(`Statut de la commande ${orderId} mis à jour : ${nextStatus}`, "success");
  };

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").update({
      status: "cancelled"
    }).eq("id", orderId);

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        triggerToast(`Commande ${o.id} annulée.`, "info");
        return { ...o, status: "cancelled" };
      }
      return o;
    }));
  };

  const handleAssignCourier = async (orderId: string, courierName: string) => {
    const { error: orderErr } = await supabase.from("orders").update({
      courier_name: courierName,
      status: "sent_to_courier"
    }).eq("id", orderId);

    if (orderErr) {
      triggerToast(`Erreur Supabase: ${orderErr.message}`, "warning");
      return;
    }

    const cour = couriers.find(c => c.name === courierName);
    if (cour) {
      const nextLoad = cour.load + 1;
      await supabase.from("couriers").update({
        load: nextLoad
      }).eq("id", cour.id);

      setCouriers(prev => prev.map(c => c.id === cour.id ? { ...c, load: nextLoad } : c));
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        triggerToast(`Livreur ${courierName} assigné à la commande ${o.id}.`, "success");
        return { ...o, courier: courierName, status: "sent_to_courier" };
      }
      return o;
    }));
  };

  const handleDeleteOrder = async (orderId: string) => {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));
    setShowDeleteConfirmOrder(null);
    setOrdersSubView("list");
    triggerToast(`Commande ${orderId} supprimée.`, "warning");
  };

  // CUSTOMER ACTIONS
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custFormName.trim() || !custFormPhone.trim()) {
      triggerToast("Le nom et le numéro WhatsApp sont requis.", "warning");
      return;
    }

    if (showCustomerModal?.mode === "edit" && showCustomerModal.customerId) {
      const { error } = await supabase.from("customers").update({
        name: custFormName.trim(),
        phone: custFormPhone.trim(),
        email: custFormEmail.trim(),
        address: custFormAddress.trim()
      }).eq("id", showCustomerModal.customerId);

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

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
      const oldCust = customers.find(c => c.id === showCustomerModal.customerId);
      if (oldCust && oldCust.name !== custFormName.trim()) {
        await supabase.from("orders").update({
          customer: custFormName.trim()
        }).eq("customer", oldCust.name);

        setOrders(prev => prev.map(o => o.customer === oldCust.name ? { ...o, customer: custFormName.trim() } : o));
      }
      triggerToast("Informations du client mises à jour.", "success");
    } else {
      const newId = `CUST-0${customers.length + 1}`;
      const { error } = await supabase.from("customers").insert({
        id: newId,
        name: custFormName.trim(),
        phone: custFormPhone.trim(),
        email: custFormEmail.trim(),
        address: custFormAddress.trim(),
        first_contact: new Date().toLocaleDateString('fr-FR'),
        tags: ["Nouveau"],
        total_spent: 0
      });

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

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

    setCustFormName("");
    setCustFormPhone("");
    setCustFormEmail("");
    setCustFormAddress("");
    setShowCustomerModal(null);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const c = customers.find(cust => cust.id === customerId);
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

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
          <span className="text-lg font-extrabold tracking-tight text-menthe">MON CLOSEUR</span>
          <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 bg-green-950 text-green-400 rounded font-semibold">IA active</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-neige hover:text-menthe focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen}
        conversationsCount={conversations.filter(c => c.unread).length}
      />

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-neige">
        
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-10 py-6 border-b border-graphite/10 bg-white">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-encre">
              {activeTab === "dashboard" && "Vue d'ensemble"}
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
                ordersSubView === "list" ? "Cycle de vie complet de facturation et d'expédition des commandes." :
                ordersSubView === "create" ? "Ajouter une nouvelle transaction client manuellement." :
                ordersSubView === "edit" ? "Formulaire de modification de la transaction sélectionnée." :
                "Consulter la progression de livraison et le détail des produits commandés."
              )}
              {activeTab === "customers" && (
                customerSubView === "list" ? "Statistiques d'achat et classification de votre clientèle." : "Historique complet des commandes passées par le client."
              )}
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
            <button onClick={triggerPDFDownload} className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all">
              <Download className="w-3.5 h-3.5" />
              <span>Exporter le rapport</span>
            </button>
          </div>
        </header>

        {/* Scrollable body content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
          
          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <DashboardView 
              orders={orders}
              formatFCFA={formatFCFA}
              orderBadges={orderBadges}
              paymentBadges={paymentBadges}
              onViewOrder={(id) => { setSelectedOrderId(id); setOrdersSubView("detail"); setActiveTab("orders"); }}
              onNavigateToSettings={() => setActiveTab("settings")}
              onNavigateToOrders={() => { setActiveTab("orders"); setOrdersSubView("list"); }}
              onNavigateToConversations={() => setActiveTab("conversations")}
            />
          )}

          {/* TAB: CONVERSATIONS */}
          {activeTab === "conversations" && (
            <ConversationsView 
              conversations={conversations}
              setConversations={setConversations}
              customers={customers}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendMessage={handleSendMessage}
              toggleTakeover={toggleTakeover}
              triggerToast={triggerToast}
            />
          )}

          {/* TAB: ORDERS */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-6">
              {ordersSubView === "list" && (
                <OrdersListView 
                  orders={orders}
                  orderFilter={orderFilter}
                  setOrderFilter={setOrderFilter}
                  paymentFilter={paymentFilter}
                  setPaymentFilter={setPaymentFilter}
                  orderSearchQuery={orderSearchQuery}
                  setOrderSearchQuery={setOrderSearchQuery}
                  openCreateOrderForm={openCreateOrderForm}
                  setSelectedOrderId={setSelectedOrderId}
                  setOrdersSubView={setOrdersSubView}
                  orderBadges={orderBadges}
                  paymentBadges={paymentBadges}
                  formatFCFA={formatFCFA}
                />
              )}

              {(ordersSubView === "create" || ordersSubView === "edit") && (
                <OrderForm 
                  orderFormId={orderFormId}
                  orderFormCustomerId={orderFormCustomerId}
                  setOrderFormCustomerId={setOrderFormCustomerId}
                  orderFormNewClientInline={orderFormNewClientInline}
                  setOrderFormNewClientInline={setOrderFormNewClientInline}
                  orderFormInlineName={orderFormInlineName}
                  setOrderFormInlineName={setOrderFormInlineName}
                  orderFormInlinePhone={orderFormInlinePhone}
                  setOrderFormInlinePhone={setOrderFormInlinePhone}
                  orderFormDate={orderFormDate}
                  setOrderFormDate={setOrderFormDate}
                  orderFormZone={orderFormZone}
                  setOrderFormZone={setOrderFormZone}
                  orderFormItems={orderFormItems}
                  setOrderFormItems={setOrderFormItems}
                  customers={customers}
                  zones={zones}
                  catalog={products}
                  setOrdersSubView={setOrdersSubView}
                  handleSaveOrder={handleSaveOrder}
                  formatFCFA={formatFCFA}
                />
              )}

              {ordersSubView === "detail" && selectedOrderId && (
                <OrderDetailView 
                  selectedOrderId={selectedOrderId}
                  orders={orders}
                  customers={customers}
                  couriers={couriers}
                  setOrdersSubView={setOrdersSubView}
                  openEditOrderForm={openEditOrderForm}
                  setShowDeleteConfirmOrder={setShowDeleteConfirmOrder}
                  setActiveChatId={setActiveChatId}
                  setActiveTab={setActiveTab}
                  handleAssignCourier={handleAssignCourier}
                  handleCancelOrder={handleCancelOrder}
                  handleAdvanceOrderStatus={handleAdvanceOrderStatus}
                  formatFCFA={formatFCFA}
                  orderBadges={orderBadges}
                  paymentBadges={paymentBadges}
                />
              )}
            </div>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === "customers" && (
            <div className="flex flex-col gap-6">
              {customerSubView === "list" && (
                <CustomersView 
                  customers={customers}
                  orders={orders}
                  openCreateCustomerModal={openCreateCustomerModal}
                  openEditCustomerModal={openEditCustomerModal}
                  setShowDeleteConfirmCustomer={setShowDeleteConfirmCustomer}
                  setSelectedCustomerId={setSelectedCustomerId}
                  setCustomerSubView={setCustomerSubView}
                  formatFCFA={formatFCFA}
                />
              )}

              {customerSubView === "history" && selectedCustomerId && (
                <CustomerHistoryView 
                  selectedCustomerId={selectedCustomerId}
                  customers={customers}
                  orders={orders}
                  setCustomerSubView={setCustomerSubView}
                  setSelectedOrderId={setSelectedOrderId}
                  setOrdersSubView={setOrdersSubView}
                  setActiveTab={setActiveTab}
                  formatFCFA={formatFCFA}
                  orderBadges={orderBadges}
                  paymentBadges={paymentBadges}
                />
              )}
            </div>
          )}

          {/* TAB: CATALOG */}
          {activeTab === "catalog" && (
            <CatalogView 
              products={products}
              setProducts={setProducts}
              zones={zones}
              setZones={setZones}
              formatFCFA={formatFCFA}
              triggerToast={triggerToast}
            />
          )}

          {/* TAB: COURIERS */}
          {activeTab === "couriers" && (
            <CouriersView 
              couriers={couriers} 
              setCouriers={setCouriers}
              orders={orders}
              formatFCFA={formatFCFA}
              triggerToast={triggerToast}
            />
          )}

          {/* TAB: FOLLOWUPS */}
          {activeTab === "followups" && (
            <FollowupsView 
              followupsActive={followupsActive}
              setFollowupsActive={setFollowupsActive}
              triggerToast={triggerToast}
              onNavigateToChat={(clientName) => {
                const chat = conversations.find(c => c.customerName.toLowerCase() === clientName.toLowerCase());
                if (chat) {
                  setActiveChatId(chat.id);
                  setActiveTab("conversations");
                } else {
                  triggerToast(`Aucune conversation active trouvée pour ${clientName}`, "info");
                }
              }}
            />
          )}

          {/* TAB: AGENT CONFIG */}
          {activeTab === "agent-config" && (
            <AgentConfigView 
              config={agentConfig}
              onSaveConfig={setAgentConfig}
              triggerToast={triggerToast}
            />
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <SettingsView triggerToast={triggerToast} />
          )}

        </div>
      </main>

      {/* CONFIRMATION DELETE ORDER MODAL */}
      {showDeleteConfirmOrder && (
        <ConfirmModal 
          title="Supprimer la commande ?"
          message={`Êtes-vous sûr de vouloir supprimer la commande ${showDeleteConfirmOrder} ? Cette action est irréversible.`}
          onCancel={() => setShowDeleteConfirmOrder(null)}
          onConfirm={() => handleDeleteOrder(showDeleteConfirmOrder)}
        />
      )}

      {/* CONFIRMATION DELETE CUSTOMER MODAL */}
      {showDeleteConfirmCustomer && (
        <ConfirmModal 
          title="Supprimer le client ?"
          message="Êtes-vous sûr de vouloir supprimer ce client ? Toutes ses informations de contact seront effacées."
          onCancel={() => setShowDeleteConfirmCustomer(null)}
          onConfirm={() => handleDeleteCustomer(showDeleteConfirmCustomer)}
        />
      )}

      {/* CREATE / EDIT CUSTOMER MODAL */}
      <CustomerForm 
        showCustomerModal={showCustomerModal}
        setShowCustomerModal={setShowCustomerModal}
        custFormName={custFormName}
        setCustFormName={setCustFormName}
        custFormPhone={custFormPhone}
        setCustFormPhone={setCustFormPhone}
        custFormEmail={custFormEmail}
        setCustFormEmail={setCustFormEmail}
        custFormAddress={custFormAddress}
        setCustFormAddress={setCustFormAddress}
        handleSaveCustomer={handleSaveCustomer}
      />

      {/* Simulated toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} />
      )}

    </div>
  );
}
