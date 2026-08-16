import React, { useEffect } from "react";
import { ArrowLeft, UserPlus, Plus, Trash2 } from "lucide-react";
import { Customer, OrderItem, Order, Product, Zone } from "../../types";
import { gsap } from "gsap";

interface OrderFormProps {
  orderFormId: string | null;
  orderFormCustomerId: string;
  setOrderFormCustomerId: (id: string) => void;
  orderFormNewClientInline: boolean;
  setOrderFormNewClientInline: (inline: boolean) => void;
  orderFormInlineName: string;
  setOrderFormInlineName: (name: string) => void;
  orderFormInlinePhone: string;
  setOrderFormInlinePhone: (phone: string) => void;
  orderFormDate: string;
  setOrderFormDate: (d: string) => void;
  orderFormZone: string;
  setOrderFormZone: (z: string) => void;
  orderFormItems: OrderItem[];
  setOrderFormItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  customers: Customer[];
  zones: Zone[];
  catalog: Product[];
  setOrdersSubView: (v: "list" | "create" | "detail" | "edit") => void;
  handleSaveOrder: (status: "discussing" | "confirmed") => void;
  formatFCFA: (val: number) => string;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  orderFormId,
  orderFormCustomerId,
  setOrderFormCustomerId,
  orderFormNewClientInline,
  setOrderFormNewClientInline,
  orderFormInlineName,
  setOrderFormInlineName,
  orderFormInlinePhone,
  setOrderFormInlinePhone,
  orderFormDate,
  setOrderFormDate,
  orderFormZone,
  setOrderFormZone,
  orderFormItems,
  setOrderFormItems,
  customers,
  zones,
  catalog,
  setOrdersSubView,
  handleSaveOrder,
  formatFCFA
}) => {
  const calculateFormSubtotal = () => {
    return orderFormItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const getFormDeliveryFee = () => {
    const matched = zones.find(z => z.name === orderFormZone);
    return matched ? matched.fee : 0;
  };

  const calculateFormTotal = () => {
    return calculateFormSubtotal() + getFormDeliveryFee();
  };

  const handleAddFormItemRow = () => {
    setOrderFormItems(prev => [...prev, { product: "Disque SSD 1TB Enterprise", quantity: 1, price: 150000 }]);
  };

  const handleRemoveFormItemRow = (index: number) => {
    if (orderFormItems.length <= 1) return;
    
    const rowElements = document.querySelectorAll(".order-row");
    const targetRow = rowElements[index] as HTMLElement;
    
    if (targetRow) {
      gsap.to(targetRow, {
        opacity: 0,
        x: -30,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        duration: 0.35,
        ease: "power2.in",
        onComplete: () => {
          setOrderFormItems(prev => prev.filter((_, idx) => idx !== index));
          // Reset styles on completion to prevent layout state mismatch in React
          gsap.set(targetRow, { clearProps: "all" });
        }
      });
    } else {
      setOrderFormItems(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleUpdateFormItemProduct = (index: number, productName: string) => {
    const matchedProduct = catalog.find(p => p.name === productName);
    const price = matchedProduct ? matchedProduct.price : 0;
    setOrderFormItems(prev => prev.map((item, idx) => idx === index ? { ...item, product: productName, price } : item));
  };

  const handleUpdateFormItemField = (index: number, field: keyof OrderItem, value: any) => {
    setOrderFormItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  // Animate new rows on addition
  useEffect(() => {
    gsap.fromTo(".order-row",
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" }
    );
  }, [orderFormItems.length]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-graphite/10 flex flex-col gap-6 max-w-3xl mx-auto w-full shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={() => setOrdersSubView("list")} className="text-encre/50 hover:text-menthe p-1 bg-neige rounded-lg border border-graphite/10">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-bold text-encre">
          {orderFormId ? `Modifier la commande ${orderFormId}` : "Créer une commande manuelle"}
        </h3>
      </div>

      <div className="flex flex-col gap-5">
        {/* Customer Selection */}
        <div className="p-4 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-encre/50">Sélection du client</span>
            <button
              type="button"
              onClick={() => setOrderFormNewClientInline(!orderFormNewClientInline)}
              className="text-[10px] font-bold text-menthe flex items-center gap-1.5 hover:underline"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{orderFormNewClientInline ? "Sélectionner client existant" : "Créer un nouveau client"}</span>
            </button>
          </div>

          {!orderFormNewClientInline ? (
            <div className="flex flex-col gap-1">
              <select
                value={orderFormCustomerId}
                onChange={(e) => setOrderFormCustomerId(e.target.value)}
                className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 bg-white rounded-lg border border-graphite/5">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-encre/50">Nom complet *</label>
                <input
                  type="text"
                  value={orderFormInlineName}
                  onChange={(e) => setOrderFormInlineName(e.target.value)}
                  placeholder="Ex: Amadou Fall"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-encre/50">Numéro WhatsApp *</label>
                <input
                  type="text"
                  value={orderFormInlinePhone}
                  onChange={(e) => setOrderFormInlinePhone(e.target.value)}
                  placeholder="Ex: +221 77 000 00 00"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Date de la commande</label>
            <input
              type="date"
              value={orderFormDate}
              onChange={(e) => setOrderFormDate(e.target.value)}
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Zone de livraison</label>
            <select
              value={orderFormZone}
              onChange={(e) => setOrderFormZone(e.target.value)}
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
            >
              {zones.map(z => (
                <option key={z.name} value={z.name}>{z.name} (+{formatFCFA(z.fee)})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Order Lines */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] uppercase font-bold text-encre/50">Lignes de la commande</span>
          <div className="flex flex-col gap-2.5">
            {orderFormItems.map((item, idx) => (
              <div key={idx} className="order-row flex flex-col md:flex-row gap-2.5 items-end md:items-center bg-neige/50 p-3 rounded-xl border border-graphite/5 overflow-hidden">
                <div className="flex-1 w-full">
                  <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">Produit / Description</label>
                  <select
                    value={catalog.find(p => p.name === item.product) ? item.product : "custom"}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        handleUpdateFormItemField(idx, "product", "");
                        handleUpdateFormItemField(idx, "price", 0);
                      } else {
                        handleUpdateFormItemProduct(idx, e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold"
                  >
                    {catalog.filter(cat => cat.active || cat.name === item.product).map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    <option value="custom">Saisie libre...</option>
                  </select>
                  {(!catalog.find(p => p.name === item.product)) && (
                    <input
                      type="text"
                      placeholder="Description personnalisée..."
                      value={item.product}
                      onChange={(e) => handleUpdateFormItemField(idx, "product", e.target.value)}
                      className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold mt-1.5"
                    />
                  )}
                </div>

                <div className="w-20">
                  <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">Qté</label>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => handleUpdateFormItemField(idx, "quantity", parseInt(e.target.value) || 1)}
                    className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe text-center font-bold"
                  />
                </div>

                <div className="w-32">
                  <label className="text-[9px] uppercase font-bold text-encre/30 block mb-1 md:hidden">P. Unit (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(e) => handleUpdateFormItemField(idx, "price", parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe text-right font-bold"
                  />
                </div>

                <div className="w-32 text-right text-xs font-bold text-encre/70 tabular-nums">
                  {formatFCFA(item.price * item.quantity)}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveFormItemRow(idx)}
                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddFormItemRow}
            className="magnetic-btn border border-dashed border-menthe/50 text-menthe py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-menthe/5 mt-1"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un produit</span>
          </button>
        </div>

        {/* Totaux summary */}
        <div className="mt-4 pt-4 border-t border-graphite/10 flex flex-col gap-2 align-end text-right">
          <div className="text-xs text-encre/60">
            <span>Sous-total produits : </span>
            <span className="font-bold tabular-nums text-encre">{formatFCFA(calculateFormSubtotal())}</span>
          </div>
          <div className="text-xs text-encre/60">
            <span>Frais de livraison ({orderFormZone}) : </span>
            <span className="font-bold tabular-nums text-encre">{formatFCFA(getFormDeliveryFee())}</span>
          </div>
          <div className="text-sm font-extrabold text-encre mt-1">
            <span>Montant total à payer : </span>
            <span className="text-menthe font-black tabular-nums">{formatFCFA(calculateFormTotal())}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => handleSaveOrder("discussing")}
            className="magnetic-btn bg-neige border border-graphite/20 hover:border-encre text-encre font-bold py-3 px-5 rounded-xl text-xs"
          >
            Enregistrer en discussion
          </button>
          <button
            type="button"
            onClick={() => handleSaveOrder("confirmed")}
            className="magnetic-btn bg-menthe text-neige font-bold py-3 px-6 rounded-xl text-xs shadow-md shadow-menthe/25"
          >
            {orderFormId ? "Mettre à jour la commande" : "Confirmer la commande"}
          </button>
        </div>
      </div>
    </div>
  );
};
