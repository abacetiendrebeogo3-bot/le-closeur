import React, { useEffect, useState } from "react";
import { ShoppingBag, UserCheck, Database, Settings, ArrowUpRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Order } from "../../types";

interface DashboardViewProps {
  orders: Order[];
  formatFCFA: (val: number) => string;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
  onViewOrder: (id: string) => void;
  onNavigateToSettings: () => void;
  onNavigateToOrders: () => void;
  onNavigateToConversations?: () => void;
}

const chartData = [
  { name: "Lun", IA: 130, Humain: 50 },
  { name: "Mar", IA: 180, Humain: 68 },
  { name: "Mer", IA: 140, Humain: 82 },
  { name: "Jeu", IA: 260, Humain: 90 },
  { name: "Ven", IA: 210, Humain: 110 },
  { name: "Sam", IA: 310, Humain: 120 },
  { name: "Dim", IA: 290, Humain: 105 }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  formatFCFA,
  orderBadges,
  paymentBadges,
  onViewOrder,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToConversations
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalBilled = orders.reduce((acc, o) => acc + o.total, 0);
  const totalPaid = orders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);
  const totalPending = orders.filter(o => o.status !== "paid" && o.status !== "cancelled").reduce((acc, o) => acc + o.total, 0);
  const closedCount = orders.filter(o => o.status === "paid" || o.status === "delivered").length;

  return (
    <div className="flex flex-col gap-6 text-neige bg-encre p-4 rounded-custom-lg border border-graphite-light/20">
      
      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="interactive-card bg-graphite/40 backdrop-blur-md p-5 rounded-2xl border border-graphite-light/30 flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-neige/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Total Commandes</span>
            <ShoppingBag className="w-4 h-4 text-corail" />
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-2xl font-extrabold tabular-nums text-neige">{orders.length}</span>
            <span className="text-[10px] text-green-500 font-semibold mt-1">↑ +12% cette semaine</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="interactive-card bg-graphite/40 backdrop-blur-md p-5 rounded-2xl border border-graphite-light/30 flex flex-col justify-between h-36">
          <div className="flex items-center justify-between text-neige/50">
            <span className="text-[9px] uppercase tracking-widest font-bold">Montant Facturé</span>
            <span className="text-xs font-bold text-corail">XOF</span>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-2xl font-extrabold tabular-nums text-neige">{formatFCFA(totalBilled)}</span>
            <span className="text-[10px] text-green-500 font-semibold mt-1">↑ +8.4% ce mois</span>
          </div>
        </div>

        {/* Highlighted Metric 3: Montant Payé */}
        <div className="interactive-card sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-graphite to-encre border border-corail/30 p-5 rounded-2xl flex flex-col justify-between h-36 shadow-lg shadow-corail/5">
          <div className="flex items-center justify-between text-neige/50">
            <span className="text-[9px] uppercase tracking-widest font-bold text-corail font-black">Montant Payé (Clôturé)</span>
            <span className="text-[10px] bg-corail/20 text-corail px-2.5 py-0.5 rounded-full font-bold">Actif</span>
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-3xl font-black tabular-nums text-neige tracking-tight">{formatFCFA(totalPaid)}</span>
            <span className="text-[11px] text-neige/60 font-semibold mt-1 flex items-center justify-between">
              <span>{formatFCFA(totalPending)} restant à recouvrer</span>
              <span className="text-green-400 font-bold flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5" /> +18%</span>
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Highlighted Metric 4: Taux de Conversion */}
        <div className="interactive-card sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-graphite to-encre border border-corail/30 p-5 rounded-2xl flex flex-col justify-between h-36 shadow-lg shadow-corail/5">
          <div className="flex items-center justify-between text-neige/50">
            <span className="text-[9px] uppercase tracking-widest font-bold text-corail font-black">Taux de Conversion (Closing IA)</span>
            <UserCheck className="w-4 h-4 text-corail" />
          </div>
          <div className="flex flex-col mt-2">
            <span className="text-3xl font-black tabular-nums text-neige tracking-tight">78.5 %</span>
            <span className="text-[11px] text-neige/60 font-semibold mt-1">
              Performance de négociation et closing automatisé par WhatsApp
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart & AI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts Area Chart */}
        <div className="bg-graphite/40 p-5 rounded-2xl border border-graphite-light/20 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-neige/40">Performance IA vs Humain</span>
              <span className="block text-sm font-bold text-neige mt-0.5">Évolution hebdomadaire</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-corail rounded-full"></span>
                <span>IA Closeur</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-neige rounded-full"></span>
                <span>Reprise Manuelle</span>
              </div>
            </div>
          </div>

          <div className="w-full h-56 relative text-[10px]">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E8634A" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#E8634A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorHumain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FAFAFA" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#FAFAFA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
                  <XAxis dataKey="name" stroke="#9A9A9A" />
                  <YAxis stroke="#9A9A9A" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1C1C1E", borderColor: "#2D2D2D", borderRadius: "0.8rem", color: "#FAFAFA" }} 
                    itemStyle={{ color: "#E8634A" }}
                  />
                  <Area type="monotone" dataKey="IA" stroke="#E8634A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIA)" />
                  <Area type="monotone" dataKey="Humain" stroke="#FAFAFA" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorHumain)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-graphite/10 rounded animate-pulse" />
            )}
          </div>
        </div>

        {/* AI Summary Card */}
        <div className="bg-graphite/40 p-5 rounded-2xl border border-graphite-light/20 flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <span className="text-[9px] uppercase tracking-widest font-bold text-neige/40">Statut de l’Agent IA</span>
            <h3 className="text-sm font-bold text-neige">Résumé IA</h3>
            
            <p className="text-xs text-neige/70 leading-relaxed bg-encre/40 p-3.5 rounded-xl border border-graphite-light/10">
              Activité stable cette semaine. {closedCount} commandes closées automatiquement, aucune anomalie détectée.
            </p>

            <button 
              onClick={onNavigateToConversations} 
              className="text-xs text-corail font-bold hover:underline flex items-center gap-1 self-start mt-1"
            >
              <span>Voir plus</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 bg-encre/30 rounded-xl border border-graphite-light/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[11px] font-semibold">Tonalité active</span>
                </div>
                <span className="text-[9px] font-bold bg-graphite/80 px-2 py-0.5 rounded border border-graphite-light/20 text-corail">Chaleureux</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-encre/30 rounded-xl border border-graphite-light/10">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-neige/40" />
                  <span className="text-[11px] font-semibold">Workspace</span>
                </div>
                <span className="text-[9px] font-bold text-green-400 uppercase">Wilfried Tiedrebeogo</span>
              </div>
            </div>
          </div>

          <button onClick={onNavigateToSettings} className="magnetic-btn w-full bg-encre text-neige hover:bg-corail hover:text-neige font-bold py-2.5 rounded-xl text-center text-xs transition-all mt-4 flex items-center justify-center gap-2 border border-graphite-light/20">
            <Settings className="w-3.5 h-3.5" />
            <span>Ajuster les consignes</span>
          </button>
        </div>

      </div>

      {/* Latest Orders Section */}
      <div className="bg-graphite/30 p-5 rounded-2xl border border-graphite-light/20 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-neige">Dernières commandes enregistrées</h3>
            <p className="text-[10px] text-neige/40">Traitement en direct des fiches de ventes.</p>
          </div>
          <button onClick={onNavigateToOrders} className="text-xs text-corail font-semibold hover:underline flex items-center gap-1">
            <span>Voir tout</span>
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite-light/20 text-[9px] text-neige/40 uppercase tracking-widest font-bold">
                <th className="py-2.5 px-3">ID Commande</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Statut Commande</th>
                <th className="py-2.5 px-3">Statut Paiement</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-xs text-neige/80">
              {orders.slice(0, 3).map(order => (
                <tr key={order.id} onClick={() => onViewOrder(order.id)} className="border-b border-graphite-light/10 hover:bg-graphite/20 transition-colors cursor-pointer">
                  <td className="py-3 px-3 font-semibold text-neige">{order.id}</td>
                  <td className="py-3 px-3 font-semibold">{order.customer}</td>
                  <td className="py-3 px-3">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-3">{orderBadges[order.status]}</td>
                  <td className="py-3 px-3">{paymentBadges[order.paymentStatus]}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums text-neige">{formatFCFA(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
