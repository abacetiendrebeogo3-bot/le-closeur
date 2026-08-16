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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <Settings className="w-4 h-4 text-menthe" />
              <span>Intégration API WhatsApp</span>
            </h3>
            <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Phase 5
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              disabled
              className="w-full bg-neige border border-graphite/15 text-encre/40 font-bold py-3 px-4 rounded-xl text-xs text-center opacity-70 cursor-not-allowed"
            >
              Connecter mon compte WhatsApp Business
            </button>
            <span className="text-[10px] text-amber-600 font-semibold text-center block mt-1">
              ⚠️ Non connecté — à configurer en Phase 5
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Statut de la connexion Meta</label>
            <div className="flex items-center gap-2 bg-neige text-encre/50 border border-graphite/10 px-3 py-2 rounded-xl text-xs font-bold">
              <span className="w-2.5 h-2.5 bg-graphite rounded-full"></span>
              <span>Non connecté</span>
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <Database className="w-4 h-4 text-menthe" />
              <span>Synchronisation Supabase</span>
            </h3>
            <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Phase 3
            </span>
          </div>
          
          <p className="text-xs text-encre/60 leading-relaxed font-semibold">
            Les données locales de sessions (prospects, commandes, livreurs, catalogue) seront synchronisées en temps réel avec votre base de données Supabase.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Base de données active</label>
            <div className="flex items-center gap-2 bg-neige text-encre/40 border border-graphite/10 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold">
              <span>(Aucune base de données connectée)</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => triggerToast("Option disponible après connexion Supabase (Phase 3)", "warning")}
          className="magnetic-btn bg-neige hover:bg-graphite/10 text-encre/50 border border-graphite/15 font-bold py-3 rounded-xl text-center text-xs transition-all shadow-xs"
        >
          Forcer la synchronisation (Indisponible)
        </button>
      </div>

    </div>
  );
};
