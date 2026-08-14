import React from "react";
import { MessageSquare, Send } from "lucide-react";
import { Conversation } from "../../types";

interface ConversationsViewProps {
  conversations: Conversation[];
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
  activeChatId,
  setActiveChatId,
  chatInput,
  setChatInput,
  handleSendMessage,
  toggleTakeover
}) => {
  const activeChat = conversations.find(c => c.id === activeChatId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] min-h-0">
      
      {/* Left sidebar: ConversationList */}
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

      {/* Right side: ChatWindow */}
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
                {activeChat.status === "human_takeover" ? "Laisser l’IA répondre" : "Prendre la main"}
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
  );
};
