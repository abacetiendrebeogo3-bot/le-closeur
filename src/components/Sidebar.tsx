import React from "react";
import { 
  LayoutDashboard, 
  MessageSquare, 
  ShoppingBag, 
  Package,
  Users, 
  Truck, 
  Clock, 
  Settings, 
  X,
  Bot
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  conversationsCount: number;
  businessName?: string;
  ownerName?: string;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  conversationsCount,
  businessName,
  ownerName,
  onSignOut
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 w-80 bg-encre text-neige flex flex-col justify-between border-r border-graphite p-8 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-40 md:sticky md:h-screen shrink-0`}>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-neige">{businessName || "MON CLOSEUR"}</span>
              <span className="w-2 h-2 bg-menthe rounded-full animate-pulse"></span>
            </div>
            <span className="text-[10px] text-neige/50 mt-1 uppercase tracking-wider">Espace Client</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-neige/60 hover:text-menthe">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          <button onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "dashboard" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span className="text-xs">Vue d&apos;ensemble</span>
          </button>
          <button onClick={() => { setActiveTab("conversations"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "conversations" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <MessageSquare className="w-4.5 h-4.5" />
            <span className="text-xs flex-1">Conversations</span>
            <span className="text-[10px] bg-menthe text-white px-2 py-0.5 rounded-full font-bold">{conversationsCount}</span>
          </button>
          <button onClick={() => { setActiveTab("orders"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "orders" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <ShoppingBag className="w-4.5 h-4.5" />
            <span className="text-xs">Commandes</span>
          </button>
          <button onClick={() => { setActiveTab("catalog"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "catalog" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Package className="w-4.5 h-4.5" />
            <span className="text-xs">Catalogue</span>
          </button>
          <button onClick={() => { setActiveTab("customers"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "customers" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Users className="w-4.5 h-4.5" />
            <span className="text-xs font-medium">Clients</span>
          </button>
          <button onClick={() => { setActiveTab("couriers"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "couriers" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Truck className="w-4.5 h-4.5" />
            <span className="text-xs">Livreurs</span>
          </button>
          <button onClick={() => { setActiveTab("followups"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "followups" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Clock className="w-4.5 h-4.5" />
            <span className="text-xs">Relances</span>
          </button>
          <button onClick={() => { setActiveTab("agent-config"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "agent-config" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Bot className="w-4.5 h-4.5" />
            <span className="text-xs">Agent IA</span>
          </button>
          <button onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3.5 transition-all ${activeTab === "settings" ? 'bg-menthe text-neige' : 'text-neige/60 hover:text-neige hover:bg-white/5'}`}>
            <Settings className="w-4.5 h-4.5" />
            <span className="text-xs">Paramètres</span>
          </button>
        </nav>
      </div>

      <div className="flex flex-col gap-4 pt-6 border-t border-graphite">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-graphite flex items-center justify-center text-neige font-bold border border-menthe/30 text-xs">
            {ownerName ? ownerName.split(" ").map(n => n[0]).join("").toUpperCase() : "WT"}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neige">{ownerName || "Tiedrebeogo Wilfried"}</span>
            <span className="text-[9px] text-neige/40 font-semibold uppercase">Propriétaire</span>
          </div>
        </div>
        <button onClick={onSignOut} className="w-full text-left px-4 py-2.5 rounded-xl font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs transition-all flex items-center gap-2">
          Se déconnecter
        </button>
        <div className="text-[9px] text-neige/45 font-semibold flex items-center justify-between px-4">
          <span>v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};
