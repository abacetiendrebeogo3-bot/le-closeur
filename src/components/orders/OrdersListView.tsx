import React from "react";
import { Search, Plus } from "lucide-react";
import { Order } from "../../types";

interface OrdersListViewProps {
  orders: Order[];
  orderFilter: string;
  setOrderFilter: (f: string) => void;
  paymentFilter: string;
  setPaymentFilter: (f: string) => void;
  orderSearchQuery: string;
  setOrderSearchQuery: (q: string) => void;
  openCreateOrderForm: () => void;
  setSelectedOrderId: (id: string | null) => void;
  setOrdersSubView: (v: "list" | "create" | "detail" | "edit") => void;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
  formatFCFA: (val: number) => string;
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  orderFilter,
  setOrderFilter,
  paymentFilter,
  setPaymentFilter,
  orderSearchQuery,
  setOrderSearchQuery,
  openCreateOrderForm,
  setSelectedOrderId,
  setOrdersSubView,
  orderBadges,
  paymentBadges,
  formatFCFA
}) => {
  return (
    <>
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-graphite/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-encre/30">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Rechercher par nom de client..."
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              className="w-full bg-neige border border-graphite/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-menthe"
            />
          </div>
          
          <button onClick={openCreateOrderForm} className="magnetic-btn bg-menthe text-neige px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start md:self-auto shrink-0">
            <Plus className="w-4 h-4" />
            <span>Créer une commande</span>
          </button>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col gap-3 pt-3 border-t border-graphite/5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut de la commande</span>
            <div className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-1">
              {[
                { id: "all", label: "Toutes" },
                { id: "discussing", label: "En discussion" },
                { id: "confirmed", label: "Confirmée" },
                { id: "sent_to_courier", label: "Chez livreur" },
                { id: "delivered", label: "En livraison" },
                { id: "paid", label: "Livrée & Payée" },
                { id: "cancelled", label: "Annulée" }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setOrderFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-block shrink-0 ${orderFilter === filter.id ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-widest font-bold text-encre/40">Statut du paiement</span>
            <div className="flex gap-2">
              {[
                { id: "all", label: "Tous" },
                { id: "pending", label: "En attente" },
                { id: "paid", label: "Payé" },
                { id: "overdue", label: "En retard" }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setPaymentFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-block shrink-0 ${paymentFilter === filter.id ? 'bg-encre text-neige' : 'bg-neige border border-graphite/10 text-encre hover:bg-graphite/5'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-graphite/10">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-3 px-4">ID Commande</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Statut Commande</th>
                <th className="py-3 px-4">Statut Paiement</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders
                .filter(o => orderFilter === "all" || o.status === orderFilter)
                .filter(o => paymentFilter === "all" || o.paymentStatus === paymentFilter)
                .filter(o => o.customer.toLowerCase().includes(orderSearchQuery.toLowerCase()))
                .map(order => (
                  <tr
                    key={order.id}
                    onClick={() => { setSelectedOrderId(order.id); setOrdersSubView("detail"); }}
                    className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-semibold text-encre">{order.id}</td>
                    <td className="py-3.5 px-4 font-semibold">{order.customer}</td>
                    <td className="py-3.5 px-4">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3.5 px-4">{orderBadges[order.status]}</td>
                    <td className="py-3.5 px-4">{paymentBadges[order.paymentStatus]}</td>
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                  </tr>
                ))}
              {orders.filter(o => orderFilter === "all" || o.status === orderFilter).filter(o => paymentFilter === "all" || o.paymentStatus === paymentFilter).filter(o => o.customer.toLowerCase().includes(orderSearchQuery.toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-encre/30 font-semibold">Aucune commande ne correspond à vos filtres.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
