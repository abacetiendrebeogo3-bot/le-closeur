import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Tag, 
  DollarSign, 
  User, 
  Bot, 
  UserCheck, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Play
} from "lucide-react";
import { Conversation, Customer } from "../../types";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface ConversationsViewProps {
  conversations: Conversation[];
  setConversations?: React.Dispatch<React.SetStateAction<Conversation[]>>;
  customers?: Customer[];
  activeChatId: number | null;
  setActiveChatId: (id: number | null) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  toggleTakeover: () => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  ownerName?: string;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  conversations,
  setConversations,
  customers = [],
  activeChatId,
  setActiveChatId,
  chatInput,
  setChatInput,
  handleSendMessage,
  toggleTakeover,
  triggerToast,
  ownerName
}) => {
  const activeChat = conversations.find(c => c.id === activeChatId);
  const [showCustomerSidebar, setShowCustomerSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages or typing status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, isTyping]);

  // Find customer associated with the active chat
  const customerInfo = activeChat
    ? customers.find(
        c => {
          const cPhone = c?.phone ? c.phone.replace(/\s+/g, "") : "";
          const activePhone = activeChat?.customerPhone ? activeChat.customerPhone.replace(/\s+/g, "") : "";
          const cName = c?.name ? c.name.toLowerCase() : "";
          const activeName = activeChat?.customerName ? activeChat.customerName.toLowerCase() : "";
          
          return (activePhone && cPhone === activePhone) || (activeName && cName === activeName);
        }
      )
    : null;

  // Staggered entry for conversation list items on load
  useEffect(() => {
    gsap.fromTo(".conv-item", 
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" }
    );
  }, []);

  // Staggered entry for messages when switching chat or receiving a message
  useEffect(() => {
    if (activeChatId) {
      gsap.fromTo(".chat-bubble", 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power3.out" }
      );
    }
  }, [activeChatId, activeChat?.messages.length, isTyping]);

  // Animate the sidebar when it opens
  useEffect(() => {
    if (showCustomerSidebar && sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { x: 100, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [showCustomerSidebar, activeChatId]);

  // Handle client message simulation
  const handleSimulateClient = async () => {
    if (!activeChatId || !setConversations) return;
    
    const clientQuestions = [
      "Bonjour, quel est le délai de livraison pour la RAM ?",
      "Est-ce que le SSD est compatible avec un serveur Dell ?",
      "Je voudrais commander le processeur Ryzen 9, c'est possible ?",
      "Bonjour, proposez-vous des facilités de paiement ?"
    ];
    const randomQuestion = clientQuestions[Math.floor(Math.random() * clientQuestions.length)];
    
    const customerTimeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    // Insert customer message into Supabase
    const { error: custErr } = await supabase.from("messages").insert({
      conversation_id: activeChatId,
      sender: "customer",
      text: randomQuestion,
      time: customerTimeStr
    });

    if (custErr) {
      triggerToast(`Erreur Supabase (Client Msg): ${custErr.message}`, "warning");
      return;
    }

    // 1. Add client message to state
    setConversations(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          unread: false,
          messages: [
            ...c.messages,
            {
              id: `msg-sim-cust-${Date.now()}`,
              sender: "customer",
              text: randomQuestion,
              time: customerTimeStr
            }
          ]
        };
      }
      return c;
    }));
    
    // 2. Trigger typing indicator
    setIsTyping(true);
    
    // 3. After 1.5s, add AI response
    setTimeout(async () => {
      setIsTyping(false);
      const aiResponses: Record<string, string> = {
        "Bonjour, quel est le délai de livraison pour la RAM ?": "Bonjour ! Le délai de livraison pour la RAM DDR5 Corsair est de 24h à Dakar. Souhaitez-vous valider votre commande ?",
        "Est-ce que le SSD est compatible avec un serveur Dell ?": "Oui, le Disque SSD 1TB Enterprise est parfaitement compatible avec les serveurs Dell PowerEdge. Nous pouvons l'expédier dès aujourd'hui !",
        "Je voudrais commander le processeur Ryzen 9, c'est possible ?": "Tout à fait ! Le Ryzen 9 est disponible en stock au prix de 250 000 FCFA. Souhaitez-vous une livraison aux Almadies ou Plateau ?",
        "Bonjour, proposez-vous des facilités de paiement ?": "Bonjour ! Nous acceptons les règlements par Wave, Orange Money ou en espèces à la livraison. Souhaitez-vous passer commande ?"
      };
      
      const aiReply = aiResponses[randomQuestion] || "L'agent IA de Mon Closeur est à votre service. Comment puis-je vous aider ?";
      const aiTimeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Insert AI message into Supabase
      const { error: aiErr } = await supabase.from("messages").insert({
        conversation_id: activeChatId,
        sender: "ai",
        text: aiReply,
        time: aiTimeStr
      });

      // Also ensure status is ai_active in DB
      await supabase.from("conversations").update({
        status: "ai_active"
      }).eq("id", activeChatId);

      if (aiErr) {
        console.error("Supabase error (AI response):", aiErr);
      }
      
      setConversations(prev => prev.map(c => {
        if (c.id === activeChatId) {
          return {
            ...c,
            status: "ai_active",
            messages: [
              ...c.messages,
              {
                id: `msg-sim-ai-${Date.now()}`,
                sender: "ai",
                text: aiReply,
                time: aiTimeStr
              }
            ]
          };
        }
        return c;
      }));
    }, 1500);
  };

  // Filter conversations list by search query
  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] min-h-0">
      
      {/* Left sidebar: ConversationList */}
      <div className={`w-full lg:w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shrink-0 shadow-sm ${activeChatId !== null ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-graphite/10">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une discussion..." 
            className="w-full bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold" 
          />
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-graphite/5">
          {filteredConversations.length > 0 ? (
            filteredConversations.map(conv => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const badgeStyles = {
                ai_active: "bg-menthe/10 text-menthe border border-menthe/20",
                human_takeover: "bg-orange-500/10 text-orange-600 border border-orange-500/20",
                closed: "bg-graphite/10 text-graphite-light border border-graphite/20"
              };
              const badgeLabels = {
                ai_active: "IA active",
                human_takeover: "Reprise",
                closed: "Clôturée"
              };

              return (
                <button 
                  key={conv.id} 
                  onClick={() => {
                    setActiveChatId(conv.id);
                    setShowCustomerSidebar(true);
                  }} 
                  className={`conv-item w-full text-left p-4 flex flex-col gap-1.5 transition-all hover:bg-neige/60 ${
                    activeChatId === conv.id ? 'bg-neige-dark/40 border-l-4 border-menthe font-bold' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-encre">{conv.customerName}</span>
                    <span className="text-[9px] text-encre/40">{lastMsg ? lastMsg.time : ''}</span>
                  </div>
                  <p className="text-xs text-encre/60 truncate">{lastMsg ? lastMsg.text : ''}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${badgeStyles[conv.status]}`}>
                      {badgeLabels[conv.status]}
                    </span>
                    {conv.unread && <span className="w-2 h-2 bg-menthe rounded-full animate-pulse"></span>}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-encre/40 italic">Aucune discussion trouvée.</div>
          )}
        </div>
      </div>

      {/* Right side: Flex container holding Chat & Customer sidebar */}
      <div className={`flex-1 flex gap-4 min-h-0 relative ${activeChatId === null ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Chat Window */}
        <div className="flex-1 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shadow-sm overflow-hidden">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div 
                className="px-4 md:px-6 py-4 border-b border-graphite/10 flex items-center justify-between bg-neige/30"
              >
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Back button on mobile */}
                  <button 
                    onClick={() => setActiveChatId(null)} 
                    className="lg:hidden p-1.5 hover:bg-neige rounded-lg border border-graphite/10 text-encre/60 hover:text-menthe transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div 
                    onClick={() => setShowCustomerSidebar(!showCustomerSidebar)}
                    className="w-9 h-9 rounded-full bg-encre text-neige font-bold flex items-center justify-center border border-menthe/30 text-xs shadow-sm cursor-pointer hover:scale-105 transition-transform"
                  >
                    {activeChat.avatar}
                  </div>
                  <div className="flex flex-col">
                    <div 
                      onClick={() => setShowCustomerSidebar(!showCustomerSidebar)}
                      className="flex items-center gap-1.5 cursor-pointer group"
                      title="Cliquez pour afficher/masquer les détails du client"
                    >
                      <span className="font-black text-xs text-encre group-hover:text-menthe transition-colors">
                        {activeChat.customerName}
                      </span>
                      {showCustomerSidebar ? (
                        <ChevronLeft className="w-3.5 h-3.5 text-menthe group-hover:scale-110 transition-transform" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-menthe group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <span className="text-[10px] text-encre/40 font-semibold">{activeChat.customerPhone}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Simulate Client Button */}
                  <button 
                    onClick={handleSimulateClient}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-menthe/10 hover:bg-menthe/20 text-menthe text-[10px] font-bold border border-menthe/20 transition-all shadow-sm"
                    title="Simuler un message entrant du client"
                  >
                    <Play className="w-3 h-3 fill-menthe" />
                    <span>Simuler Client</span>
                  </button>

                  <button 
                    onClick={toggleTakeover} 
                    className="magnetic-btn px-4 py-1.5 rounded-xl bg-white border border-graphite/20 hover:border-menthe text-[10px] font-bold shadow-sm transition-all"
                  >
                    {activeChat.status === "human_takeover" ? "Laisser l’IA répondre" : "Prendre la main"}
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neige/10">
                {activeChat.messages.map((msg, idx) => {
                  const isCust = msg.sender === "customer";
                  const isAI = msg.sender === "ai";
                  
                  return (
                    <div key={idx} className={`flex w-full ${isCust ? 'justify-start' : 'justify-end'}`}>
                      <div className={`chat-bubble flex items-start gap-2.5 max-w-[70%] ${isCust ? 'flex-row' : 'flex-row-reverse'}`}>
                        
                        {/* Inline sender icons */}
                        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] border shadow-sm ${
                          isCust 
                            ? 'bg-neige border-graphite/10 text-encre/60' 
                            : isAI 
                              ? 'bg-encre border-graphite text-menthe' 
                              : 'bg-menthe border-menthe/20 text-white'
                        }`}>
                          {isCust ? <User className="w-3 h-3" /> : isAI ? <Bot className="w-3.5 h-3.5" /> : <UserCheck className="w-3 h-3" />}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-encre/40 px-1">
                            {isCust 
                              ? 'Client' 
                              : isAI 
                                ? 'Assistant IA (Bot)' 
                                : ownerName 
                                  ? `${ownerName.split(" ")[0]} (Reprise)` 
                                  : 'Wilfried (Reprise)'}
                          </span>
                          <div className={`px-4 py-2.5 rounded-[1.2rem] text-xs leading-relaxed ${
                            isCust 
                              ? 'bg-white border border-graphite/10 text-encre shadow-sm rounded-tl-none' 
                              : isAI
                                ? 'bg-encre text-neige shadow-sm rounded-tr-none border border-graphite'
                                : 'bg-menthe text-white shadow-sm rounded-tr-none border border-menthe/20'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[8px] text-encre/30 px-1 text-right mt-0.5">{msg.time}</span>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="flex w-full justify-start">
                    <div className="flex items-start gap-2.5 max-w-[70%]">
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-encre border border-graphite text-menthe shadow-sm">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] text-encre/40 px-1">L&apos;IA est en train d&apos;écrire...</span>
                        <div className="px-4 py-3 bg-encre border border-graphite text-neige rounded-[1.2rem] rounded-tl-none flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-graphite/10 flex gap-3 bg-white">
                <input 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  type="text" 
                  placeholder="Écrire une réponse..." 
                  className="flex-1 bg-neige border border-graphite/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-menthe transition-all font-semibold" 
                />
                <button 
                  type="submit" 
                  className="magnetic-btn bg-encre text-neige px-4 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-menthe hover:text-white transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-encre/30 text-xs gap-3">
              <MessageSquare className="w-10 h-10 text-menthe/60" />
              <span className="font-semibold text-center max-w-xs leading-relaxed">
                Choisissez une discussion dans la liste de gauche pour interagir et simuler des réponses.
              </span>
            </div>
          )}
        </div>

        {/* Client details Right Sidebar */}
        {showCustomerSidebar && activeChat && (
          <div 
            ref={sidebarRef} 
            className="absolute lg:relative right-0 lg:right-auto top-0 lg:top-auto bottom-0 lg:bottom-auto h-full lg:h-auto w-full lg:w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 p-6 shadow-xl lg:shadow-sm overflow-hidden z-20"
          >
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3 mb-5">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-menthe" />
                <span className="text-xs font-black uppercase text-encre tracking-wider">Fiche Client</span>
              </div>
              <button 
                onClick={() => setShowCustomerSidebar(false)}
                className="p-1 hover:bg-neige rounded-lg border border-graphite/5 text-encre/60 hover:text-encre transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {customerInfo ? (
              <div className="flex-1 overflow-y-auto flex flex-col gap-6">
                
                {/* Profile Center Avatar */}
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menthe/10 to-menthe/20 border-2 border-menthe flex items-center justify-center text-menthe text-xl font-black shadow-md">
                    {activeChat.avatar}
                  </div>
                  <span className="font-black text-sm text-encre text-center">{customerInfo.name}</span>
                  <div className="flex flex-wrap gap-1 justify-center mt-1">
                    {customerInfo.tags.map((t, idx) => (
                      <span key={idx} className="text-[9px] bg-menthe/10 text-menthe border border-menthe/20 px-2.5 py-0.5 rounded-full font-bold">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Details Section */}
                <div className="flex flex-col gap-4 text-xs">
                  
                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <Phone className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Téléphone WhatsApp</span>
                      <span className="font-extrabold text-encre">{customerInfo.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <Mail className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">E-mail</span>
                      <span className="font-extrabold text-encre truncate max-w-[180px]">{customerInfo.email || "Non renseigné"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <MapPin className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Adresse de Livraison</span>
                      <span className="font-extrabold text-encre leading-normal">{customerInfo.address || "Non renseignée"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                      <Calendar className="w-3.5 h-3.5 text-menthe shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-encre/40 font-bold uppercase">1er Contact</span>
                        <span className="font-extrabold text-[11px] text-encre">{customerInfo.firstContact}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-gradient-to-br from-menthe/5 to-transparent rounded-xl border border-menthe/10">
                      <DollarSign className="w-3.5 h-3.5 text-menthe shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-menthe font-bold uppercase font-black">Total Dépensé</span>
                        <span className="font-extrabold text-[11px] text-menthe">{customerInfo.totalSpent === 0 ? "0 FCFA" : `${customerInfo.totalSpent.toLocaleString()} FCFA`}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-encre/30 text-xs p-4 gap-2">
                <User className="w-8 h-8 text-menthe/50" />
                <span>Aucune fiche client détaillée n&apos;a été trouvée pour ce numéro ou ce nom.</span>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
