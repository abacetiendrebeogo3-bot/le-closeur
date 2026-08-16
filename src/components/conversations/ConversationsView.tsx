import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Phone, Mail, MapPin, Calendar, Tag, DollarSign, User } from "lucide-react";
import { Conversation, Customer } from "../../types";
import { gsap } from "gsap";

interface ConversationsViewProps {
  conversations: Conversation[];
  customers?: Customer[];
  activeChatId: number | null;
  setActiveChatId: (id: number | null) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  toggleTakeover: () => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  conversations,
  customers = [],
  activeChatId,
  setActiveChatId,
  chatInput,
  setChatInput,
  handleSendMessage,
  toggleTakeover
}) => {
  const activeChat = conversations.find(c => c.id === activeChatId);
  const [showCustomerSidebar, setShowCustomerSidebar] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Find customer associated with the active chat
  const customerInfo = activeChat
    ? customers.find(
        c =>
          c.phone.replace(/\s+/g, "") === activeChat.customerPhone.replace(/\s+/g, "") ||
          c.name.toLowerCase() === activeChat.customerName.toLowerCase()
      )
    : null;

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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] min-h-0">
      
      {/* Left sidebar: ConversationList */}
      <div className="w-full lg:w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shrink-0 shadow-sm">
        <div className="p-4 border-b border-graphite/10">
          <input 
            type="text" 
            placeholder="Rechercher une discussion..." 
            className="w-full bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe" 
          />
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-graphite/5">
          {conversations.map(conv => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const badgeStyles = {
              ai_active: "bg-green-100 text-green-800 border-green-200",
              human_takeover: "bg-orange-100 text-orange-800 border-orange-200",
              closed: "bg-gray-100 text-gray-800 border-gray-200"
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
                  // Open sidebar automatically if client info is available
                  setShowCustomerSidebar(true);
                }} 
                className={`w-full text-left p-4 flex flex-col gap-1.5 transition-all hover:bg-neige/60 ${
                  activeChatId === conv.id ? 'bg-neige-dark/40 border-l-4 border-menthe' : ''
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
                  {conv.unread && <span className="w-2 h-2 bg-menthe rounded-full animate-ping"></span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side: Flex container holding Chat & Customer sidebar */}
      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Chat Window */}
        <div className="flex-1 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shadow-sm overflow-hidden">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div 
                onClick={() => setShowCustomerSidebar(!showCustomerSidebar)}
                className="px-6 py-4 border-b border-graphite/10 flex items-center justify-between bg-neige/30 cursor-pointer hover:bg-neige/50 transition-colors"
                title="Cliquez pour afficher/masquer les détails du client"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-encre text-neige font-bold flex items-center justify-center border border-menthe/30 text-xs shadow-sm">
                    {activeChat.avatar}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-encre">{activeChat.customerName}</span>
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                        activeChat.status === "ai_active" 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {activeChat.status === "ai_active" ? 'IA active' : 'Reprise manuelle'}
                      </span>
                    </div>
                    <span className="text-[10px] text-encre/40 font-semibold">{activeChat.customerPhone}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid triggering sidebar toggle
                    toggleTakeover();
                  }} 
                  className="magnetic-btn px-4 py-1.5 rounded-xl bg-white border border-graphite/20 hover:border-menthe text-[10px] font-bold shadow-sm transition-all"
                >
                  {activeChat.status === "human_takeover" ? "Laisser l’IA répondre" : "Prendre la main"}
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neige/10">
                {activeChat.messages.map((msg, idx) => (
                  <div key={idx} className={`flex w-full ${msg.sender === "customer" ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[70%] flex flex-col gap-0.5">
                      <span className="text-[9px] text-encre/40 px-1">
                        {msg.sender === "customer" 
                          ? 'Client' 
                          : msg.sender === "ai" 
                            ? 'Assistant IA' 
                            : 'Wilfried'}
                      </span>
                      <div className={`px-4 py-2.5 rounded-[1.2rem] text-xs leading-relaxed ${
                        msg.sender === "customer" 
                          ? 'bg-white border border-graphite/10 text-encre shadow-sm' 
                          : 'bg-encre text-neige shadow-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-encre/30 px-1 text-right">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-graphite/10 flex gap-3 bg-white">
                <input 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  type="text" 
                  placeholder="Écrire une réponse..." 
                  className="flex-1 bg-neige border border-graphite/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-menthe transition-all" 
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
            className="w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 p-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3 mb-5">
              <span className="text-xs font-black uppercase text-encre tracking-wider">Fiche Client</span>
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
