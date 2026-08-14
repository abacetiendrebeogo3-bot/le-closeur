import React from "react";

interface FollowupsViewProps {
  followupsActive: boolean;
  setFollowupsActive: (active: boolean) => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const FollowupsView: React.FC<FollowupsViewProps> = ({
  followupsActive,
  setFollowupsActive,
  triggerToast
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-graphite/10 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-encre">Relances WhatsApp Automatiques</h3>
          <p className="text-[10px] text-encre/50 mt-0.5">Conformes aux fenêtres de 24h de l’API Meta WhatsApp Business Cloud.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-encre/60">Statut Global</span>
          <button onClick={() => { setFollowupsActive(!followupsActive); triggerToast(followupsActive ? "Relances automatiques suspendues." : "Campagnes de relances réactivées.", followupsActive ? "warning" : "success"); }} className={`w-11 h-6 rounded-full relative transition-colors ${followupsActive ? 'bg-green-500' : 'bg-graphite'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${followupsActive ? 'left-6' : 'left-1'}`}></span>
          </button>
        </div>
      </div>

      <div className="mt-4 border-l-2 border-corail/30 pl-6 ml-4 space-y-6">
        <div className="relative">
          <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-corail rounded-full border-4 border-white"></span>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-corail font-bold uppercase">Étape 1 — Après 1 heure d’inactivité</span>
            <span className="text-xs font-bold text-encre">Rappel Panier Abandonné</span>
            <p className="text-xs text-encre/60 mt-1 italic">
              {"« Bonjour {{name}}, nous avons remarqué que vous n’avez pas validé votre panier pour {{total_amount}} FCFA. Souhaitez-vous de l’aide ? »"}
            </p>
            <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : « cart_recovery_fr »</span>
          </div>
        </div>

        <div className="relative">
          <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 bg-corail rounded-full border-4 border-white"></span>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-corail font-bold uppercase">Étape 2 — Après 24 heures</span>
            <span className="text-xs font-bold text-encre">Offre de livraison prioritaire</span>
            <p className="text-xs text-encre/60 mt-1 italic">
              {"« Bonjour {{name}} ! Finalisez votre commande aujourd’hui et profitez d’une expédition rapide pour {{delivery_zone}}. »"}
            </p>
            <span className="text-[9px] text-encre/40 mt-1 font-bold">Template Meta : « delivery_incentive_fr »</span>
          </div>
        </div>
      </div>
    </div>
  );
};
