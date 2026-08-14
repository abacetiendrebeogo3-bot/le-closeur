import React from "react";
import { ShoppingBag, UserCheck, Database, Settings } from "lucide-react";
import { Order } from "../../types";

interface DashboardViewProps {
  orders: Order[];
  formatFCFA: (val: number) => string;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
  onViewOrder: (id: string) => void;
  onNavigateToSettings: () => void;
  onNavigateToOrders: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  formatFCFA,
  orderBadges,
  paymentBadges,
  onViewOrder,
  onNavigateToSettings,
  onNavigateToOrders
}) => {
  const totalBilled = orders.reduce((acc, o) => acc + o.total, 0);
  const totalPaid = orders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);
  const totalPending = orders.filter(o => o.status !== "paid" && o.status !== "cancelled").reduce((acc, o) => acc + o.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between text-encre/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Total Commandes</span>
            <ShoppingBag className="w-4 h-4 text-corail" />
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold tabular-nums">{orders.length}</span>
            <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +12% cette semaine</span>
          </div>
        </div>

        <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between text-encre/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Montant Facturé</span>
            <span className="text-xs font-bold text-corail">XOF</span>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold tabular-nums">
              {formatFCFA(totalBilled)}
            </span>
            <span className="text-[10px] text-green-600 font-semibold mt-1">↑ +8.4% ce mois</span>
          </div>
        </div>

        <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between text-encre/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Montant Payé</span>
            <span className="text-[10px] font-bold text-green-600">Reçu</span>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold tabular-nums">
              {formatFCFA(totalPaid)}
            </span>
            <span className="text-[10px] text-orange-600 font-semibold mt-1 truncate block">
              {formatFCFA(totalPending)} en attente
            </span>
          </div>
        </div>

        <div className="interactive-card bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between h-32">
          <div className="flex items-center justify-between text-encre/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Taux de Conversion</span>
            <UserCheck className="w-4 h-4 text-encre/30" />
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-xl font-bold tabular-nums">78.5 %</span>
            <span className="text-[10px] text-green-600 font-semibold mt-1">Closing Agent IA</span>
          </div>
        </div>

      </div>

      {/* Graphic Performance and quick parameters info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white p-5 rounded-2xl border border-graphite/10 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Performance IA vs Humain</span>
              <span className="block text-sm font-bold text-encre mt-0.5">Évolution hebdomadaire</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-corail rounded-full"></span>
                <span>IA Closeur</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-encre rounded-full"></span>
                <span>Reprise Wilfried</span>
              </div>
            </div>
          </div>

          {/* SVG graph mockup */}
          <div className="w-full h-44 relative">
            <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
              <line x1="40" y1="170" x2="480" y2="170" stroke="#2D2D2D" strokeWidth="1" />
              <line x1="40" y1="10" x2="40" y2="170" stroke="#2D2D2D" strokeWidth="1" />
              <line x1="40" y1="130" x2="480" y2="130" stroke="#F0F0F2" strokeWidth="1" />
              <line x1="40" y1="90" x2="480" y2="90" stroke="#F0F0F2" strokeWidth="1" />
              <line x1="40" y1="50" x2="480" y2="50" stroke="#F0F0F2" strokeWidth="1" />
              <line x1="40" y1="10" x2="480" y2="10" stroke="#F0F0F2" strokeWidth="1" />
              <path d="M 50 130 L 120 70 L 190 98 L 260 30 L 330 50 L 400 2 L 470 58 L 470 170 L 50 170 Z" fill="url(#grad-corail)" opacity="0.15" />
              <path d="M 50 130 L 120 70 L 190 98 L 260 30 L 330 50 L 400 2 L 470 58" fill="none" stroke="#E8634A" strokeWidth="2.5" />
              <circle cx="50" cy="130" r="3" fill="#E8634A" />
              <circle cx="120" cy="70" r="3" fill="#E8634A" />
              <circle cx="190" cy="98" r="3" fill="#E8634A" />
              <circle cx="260" cy="30" r="3" fill="#E8634A" />
              <circle cx="330" cy="50" r="3" fill="#E8634A" />
              <circle cx="400" cy="2" r="3" fill="#E8634A" />
              <circle cx="470" cy="58" r="3" fill="#E8634A" />
              <path d="M 50 150 L 120 138 L 190 122 L 260 130 L 330 110 L 400 98 L 470 126 L 470 170 L 50 170 Z" fill="url(#grad-encre)" opacity="0.05" />
              <path d="M 50 150 L 120 138 L 190 122 L 260 130 L 330 110 L 400 98 L 470 126" fill="none" stroke="#1C1C1E" strokeWidth="1.5" strokeDasharray="3" />
              <defs>
                <linearGradient id="grad-corail" x1="0%" y1="0%" x2="0%" y2="100%">
                   <stop offset="0%" stopColor="#E8634A" />
                   <stop offset="100%" stopColor="#FAFAFA" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="grad-encre" x1="0%" y1="0%" x2="0%" y2="100%">
                   <stop offset="0%" stopColor="#1C1C1E" />
                   <stop offset="100%" stopColor="#FAFAFA" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex justify-between mt-2 text-[9px] text-encre/40 px-10">
              <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-graphite/10 flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut de l’Agent IA</span>
            <h3 className="text-sm font-bold text-encre mt-0.5">Assistant WhatsApp Live</h3>
            <p className="text-xs text-encre/60 mt-2 leading-relaxed">
              L’IA de Mon Closeur analyse et répond en direct à vos prospects pour accélérer la prise de commande.
            </p>
            
            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between p-3 bg-neige rounded-xl border border-graphite/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-semibold">Tonalité active</span>
                </div>
                <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-graphite/10 text-corail">Chaleureux</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-neige rounded-xl border border-graphite/10">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-encre/40" />
                  <span className="text-xs font-semibold">Workspace</span>
                </div>
                <span className="text-[9px] font-bold text-green-600 uppercase">Wilfried Tiedrebeogo</span>
              </div>
            </div>
          </div>

          <button onClick={onNavigateToSettings} className="magnetic-btn w-full bg-encre text-neige hover:bg-corail hover:text-neige font-bold py-2.5 rounded-xl text-center text-xs transition-all mt-4 flex items-center justify-center gap-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Ajuster les consignes</span>
          </button>
        </div>

      </div>

      {/* Latest Orders */}
      <div className="bg-white p-5 rounded-2xl border border-graphite/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-encre">Dernières commandes enregistrées</h3>
            <p className="text-[10px] text-encre/50">Traitement en direct des fiches de ventes.</p>
          </div>
          <button onClick={onNavigateToOrders} className="text-xs text-corail font-semibold hover:underline flex items-center gap-1">
            <span>Voir tout</span>
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-2.5 px-3">ID Commande</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Statut Commande</th>
                <th className="py-2.5 px-3">Statut Paiement</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders.slice(0, 3).map(order => (
                <tr key={order.id} onClick={() => onViewOrder(order.id)} className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer">
                  <td className="py-3 px-3 font-semibold text-encre">{order.id}</td>
                  <td className="py-3 px-3 font-semibold">{order.customer}</td>
                  <td className="py-3 px-3">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-3">{orderBadges[order.status]}</td>
                  <td className="py-3 px-3">{paymentBadges[order.paymentStatus]}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
