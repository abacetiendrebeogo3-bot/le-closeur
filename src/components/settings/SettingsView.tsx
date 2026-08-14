import React from "react";
import { Settings, AlertTriangle } from "lucide-react";

interface SettingsViewProps {
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ triggerToast }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col gap-5">
        <h3 className="text-sm font-bold text-encre">Instructions de l’Agent IA</h3>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-encre/50">Tonalité conversationnelle</label>
          <select className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold">
            <option>Chaleureux et Respectueux</option>
            <option>Direct et Professionnel</option>
            <option>Amical et Détendu</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-encre/50">Consignes système (Prompt de base)</label>
          <textarea rows={5} className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed" defaultValue="Tu es l'agent IA de vente de la boutique de Wilfried Tiedrebeogo. Tu vends des pièces de rechange et du matériel informatique de haute qualité. Parle de manière chaleureuse, accueille les clients avec politesse et réponds toujours en proposant les prix exacts en FCFA. Utilise les outils de calcul pour valider les coûts de livraison." />
        </div>

        <button onClick={() => triggerToast("Instructions enregistrées dans Supabase pour Tiedrebeogo Wilfried.", "success")} className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all">
          Enregistrer la configuration IA
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col justify-between gap-5">
        <div className="flex flex-col gap-5">
          <h3 className="text-sm font-bold text-encre">Zones de livraison & Tarifs</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-1">
              <span className="text-[9px] text-encre/40 font-bold uppercase">Zone A (Proche)</span>
              <span className="text-xs font-bold">1 500 FCFA</span>
              <span className="text-[9px] text-encre/50">Délai : 2h à 4h</span>
            </div>
            
            <div className="p-3 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-1">
              <span className="text-[9px] text-encre/40 font-bold uppercase">Zone B (Éloignée)</span>
              <span className="text-xs font-bold">2 500 FCFA</span>
              <span className="text-[9px] text-encre/50">Délai : 3h à 5h</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Numéro WhatsApp Meta Business ID</label>
            <input type="text" value="105943895748395" className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-mono" disabled />
          </div>
        </div>

        <div className="p-3 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200/50 text-[10px] flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-600" />
          <div>
            <span className="font-bold">Sécurité d’accès</span><br />
            L’API Meta requiert un jeton d’accès permanent stocké de manière isolée pour Tiedrebeogo Wilfried.
          </div>
        </div>
      </div>
    </div>
  );
};
