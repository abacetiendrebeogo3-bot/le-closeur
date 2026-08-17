import React, { useState, useEffect } from "react";
import { Sparkles, Bot, Shield, AlertCircle, Play, Eye, Send, ArrowRight, Check } from "lucide-react";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface AgentConfig {
  identity: string;
  salesRules: string;
  escalationRules: string;
  tone: string;
}

interface AgentConfigViewProps {
  config: AgentConfig;
  onSaveConfig: (newConfig: AgentConfig) => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  businessId: string;
}

interface ConversationItem {
  id: number;
  customerName: string;
  customerPhone: string;
  status: string;
}

export const AgentConfigView: React.FC<AgentConfigViewProps> = ({
  config,
  onSaveConfig,
  triggerToast,
  businessId
}) => {
  // Local state initialized with props
  const [identity, setIdentity] = useState(config.identity);
  const [salesRules, setSalesRules] = useState(config.salesRules);
  const [escalationRules, setEscalationRules] = useState(config.escalationRules);
  const [tone, setTone] = useState(config.tone);

  // Sync props config to local state
  useEffect(() => {
    setIdentity(config.identity);
    setSalesRules(config.salesRules);
    setEscalationRules(config.escalationRules);
    setTone(config.tone);
  }, [config]);

  // Simulator states
  const [simulatedPrompt, setSimulatedPrompt] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [customPhone, setCustomPhone] = useState("+221 77 000 00 00");
  const [customName, setCustomName] = useState("Client Test");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [lastToolsCalled, setLastToolsCalled] = useState<any[]>([]);

  // Fetch active conversations for testing selection
  useEffect(() => {
    if (!businessId) return;
    const fetchConvs = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, customer_name, customer_phone, status")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (data) {
        const mapped = data.map((c: any) => ({
          id: c.id,
          customerName: c.customer_name,
          customerPhone: c.customer_phone,
          status: c.status
        }));
        setConversations(mapped);
        if (data.length > 0 && !selectedConversationId) {
          setSelectedConversationId(data[0].id);
        }
      }
    };
    fetchConvs();
  }, [businessId, selectedConversationId]);

  // Fetch selected conversation messages
  useEffect(() => {
    if (!selectedConversationId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });

      if (data) {
        setChatMessages(data);
      }
    };
    fetchMessages();
  }, [selectedConversationId]);

  // Stagger entry animation
  useEffect(() => {
    gsap.fromTo(".config-card",
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
  }, []);

  // Update compiled preview prompt in real-time
  useEffect(() => {
    const assembled = `[ROLE & IDENTITÉ]
${identity || "(Non renseigné)"}

[TONALITÉ CONVERSATIONNELLE]
${tone || "Chaleureux et Respectueux"}

[RÈGLES DE VENTE]
${salesRules || "(Aucune règle définie)"}

[RÈGLES D'ESCALADE]
${escalationRules || "(Aucune règle définie)"}`;

    setSimulatedPrompt(assembled);
  }, [identity, salesRules, escalationRules, tone]);

  // Handle saving configurations
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      identity: identity.trim(),
      salesRules: salesRules.trim(),
      escalationRules: escalationRules.trim(),
      tone
    });
  };

  // Create a new simulated conversation
  const handleCreateTestConversation = async () => {
    if (!businessId) return;
    if (!customName.trim() || !customPhone.trim()) {
      triggerToast("Nom et numéro requis.", "warning");
      return;
    }

    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        customer_name: customName.trim(),
        customer_phone: customPhone.trim(),
        status: "ai_active",
        avatar: customName.trim().substring(0, 2).toUpperCase(),
        unread: false
      })
      .select()
      .single();

    if (error) {
      triggerToast(`Erreur : ${error.message}`, "warning");
    } else if (newConv) {
      setSelectedConversationId(newConv.id);
      setChatMessages([]);
      setLastToolsCalled([]);
      triggerToast(`Simulation commencée pour ${customName}`, "success");
    }
  };

  // Send message to agent API
  const handleSendSimMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedConversationId || loadingResponse) return;

    const userText = chatInput.trim();
    setChatInput("");
    setLoadingResponse(true);
    setLastToolsCalled([]);

    // 1. Insert user message in Supabase
    const timeStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: selectedConversationId,
      sender: "customer",
      text: userText,
      time: timeStr
    });

    if (msgErr) {
      triggerToast(`Erreur d'envoi: ${msgErr.message}`, "warning");
      setLoadingResponse(false);
      return;
    }

    // Update local chat UI
    setChatMessages(prev => [...prev, { sender: "customer", text: userText, time: timeStr }]);

    try {
      // 2. Query Respond API
      const res = await fetch("/api/agent/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          text: userText,
          businessId,
          messages: chatMessages
        })
      });

      const data = await res.json();

      if (data.error) {
        triggerToast(`Erreur Agent: ${data.error}`, "warning");
      } else {
        setChatMessages(prev => [...prev, { sender: "ai", text: data.text, time: timeStr }]);
        if (data.toolsCalled && data.toolsCalled.length > 0) {
          setLastToolsCalled(data.toolsCalled);
        }
      }
    } catch (err: any) {
      triggerToast(`Erreur de connexion : ${err.message}`, "warning");
    } finally {
      setLoadingResponse(false);
      // Force status refresh
      const { data: updatedConv } = await supabase
        .from("conversations")
        .select("status")
        .eq("id", selectedConversationId)
        .maybeSingle();

      if (updatedConv) {
        setConversations(prev => prev.map(c => c.id === selectedConversationId ? { ...c, status: updatedConv.status } : c));
      }
    }
  };

  const currentConv = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full text-encre bg-neige">
      
      {/* LEFT COLUMN: IA Config Forms */}
      <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-menthe/10 flex items-center justify-center text-menthe shrink-0">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-encre">Configuration de l&apos;Agent IA</h3>
            <span className="text-[10px] text-encre/40 font-semibold block">Définissez la personnalité et les limites de votre closeur automatique</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          
          {/* Identité & Rôle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Identité & Rôle de l&apos;agent *</label>
            <textarea
              required
              rows={4}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="Ex: Tu es l'agent IA de vente de notre commerce de cosmétiques. Accueille chaleureusement le client et propose le catalogue en FCFA..."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          {/* Tonalité */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Tonalité conversationnelle</label>
            <select 
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre"
            >
              <option value="Chaleureux et Respectueux">Chaleureux et Respectueux</option>
              <option value="Direct et Professionnel">Direct et Professionnel</option>
              <option value="Amical et Détendu">Amical et Détendu</option>
            </select>
          </div>

          {/* Règles de vente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Règles de vente (Consignes commerciales)</label>
            <textarea
              rows={3}
              value={salesRules}
              onChange={(e) => setSalesRules(e.target.value)}
              placeholder="Ex: Les prix sont fixes. Ne jamais accorder plus de 10% de réduction sans validation humaine. Ne pas promettre de livraison sous 1h."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          {/* Règles d'escalade */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Règles d&apos;escalade (Reprise humaine) *</label>
            <textarea
              required
              rows={3}
              value={escalationRules}
              onChange={(e) => setEscalationRules(e.target.value)}
              placeholder="Ex: Transférer immédiatement le contrôle (human_takeover) si le client s'énerve, s'il y a une plainte, ou s'il demande un produit personnalisé."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          <button 
            type="submit" 
            className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-sm"
          >
            Enregistrer la configuration IA
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Real-Time Preview & Live Simulator */}
      <div className="flex flex-col gap-6">
        
        {/* Dynamic Sandbox chat simulation panel */}
        <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-menthe" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Simulateur de conversation IA</span>
            </div>
            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-menthe/10 text-menthe border border-menthe/20">Live Sandbox</span>
          </div>

          {/* Selector or simulation initializer */}
          <div className="flex flex-col gap-3 p-3 bg-neige rounded-2xl border border-graphite/5">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Choisir une conversation de test</label>
              <select
                value={selectedConversationId || ""}
                onChange={(e) => setSelectedConversationId(Number(e.target.value))}
                className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-encre focus:outline-none"
              >
                <option value="">-- Sélectionner une conversation --</option>
                {conversations.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.customerName} ({c.customerPhone}) - [{c.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="h-[1px] bg-graphite/5 my-1"></div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <input
                  type="text"
                  placeholder="Nom du client fictif"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-white border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-encre"
                />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <input
                  type="text"
                  placeholder="Numéro WhatsApp"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="bg-white border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-encre"
                />
              </div>
            </div>
            <button
              onClick={handleCreateTestConversation}
              className="bg-encre hover:bg-menthe text-neige text-[10px] font-bold py-1.5 rounded-xl transition-colors"
            >
              Démarrer une nouvelle conversation test
            </button>
          </div>

          {/* Sandbox Chat Sandbox Box */}
          {selectedConversationId ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-[10px] text-encre/50 font-bold border-b border-graphite/5 pb-2">
                <span>Statut de la conversation : <span className="uppercase text-menthe font-extrabold">{currentConv?.status || "ai_active"}</span></span>
                {currentConv?.status === "human_takeover" && (
                  <span className="text-red-500 font-extrabold flex items-center gap-1">⚠️ Transféré</span>
                )}
              </div>

              {/* Message History area */}
              <div className="bg-neige rounded-2xl p-4 h-64 overflow-y-auto flex flex-col gap-2.5 border border-graphite/5">
                {chatMessages.length === 0 && (
                  <span className="text-[10px] text-encre/30 font-semibold italic text-center my-auto">Aucun message dans cette simulation. Envoyez un message pour démarrer la réponse de l&apos;agent.</span>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[80%] ${
                      msg.sender === "customer" ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <span className="text-[8px] font-bold text-encre/40 mb-0.5 uppercase">
                      {msg.sender === "customer" ? "Client" : "Agent IA"}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs font-semibold leading-relaxed whitespace-pre-wrap ${
                        msg.sender === "customer"
                          ? "bg-encre text-white rounded-tr-none"
                          : "bg-white text-encre border border-graphite/10 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loadingResponse && (
                  <div className="self-start flex items-center gap-1.5 bg-white border border-graphite/10 rounded-2xl rounded-tl-none px-3 py-2">
                    <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}
              </div>

              {/* Tools Called Log panel */}
              {lastToolsCalled.length > 0 && (
                <div className="p-3 bg-menthe/10 border border-menthe/20 rounded-2xl text-[10px] font-semibold text-encre">
                  <span className="font-bold flex items-center gap-1 text-menthe mb-1 uppercase">
                    <Check className="w-3.5 h-3.5" />
                    Outils exécutés par l&apos;IA :
                  </span>
                  <ul className="list-disc pl-4 space-y-1">
                    {lastToolsCalled.map((tool, index) => (
                      <li key={index} className="font-mono">
                        {tool.name}({JSON.stringify(tool.input)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chat Input form */}
              <form onSubmit={handleSendSimMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={currentConv?.status === "human_takeover" ? "IA Suspendue (Mode Reprise humaine)" : "Simuler un message client..."}
                  disabled={loadingResponse || currentConv?.status === "human_takeover"}
                  className="flex-1 bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold text-encre disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loadingResponse || currentConv?.status === "human_takeover"}
                  className="bg-encre hover:bg-menthe text-neige px-3.5 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="text-center py-6 text-[10px] text-encre/40 italic font-semibold">
              Veuillez sélectionner ou créer une conversation pour tester.
            </div>
          )}
        </div>

        {/* System prompt preview */}
        <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 text-encre/50">
            <Eye className="w-4 h-4 text-menthe" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Aperçu du prompt système compilé</span>
          </div>
          
          <div className="bg-encre text-neige/90 p-4 rounded-2xl border border-graphite/40 font-mono text-[10px] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {simulatedPrompt}
          </div>
        </div>

      </div>

    </div>
  );
};
