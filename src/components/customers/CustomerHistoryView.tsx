import React, { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Customer, Order } from "../../types";
import { gsap } from "gsap";

interface CustomerHistoryViewProps {
  selectedCustomerId: string;
  customers: Customer[];
  orders: Order[];
  setCustomerSubView: (v: "list" | "history") => void;
  setSelectedOrderId: (id: string | null) => void;
  setOrdersSubView: (v: "list" | "create" | "detail" | "edit") => void;
  setActiveTab: (tab: string) => void;
  formatFCFA: (val: number) => string;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
}

export const CustomerHistoryView: React.FC<CustomerHistoryViewProps> = ({
  selectedCustomerId,
  customers,
  orders,
  setCustomerSubView,
  setSelectedOrderId,
  setOrdersSubView,
  setActiveTab,
  formatFCFA,
  orderBadges,
  paymentBadges
}) => {
  const customerObj = customers.find(c => c.id === selectedCustomerId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }
      );
    }
  }, [selectedCustomerId]);

  if (!customerObj) return <div className="text-center py-8">Client introuvable</div>;

  const clientOrders = orders.filter(o => o.customer === customerObj.name);

  return (
    <div ref={containerRef} className="bg-white p-6 md:p-8 rounded-[2rem] border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full shadow-sm">
      <div className="flex items-center justify-between border-b border-graphite/5 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCustomerSubView("list")} className="text-encre/50 hover:text-menthe p-1 bg-neige rounded-lg border border-graphite/10">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-encre">Historique des achats de {customerObj.name}</h3>
            <span className="text-[10px] text-encre/40 font-semibold">WhatsApp: {customerObj.phone} | Adresse: {customerObj.address || "Non renseignée"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[10px] uppercase font-bold text-encre/40">Commandes du client ({clientOrders.length})</span>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-2.5 px-3">ID Commande</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Statut Commande</th>
                <th className="py-2.5 px-3">Statut Paiement</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {clientOrders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setOrdersSubView("detail");
                    setActiveTab("orders");
                  }}
                  className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 font-semibold text-encre">{order.id}</td>
                  <td className="py-3 px-3">{new Date(order.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-3">{orderBadges[order.status]}</td>
                  <td className="py-3 px-3">{paymentBadges[order.paymentStatus]}</td>
                  <td className="py-3 px-3 text-right font-bold tabular-nums">{formatFCFA(order.total)}</td>
                </tr>
              ))}
              {clientOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-encre/30 font-semibold">Aucune commande enregistrée pour ce client.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
