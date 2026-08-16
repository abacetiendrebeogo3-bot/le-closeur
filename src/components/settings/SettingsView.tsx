import React from "react";
import { Settings, AlertTriangle, Database } from "lucide-react";

interface SettingsViewProps {
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ triggerToast }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full text-encre">
      
      {/* Meta API Integration Card */}
      <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 flex flex-col justify-between gap-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <h3 className="text-sm font-bold text-encre flex items-center gap-2">
            <Settings className="w-4 h-4 text-menthe" />
            <span>Intégration API WhatsApp</span>
          </h3>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Numéro WhatsApp Meta Business ID</label>
            <input 
              type="text" 
              value="105943895748395" 
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-mono text-encre/65" 
              disabled 
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Statut de la connexion Meta</label>
            <div className="flex items-center gap-2 bg-menthe/10 text-menthe border border-menthe/20 px-3 py-2 rounded-xl text-xs font-bold">
              <span className="w-2.5 h-2.5 bg-menthe rounded-full animate-pulse"></span>
              <span>Connecté et opérationnel</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/50 text-amber-800 rounded-xl border border-amber-200/50 text-[10px] flex gap-2.5 items-start font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-bold text-encre">Sécurité d’accès</span><br />
            L’API Meta requiert un jeton d’accès permanent stocké de manière isolée pour Tiedrebeogo Wilfried.
          </div>
        </div>
      </div>

      {/* Database/Sync card */}
      <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 flex flex-col justify-between gap-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <h3 className="text-sm font-bold text-encre flex items-center gap-2">
            <Database className="w-4 h-4 text-menthe" />
            <span>Synchronisation Supabase</span>
          </h3>
          <p className="text-xs text-encre/60 leading-relaxed font-semibold">
            Les données locales de sessions (prospects, commandes, livreurs, catalogue) sont configurées pour une synchronisation bilatérale temps réel avec votre base de données Supabase.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Base de données active</label>
            <div className="flex items-center gap-2 bg-encre/5 text-encre border border-graphite/10 px-3 py-2.5 rounded-xl text-xs font-mono font-bold">
              <span>moncloseur-prod-db</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => triggerToast("Synchronisation forcée effectuée.", "success")}
          className="magnetic-btn bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-center text-xs transition-all shadow-xs"
        >
          Forcer la synchronisation
        </button>
      </div>

    </div>
  );
};
