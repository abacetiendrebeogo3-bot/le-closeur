"use client";

import React, { useState, useEffect } from "react";
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
  Bot,
  TrendingUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3
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
  // Collapse State with localStorage memory
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem("sidebar_collapsed", String(nextVal));
  };

  const navGroups = [
    {
      title: "PRINCIPAL",
      items: [
        { id: "dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
        { id: "conversations", label: "Conversations", icon: MessageSquare, badge: conversationsCount },
        { id: "orders", label: "Commandes", icon: ShoppingBag }
      ]
    },
    {
      title: "COMMERCE",
      items: [
        { id: "catalog", label: "Catalogue", icon: Package },
        { id: "customers", label: "Clients", icon: Users },
        { id: "couriers", label: "Livreurs", icon: Truck },
        { id: "followups", label: "Relances", icon: Clock }
      ]
    },
    {
      title: "PILOTAGE",
      items: [
        { id: "pilotage", label: "Pilotage", icon: TrendingUp },
        { id: "stats", label: "Statistiques", icon: BarChart3 },
        { id: "journal", label: "Journal", icon: BookOpen }
      ]
    },
    {
      title: "CONFIGURATION",
      items: [
        { id: "agent-config", label: "Agent IA", icon: Bot },
        { id: "settings", label: "Paramètres", icon: Settings }
      ]
    }
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 bg-encre text-neige flex flex-col justify-between border-r border-graphite transition-all duration-300 ease-in-out z-40 md:sticky md:h-screen shrink-0 ${
      mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    } md:translate-x-0 ${
      isCollapsed ? 'w-20 p-4' : 'w-80 p-6'
    }`}>
      <div className="flex flex-col gap-6">
        
        {/* Header Block */}
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-neige truncate uppercase">{businessName || "MON CLOSEUR"}</span>
                <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-pulse shrink-0"></span>
              </div>
              <span className="text-[9px] text-neige/45 mt-0.5 uppercase tracking-wider font-semibold">Espace Client</span>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <span className="w-2.5 h-2.5 bg-menthe rounded-full animate-pulse"></span>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {/* Collapse toggle button for Desktop */}
            <button 
              onClick={toggleCollapse} 
              className="hidden md:flex p-1.5 hover:bg-white/5 rounded-lg text-neige/50 hover:text-neige transition-colors"
              title={isCollapsed ? "Déplier le menu" : "Replier le menu"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            
            {/* Mobile close menu button */}
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1.5 text-neige/60 hover:text-menthe">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="flex flex-col gap-1">
              {!isCollapsed ? (
                <span className="text-[8px] font-extrabold text-neige/30 uppercase tracking-widest px-3 mb-1 block">
                  {group.title}
                </span>
              ) : (
                <div className="border-t border-graphite/40 my-1 mx-2" />
              )}

              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full text-left rounded-xl font-medium flex items-center transition-all ${
                        isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2 gap-3'
                      } ${
                        isActive 
                          ? 'bg-menthe text-neige font-bold shadow-xs' 
                          : 'text-neige/60 hover:text-neige hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 shrink-0" />
                      
                      {!isCollapsed && (
                        <>
                          <span className="text-[11px] truncate flex-1">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="text-[9px] bg-menthe text-white px-2 py-0.5 rounded-full font-black border border-white/10 shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / Account Block */}
      <div className={`flex flex-col gap-3 pt-4 border-t border-graphite ${isCollapsed ? 'items-center' : ''}`}>
        
        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-graphite flex items-center justify-center text-neige font-bold border border-menthe/30 text-xs shrink-0">
            {ownerName ? ownerName.split(" ").map(n => n[0]).join("").toUpperCase() : "WT"}
          </div>
          
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-neige truncate">{ownerName || "Tiedrebeogo Wilfried"}</span>
              <span className="text-[8px] text-neige/40 font-bold uppercase tracking-wider mt-0.5">Propriétaire</span>
            </div>
          )}
        </div>

        {/* Signout Button */}
        <button 
          onClick={onSignOut} 
          title={isCollapsed ? "Se déconnecter" : undefined}
          className={`text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all flex items-center ${
            isCollapsed ? 'justify-center p-2.5 w-9 h-9' : 'w-full px-3.5 py-2 text-[10px] font-bold gap-2'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Se déconnecter</span>}
        </button>

        {!isCollapsed && (
          <div className="text-[8px] text-neige/30 font-bold flex items-center justify-between px-3 mt-1 uppercase tracking-wider">
            <span>v0.1.0</span>
          </div>
        )}
      </div>
    </aside>
  );
};
