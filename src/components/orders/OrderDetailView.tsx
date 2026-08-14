import React from "react";
import { ArrowLeft, Edit2, Trash2, ExternalLink } from "lucide-react";
import { Order, Customer, Courier } from "../../types";

interface OrderDetailViewProps {
  selectedOrderId: string;
  orders: Order[];
  customers: Customer[];
  couriers: Courier[];
  setOrdersSubView: (v: "list" | "create" | "detail" | "edit") => void;
  openEditOrderForm: (order: Order) => void;
  setShowDeleteConfirmOrder: (id: string | null) => void;
  setActiveChatId: (id: number | null) => void;
  setActiveTab: (tab: string) => void;
  handleAssignCourier: (orderId: string, courierName: string) => void;
  handleCancelOrder: (orderId: string) => void;
  handleAdvanceOrderStatus: (orderId: string) => void;
  formatFCFA: (val: number) => string;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  selectedOrderId,
  orders,
  customers,
  couriers,
  setOrdersSubView,
  openEditOrderForm,
  setShowDeleteConfirmOrder,
  setActiveChatId,
  setActiveTab,
  handleAssignCourier,
  handleCancelOrder,
  handleAdvanceOrderStatus,
  formatFCFA,
  orderBadges,
  paymentBadges
}) => {
  const orderObj = orders.find(o => o.id === selectedOrderId);
  if (!orderObj) return <div className="text-center py-8">Commande introuvable</div>;
  
  const clientObj = customers.find(c => c.name === orderObj.customer);

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header detail */}
      <div className="flex items-center justify-between border-b border-graphite/5 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setOrdersSubView("list")} className="text-encre/50 hover:text-menthe p-1 bg-neige rounded-lg border border-graphite/10">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-encre flex items-center gap-2.5">
              <span>Fiche Commande {orderObj.id}</span>
              {orderBadges[orderObj.status]}
            </h3>
            <span className="text-[10px] text-encre/40">Enregistré le {new Date(orderObj.date).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => openEditOrderForm(orderObj)} className="text-xs font-semibold text-encre/70 hover:text-menthe p-2 bg-neige border border-graphite/10 rounded-xl flex items-center gap-1.5 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Modifier</span>
          </button>
          <button onClick={() => setShowDeleteConfirmOrder(orderObj.id)} className="text-xs font-semibold text-red-600 hover:bg-red-50 p-2 border border-red-200/50 rounded-xl flex items-center gap-1.5 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client info */}
        <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-2">
          <span className="text-[9px] uppercase font-bold text-encre/40">Coordonnées Client</span>
          <div className="text-xs font-bold text-encre">{orderObj.customer}</div>
          <div className="text-xs text-encre/70">WhatsApp : {orderObj.customerPhone || clientObj?.phone}</div>
          {clientObj?.email && <div className="text-xs text-encre/70">Email : {clientObj.email}</div>}
          {orderObj.chatId && (
            <button
              onClick={() => {
                setActiveChatId(orderObj.chatId!);
                setActiveTab("conversations");
              }}
              className="text-[10px] font-bold text-menthe flex items-center gap-1 hover:underline mt-2 self-start"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Voir la discussion WhatsApp d’origine</span>
            </button>
          )}
        </div>

        {/* Delivery info */}
        <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-2">
          <span className="text-[9px] uppercase font-bold text-encre/40">Logistique de livraison</span>
          <div className="text-xs text-encre/80"><span className="font-bold">Zone :</span> {orderObj.deliveryZone}</div>
          <div className="text-xs text-encre/80"><span className="font-bold">Frais de livraison :</span> {formatFCFA(orderObj.shippingFee)}</div>
          <div className="text-xs text-encre/80"><span className="font-bold">Adresse complète :</span> {orderObj.customerAddress || clientObj?.address || "Non spécifiée"}</div>
          {orderObj.courier ? (
            <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200 mt-2 font-semibold">
              Livreur assigné : {orderObj.courier}
            </div>
          ) : (
            orderObj.status !== "cancelled" && orderObj.status !== "paid" && (
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[9px] uppercase font-bold text-encre/40">Assigner un coursier</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAssignCourier(orderObj.id, e.target.value);
                  }}
                  defaultValue=""
                  className="bg-white border border-graphite/10 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-menthe font-semibold text-encre"
                >
                  <option value="" disabled>-- Choisir un livreur --</option>
                  {couriers.filter(c => c.active).map(c => (
                    <option key={c.name} value={c.name}>{c.name} (charge active: {c.load})</option>
                  ))}
                </select>
              </div>
            )
          )}
        </div>
      </div>

      {/* Order items */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[9px] uppercase font-bold text-encre/40">Articles Commandés</span>
        <div className="border border-graphite/10 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-neige font-bold text-[9px] uppercase tracking-widest text-encre/50 border-b border-graphite/10">
              <tr>
                <th className="py-2.5 px-4">Article</th>
                <th className="py-2.5 px-4 text-center">Quantité</th>
                <th className="py-2.5 px-4 text-right">Prix Unitaire</th>
                <th className="py-2.5 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderObj.items.map((item, idx) => (
                <tr key={idx} className="border-b border-graphite/5">
                  <td className="py-3 px-4 font-semibold">{item.product}</td>
                  <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatFCFA(item.price)}</td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums">{formatFCFA(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-right flex flex-col gap-1.5 pt-3 border-t border-graphite/10">
        <div className="text-xs text-encre/60">
          <span>Sous-total produits : </span>
          <span className="font-semibold text-encre tabular-nums">{formatFCFA(orderObj.total - orderObj.shippingFee)}</span>
        </div>
        <div className="text-xs text-encre/60">
          <span>Frais de livraison : </span>
          <span className="font-semibold text-encre tabular-nums">{formatFCFA(orderObj.shippingFee)}</span>
        </div>
        <div className="text-sm font-extrabold text-encre">
          <span>Total de la facture : </span>
          <span className="text-menthe font-black tabular-nums">{formatFCFA(orderObj.total)}</span>
        </div>
        <div className="text-xs mt-1">
          <span>Statut du paiement : </span>
          {paymentBadges[orderObj.paymentStatus]}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-neige p-4 rounded-xl border border-graphite/10 mt-2">
        <div>
          <span className="text-[9px] uppercase font-bold text-encre/40 block">Cycle de vie de la commande</span>
          <span className="text-xs font-semibold text-encre">Faire avancer l’état logistique de la commande.</span>
        </div>

        <div className="flex gap-2">
          {orderObj.status !== "paid" && orderObj.status !== "cancelled" && (
            <button
              onClick={() => handleCancelOrder(orderObj.id)}
              className="magnetic-btn bg-white hover:bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-bold"
            >
              Annuler la commande
            </button>
          )}
          
          {orderObj.status !== "paid" && orderObj.status !== "cancelled" && (
            <button
              onClick={() => handleAdvanceOrderStatus(orderObj.id)}
              className="magnetic-btn bg-encre text-neige hover:bg-menthe px-5 py-2.5 rounded-xl text-xs font-bold"
            >
              {orderObj.status === "discussing" && "Confirmer la commande"}
              {orderObj.status === "confirmed" && "Expédier (Chez livreur)"}
              {orderObj.status === "sent_to_courier" && "En livraison"}
              {orderObj.status === "delivered" && "Marquer comme payée"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
