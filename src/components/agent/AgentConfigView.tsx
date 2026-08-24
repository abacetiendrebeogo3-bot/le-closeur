import React, { useState, useEffect } from "react";
import { Sparkles, Bot, Shield, AlertCircle, Play, Eye, Send, ArrowRight, Check, Plus, Trash2, Image, HelpCircle } from "lucide-react";
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
  // Tabs State
  const [activeSubTab, setActiveSubTab] = useState<"identity" | "kb" | "sales" | "auto_rules" | "escalation" | "media">("identity");

  // Local config states
  const [identity, setIdentity] = useState(config.identity);
  const [salesRules, setSalesRules] = useState(config.salesRules);
  const [escalationRules, setEscalationRules] = useState(config.escalationRules);
  const [tone, setTone] = useState(config.tone);

  // KB & Rules & Media list states
  const [kbItems, setKbItems] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<Record<string, string>>({});

  // Form states for adding items
  const [newKbQuestion, setNewKbQuestion] = useState("");
  const [newKbResponse, setNewKbResponse] = useState("");
  const [isAddingKb, setIsAddingKb] = useState(false);

  const [newRuleCondition, setNewRuleCondition] = useState("");
  const [newRuleAction, setNewRuleAction] = useState("");
  const [isAddingRule, setIsAddingRule] = useState(false);

  const [newMediaKey, setNewMediaKey] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [isAddingMedia, setIsAddingMedia] = useState(false);

  // Sync props config to local state
  useEffect(() => {
    setIdentity(config.identity);
    setSalesRules(config.salesRules);
    setEscalationRules(config.escalationRules);
    setTone(config.tone);
  }, [config]);

  // Fetch KB, Rules, and Media Library from database
  const fetchKbAndRules = React.useCallback(async () => {
    if (!businessId) return;
    try {
      // Fetch Knowledge Base
      const { data: kbData } = await supabase
        .from("agent_knowledge_base")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (kbData) setKbItems(kbData);

      // Fetch Rules
      const { data: rulesData } = await supabase
        .from("agent_rules")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (rulesData) setRules(rulesData);

      // Fetch Media Library
      const { data: busData } = await supabase
        .from("businesses")
        .select("agent_media_library")
        .eq("id", businessId)
        .maybeSingle();
      if (busData?.agent_media_library) {
        setMediaLibrary(busData.agent_media_library as Record<string, string>);
      } else {
        setMediaLibrary({});
      }
    } catch (err) {
      console.error("Error loading agent configurations: ", err);
    }
  }, [businessId]);

  useEffect(() => {
    fetchKbAndRules();
  }, [businessId, fetchKbAndRules]);

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
    const formattedRules = rules
      .filter((r) => r.active)
      .map((r) => `- SI: "${r.condition}" -> ALORS: "${r.action}"`)
      .join("\n");

    const formattedKB = kbItems
      .filter((k) => k.active)
      .map((k) => `Q: ${k.question}\nR: ${k.reponse}`)
      .join("\n\n");

    const assembled = `[ROLE & IDENTITÉ]
${identity || "(Non renseigné)"}

[TONALITÉ CONVERSATIONNELLE]
${tone || "Chaleureux et Respectueux"}

[RÈGLES DE VENTE]
${salesRules || "(Aucune règle définie)"}

[RÈGLES AUTOMATIQUES (SI/ALORS)]
${formattedRules || "(Aucune règle automatique définie)"}

[RÈGLES D'ESCALADE]
${escalationRules || "(Aucune règle définie)"}

[BASE DE CONNAISSANCES]
${formattedKB || "(Aucune information supplémentaire)"}`;

    setSimulatedPrompt(assembled);
  }, [identity, salesRules, escalationRules, tone, rules, kbItems]);

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

  // Add KB Entry
  const handleAddKbEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbQuestion.trim() || !newKbResponse.trim()) {
      triggerToast("La question et la réponse sont requises.", "warning");
      return;
    }
    setIsAddingKb(true);
    try {
      const { data, error } = await supabase
        .from("agent_knowledge_base")
        .insert({
          business_id: businessId,
          question: newKbQuestion.trim(),
          reponse: newKbResponse.trim(),
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      setKbItems(prev => [...prev, data]);
      setNewKbQuestion("");
      setNewKbResponse("");
      triggerToast("Entrée ajoutée à la base de connaissances.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsAddingKb(false);
    }
  };

  // Toggle KB Entry Active Status
  const handleToggleKbActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_knowledge_base")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setKbItems(prev => prev.map(item => item.id === id ? { ...item, active: !currentStatus } : item));
      triggerToast("Statut mis à jour.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete KB Entry
  const handleDeleteKbEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agent_knowledge_base")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setKbItems(prev => prev.filter(item => item.id !== id));
      triggerToast("Entrée supprimée de la base de connaissances.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Add Rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleCondition.trim() || !newRuleAction.trim()) {
      triggerToast("La condition et l'action sont requises.", "warning");
      return;
    }
    setIsAddingRule(true);
    try {
      const { data, error } = await supabase
        .from("agent_rules")
        .insert({
          business_id: businessId,
          condition: newRuleCondition.trim(),
          action: newRuleAction.trim(),
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      setRules(prev => [...prev, data]);
      setNewRuleCondition("");
      setNewRuleAction("");
      triggerToast("Règle automatique ajoutée avec succès.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsAddingRule(false);
    }
  };

  // Toggle Rule Active Status
  const handleToggleRuleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_rules")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      setRules(prev => prev.map(r => r.id === id ? { ...r, active: !currentStatus } : r));
      triggerToast("Règle mise à jour.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agent_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setRules(prev => prev.filter(r => r.id !== id));
      triggerToast("Règle automatique supprimée.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Add Media item
  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaKey.trim() || !newMediaUrl.trim()) {
      triggerToast("La clé et l'URL du média sont requises.", "warning");
      return;
    }
    setIsAddingMedia(true);
    try {
      const nextMedia = { ...mediaLibrary, [newMediaKey.trim()]: newMediaUrl.trim() };
      const { error } = await supabase
        .from("businesses")
        .update({ agent_media_library: nextMedia })
        .eq("id", businessId);

      if (error) throw error;
      setMediaLibrary(nextMedia);
      setNewMediaKey("");
      setNewMediaUrl("");
      triggerToast("Média ajouté à la bibliothèque.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsAddingMedia(false);
    }
  };

  // Delete Media item
  const handleDeleteMedia = async (key: string) => {
    try {
      const nextMedia = { ...mediaLibrary };
      delete nextMedia[key];

      const { error } = await supabase
        .from("businesses")
        .update({ agent_media_library: nextMedia })
        .eq("id", businessId);

      if (error) throw error;
      setMediaLibrary(nextMedia);
      triggerToast("Média retiré de la bibliothèque.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
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
      
      {/* LEFT COLUMN: Tab-Based UI for Agent Configurations */}
      <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-5 min-h-[500px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-menthe/10 flex items-center justify-center text-menthe shrink-0">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-encre font-sans">Configuration de l&apos;Agent IA</h3>
            <span className="text-[10px] text-encre/40 font-semibold block font-sans">Définissez la personnalité et la base de connaissances du closeur</span>
          </div>
        </div>

        {/* Tab Controls Navigation */}
        <div className="flex flex-wrap gap-1.5 border-b border-graphite/10 pb-3">
          {[
            { id: "identity", label: "Identité & Ton" },
            { id: "kb", label: "Base de connaissances" },
            { id: "sales", label: "Règles de vente" },
            { id: "auto_rules", label: "Règles (SI/ALORS)" },
            { id: "escalation", label: "Règles d'escalade" },
            { id: "media", label: "Médiathèque" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all border ${
                activeSubTab === tab.id
                  ? "bg-encre text-white border-encre"
                  : "bg-neige text-encre/60 border-graphite/10 hover:text-encre"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 flex flex-col justify-between">
          
          {/* 1. IDENTITY & TONE TAB */}
          {activeSubTab === "identity" && (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-encre/50">Identité & Rôle de l&apos;agent *</label>
                <textarea
                  required
                  rows={6}
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Ex: Tu es l'agent IA de vente de notre commerce de cosmétiques..."
                  className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
                />
              </div>

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

              <button 
                type="submit" 
                className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-sm"
              >
                Enregistrer Identité & Ton
              </button>
            </form>
          )}

          {/* 2. KNOWLEDGE BASE (Q&A) TAB */}
          {activeSubTab === "kb" && (
            <div className="flex flex-col gap-4">
              {/* Form to add Q&A */}
              <form onSubmit={handleAddKbEntry} className="p-4 bg-neige rounded-2xl border border-graphite/10 flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-encre/60 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Ajouter une question/réponse
                </span>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Question (ex: Livrez-vous le dimanche ?)"
                    value={newKbQuestion}
                    onChange={(e) => setNewKbQuestion(e.target.value)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  />
                  <textarea
                    rows={2}
                    placeholder="Réponse (ex: Oui, de 8h à 20h.)"
                    value={newKbResponse}
                    onChange={(e) => setNewKbResponse(e.target.value)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingKb}
                  className="bg-encre hover:bg-menthe text-neige text-[10px] font-bold py-2 rounded-xl transition-all self-end px-4"
                >
                  {isAddingKb ? "Ajout en cours..." : "Ajouter au savoir"}
                </button>
              </form>

              {/* List of Q&As */}
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                <span className="text-[10px] uppercase font-bold text-encre/40">Savoirs Actifs ({kbItems.length})</span>
                {kbItems.length === 0 ? (
                  <span className="text-[10px] italic text-encre/40 text-center py-4">Aucune question/réponse enregistrée.</span>
                ) : (
                  kbItems.map((item) => (
                    <div key={item.id} className="p-3 bg-white border border-graphite/10 rounded-xl flex items-start justify-between gap-3 shadow-xs">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-encre">Q: {item.question}</span>
                        <p className="text-[10px] font-semibold text-encre/60 leading-relaxed">R: {item.reponse}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={() => handleToggleKbActive(item.id, item.active)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-menthe focus:ring-menthe cursor-pointer"
                        />
                        <button
                          onClick={() => handleDeleteKbEntry(item.id)}
                          className="p-1 text-encre/40 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. SALES RULES TAB */}
          {activeSubTab === "sales" && (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-encre/50">Règles de vente (Consignes commerciales)</label>
                <textarea
                  rows={8}
                  value={salesRules}
                  onChange={(e) => setSalesRules(e.target.value)}
                  placeholder="Ex: Les prix sont fixes. Pas de remise. Délais de livraison garantis..."
                  className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
                />
              </div>

              <button 
                type="submit" 
                className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-sm"
              >
                Enregistrer les règles de vente
              </button>
            </form>
          )}

          {/* 4. AUTO RULES (SI/ALORS) TAB */}
          {activeSubTab === "auto_rules" && (
            <div className="flex flex-col gap-4">
              {/* Form to add structured rule */}
              <form onSubmit={handleAddRule} className="p-4 bg-neige rounded-2xl border border-graphite/10 flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-encre/60 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Définir une règle SI/ALORS
                </span>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] uppercase font-bold text-encre/40">SI... (Condition)</label>
                    <input
                      type="text"
                      placeholder="Ex: Le client veut être livré le dimanche"
                      value={newRuleCondition}
                      onChange={(e) => setNewRuleCondition(e.target.value)}
                      className="bg-white border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] uppercase font-bold text-encre/40">ALORS... (Action de l&apos;agent)</label>
                    <input
                      type="text"
                      placeholder="Ex: Expliquer que nous livrons uniquement du lundi au samedi"
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value)}
                      className="bg-white border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAddingRule}
                  className="bg-encre hover:bg-menthe text-neige text-[10px] font-bold py-2 rounded-xl transition-all self-end px-4"
                >
                  {isAddingRule ? "Ajout..." : "Activer la règle"}
                </button>
              </form>

              {/* List of Rules */}
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                <span className="text-[10px] uppercase font-bold text-encre/40">Règles Conditionnelles ({rules.length})</span>
                {rules.length === 0 ? (
                  <span className="text-[10px] italic text-encre/40 text-center py-4">Aucune règle automatique configurée.</span>
                ) : (
                  rules.map((r) => (
                    <div key={r.id} className="p-3 bg-white border border-graphite/10 rounded-xl flex items-start justify-between gap-3 shadow-xs">
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-blue-100 text-blue-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">SI</span>
                          <span className="text-[10px] font-bold text-encre">{r.condition}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="bg-green-100 text-green-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">ALORS</span>
                          <p className="text-[10px] font-semibold text-encre/70 leading-relaxed">{r.action}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={() => handleToggleRuleActive(r.id, r.active)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-menthe focus:ring-menthe cursor-pointer"
                        />
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="p-1 text-encre/40 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. ESCALATION RULES TAB */}
          {activeSubTab === "escalation" && (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-encre/50">Règles d&apos;escalade (Reprise humaine) *</label>
                <textarea
                  required
                  rows={8}
                  value={escalationRules}
                  onChange={(e) => setEscalationRules(e.target.value)}
                  placeholder="Ex: Transférer le contrôle si le client s'énerve ou demande un remboursement..."
                  className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
                />
              </div>

              <button 
                type="submit" 
                className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-sm"
              >
                Enregistrer les règles d&apos;escalade
              </button>
            </form>
          )}

          {/* 6. MEDIA LIBRARY TAB */}
          {activeSubTab === "media" && (
            <div className="flex flex-col gap-4">
              {/* Form to add media entry */}
              <form onSubmit={handleAddMedia} className="p-4 bg-neige rounded-2xl border border-graphite/10 flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-encre/60 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Associer un visuel média
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Clé visuel (ex: temoignage_1)"
                    value={newMediaKey}
                    onChange={(e) => setNewMediaKey(e.target.value)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  />
                  <input
                    type="text"
                    placeholder="URL de l'image"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingMedia}
                  className="bg-encre hover:bg-menthe text-neige text-[10px] font-bold py-2 rounded-xl transition-all self-end px-4"
                >
                  {isAddingMedia ? "Ajout..." : "Enregistrer dans la médiathèque"}
                </button>
              </form>

              {/* List of media entries */}
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                <span className="text-[10px] uppercase font-bold text-encre/40">Médiathèque de l&apos;Agent ({Object.keys(mediaLibrary).length})</span>
                {Object.keys(mediaLibrary).length === 0 ? (
                  <span className="text-[10px] italic text-encre/40 text-center py-4">Aucun média enregistré dans la bibliothèque.</span>
                ) : (
                  Object.entries(mediaLibrary).map(([key, url]) => (
                    <div key={key} className="p-3 bg-white border border-graphite/10 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-neige border border-graphite/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {url ? (
                            <img src={url} alt={key} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none" }} />
                          ) : (
                            <Image className="w-4 h-4 text-encre/40" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-extrabold text-encre truncate">{key}</span>
                          <span className="text-[8px] font-mono text-encre/40 truncate">{url}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMedia(key)}
                        className="p-1 text-encre/40 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
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
