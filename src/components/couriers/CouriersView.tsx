import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, X, Truck, UserCheck, ShieldAlert, Award, Calendar, ChevronRight } from "lucide-react";
import { Courier, Order } from "../../types";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface CouriersViewProps {
  couriers: Courier[];
  setCouriers: React.Dispatch<React.SetStateAction<Courier[]>>;
  orders: Order[];
  formatFCFA: (val: number) => string;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const CouriersView: React.FC<CouriersViewProps> = ({
  couriers,
  setCouriers,
  orders,
  formatFCFA,
  triggerToast
}) => {
  // Modal states
  const [showCourierModal, setShowCourierModal] = useState<{ mode: "create" | "edit"; courierId?: string } | null>(null);
  const [courierFormName, setCourierFormName] = useState("");
  const [courierFormPhone, setCourierFormPhone] = useState("");
  const [courierFormActive, setCourierFormActive] = useState(true);

  // Detail Modal / View
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  // Delete Confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Refs for animations
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const detailOverlayRef = useRef<HTMLDivElement>(null);
  const detailModalRef = useRef<HTMLDivElement>(null);

  // Load animation
  useEffect(() => {
    gsap.fromTo(".courier-card",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" }
    );
  }, [couriers]);

  // Modal open animation
  useEffect(() => {
    if (showCourierModal && overlayRef.current && modalRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(modalRef.current, { scale: 0.95, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.5)" });
    }
  }, [showCourierModal]);

  // Detail open animation
  useEffect(() => {
    if (selectedCourierId && detailOverlayRef.current && detailModalRef.current) {
      gsap.fromTo(detailOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(detailModalRef.current, { scale: 0.95, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.5)" });
    }
  }, [selectedCourierId]);

  // Open Form
  const openForm = (c?: Courier) => {
    if (c) {
      setShowCourierModal({ mode: "edit", courierId: c.id });
      setCourierFormName(c.name);
      setCourierFormPhone(c.phone);
      setCourierFormActive(c.active);
    } else {
      setShowCourierModal({ mode: "create" });
      setCourierFormName("");
      setCourierFormPhone("");
      setCourierFormActive(true);
    }
  };

  // Save Courier
  const handleSaveCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courierFormName.trim() || !courierFormPhone.trim()) return;

    if (showCourierModal?.mode === "edit" && showCourierModal.courierId) {
      const { error } = await supabase.from("couriers").update({
        name: courierFormName.trim(),
        phone: courierFormPhone.trim(),
        active: courierFormActive
      }).eq("id", showCourierModal.courierId);

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      setCouriers(prev => prev.map(c => c.id === showCourierModal.courierId ? {
        ...c,
        name: courierFormName.trim(),
        phone: courierFormPhone.trim(),
        active: courierFormActive
      } : c));
      triggerToast(`Livreur mis à jour avec succès.`, "success");
    } else {
      const newId = `COURIER-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from("couriers").insert({
        id: newId,
        name: courierFormName.trim(),
        phone: courierFormPhone.trim(),
        active: courierFormActive,
        load: 0
      });

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      const newCourier: Courier = {
        id: newId,
        name: courierFormName.trim(),
        phone: courierFormPhone.trim(),
        active: courierFormActive,
        load: 0
      };
      setCouriers(prev => [...prev, newCourier]);
      triggerToast(`Livreur "${courierFormName}" ajouté.`, "success");
    }
    setShowCourierModal(null);
  };

  // Delete Courier
  const handleDeleteCourier = async (id: string) => {
    const c = couriers.find(cou => cou.id === id);
    const { error } = await supabase.from("couriers").delete().eq("id", id);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }
    setCouriers(prev => prev.filter(cou => cou.id !== id));
    triggerToast(`Livreur "${c?.name}" supprimé.`, "info");
    setShowDeleteConfirm(null);
  };

  // Statistics calculations
  const activeCouriers = couriers.filter(c => c.active).length;
  const totalLoad = couriers.reduce((sum, c) => sum + c.load, 0);

  // Selected courier details
  const selectedCourier = couriers.find(c => c.id === selectedCourierId);
  // Re-use orders matching this courier name
  const courierOrders = selectedCourier 
    ? orders.filter(o => o.courier === selectedCourier.name)
    : [];
  const successDeliveries = courierOrders.filter(o => o.status === "paid" || o.status === "delivered").length;

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* OVERVIEW METRICS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Title / Add block */}
        <div className="bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40 tracking-wider">Flotte logistique</span>
            <h3 className="text-sm font-black text-encre">Gestion des Livreurs</h3>
          </div>
          <button
            onClick={() => openForm()}
            className="bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm self-start w-full md:w-auto hover:bg-menthe-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un livreur</span>
          </button>
        </div>

        {/* Stat: Active count */}
        <div className="bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40">Livreurs Actifs</span>
            <span className="text-2xl font-black text-encre tabular-nums">{activeCouriers} / {couriers.length}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe/10 flex items-center justify-center text-menthe">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Stat: Active Load */}
        <div className="bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40">Commandes En Cours</span>
            <span className="text-2xl font-black text-encre tabular-nums">{totalLoad}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-encre/5 flex items-center justify-center text-encre">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* COURIERS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {couriers.map((courier) => (
          <div 
            key={courier.id} 
            onClick={() => setSelectedCourierId(courier.id)}
            className="courier-card bg-white p-5 rounded-[2rem] border border-graphite/10 flex flex-col justify-between min-h-[160px] shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neige border border-graphite/10 rounded-full flex items-center justify-center font-black text-xs text-encre/70 shadow-xs shrink-0">
                  {courier.name.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-xs text-encre truncate">{courier.name}</span>
                  <span className="text-[9px] text-encre/40 font-mono mt-0.5">{courier.phone}</span>
                </div>
              </div>
              
              {/* Status Badge */}
              <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                courier.active 
                  ? 'bg-menthe/10 text-menthe border-menthe/20' 
                  : 'bg-red-50 text-red-500 border-red-100'
              }`}>
                {courier.active ? "Actif" : "Hors ligne"}
              </span>
            </div>

            {/* Load indicator */}
            <div className="flex items-center justify-between border-t border-graphite/5 pt-3 mt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase font-bold text-encre/45">Charge active</span>
                <span className="text-sm font-black text-encre tabular-nums">{courier.load} commandes</span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openForm(courier)}
                  className="text-encre/60 hover:text-menthe p-1.5 bg-neige border border-graphite/10 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(courier.id)}
                  className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 border border-red-100 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ADD/EDIT COURIER FORM MODAL */}
      {showCourierModal && (
        <div ref={overlayRef} className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={modalRef} className="bg-white w-full max-w-md rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-encre">
                {showCourierModal.mode === "create" ? "Ajouter un livreur" : "Modifier le livreur"}
              </h3>
              <button onClick={() => setShowCourierModal(null)} className="text-encre/50 hover:text-menthe p-1 hover:bg-neige rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourier} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={courierFormName}
                  onChange={(e) => setCourierFormName(e.target.value)}
                  placeholder="Ex: Moussa Diop"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Téléphone WhatsApp (Notifications) *</label>
                <input
                  type="text"
                  required
                  value={courierFormPhone}
                  onChange={(e) => setCourierFormPhone(e.target.value)}
                  placeholder="Ex: +221 77 123 45 67"
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold font-mono text-encre"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <input
                  id="courierActive"
                  type="checkbox"
                  checked={courierFormActive}
                  onChange={(e) => setCourierFormActive(e.target.checked)}
                  className="w-4 h-4 text-menthe border-graphite/20 rounded focus:ring-menthe"
                />
                <label htmlFor="courierActive" className="text-xs font-bold text-encre/70 cursor-pointer">Livreur disponible et actif</label>
              </div>

              <button type="submit" className="magnetic-btn bg-menthe text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-md shadow-menthe/20">
                Enregistrer le livreur
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COURIER DETAILS DIALOG */}
      {selectedCourierId && selectedCourier && (
        <div ref={detailOverlayRef} className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div ref={detailModalRef} className="bg-white w-full max-w-lg rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-menthe/10 text-menthe rounded-full flex items-center justify-center font-black text-sm">
                  {selectedCourier.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-encre">{selectedCourier.name}</h3>
                  <span className="text-[10px] text-encre/40 font-semibold">{selectedCourier.phone}</span>
                </div>
              </div>
              <button onClick={() => setSelectedCourierId(null)} className="text-encre/50 hover:text-menthe p-1 hover:bg-neige rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Micro Stats inside Detail */}
            <div className="grid grid-cols-2 gap-3 bg-neige/50 p-4 rounded-2xl border border-graphite/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase font-bold text-encre/40">Livrées avec succès</span>
                <span className="text-lg font-black text-menthe tabular-nums">{successDeliveries}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase font-bold text-encre/40">En cours actuellement</span>
                <span className="text-lg font-black text-encre tabular-nums">{selectedCourier.load}</span>
              </div>
            </div>

            {/* Orders History */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase font-bold text-encre/40 tracking-wider">Historique de livraison</span>
              <div className="flex flex-col gap-2.5 max-h-[40dvh] overflow-y-auto pr-1">
                {courierOrders.length > 0 ? (
                  courierOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between text-xs p-3 rounded-xl bg-neige border border-graphite/5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-encre">{o.customer}</span>
                        <span className="text-[9px] text-encre/40 font-mono">{o.id} | {new Date(o.date).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] uppercase px-2 py-0.5 rounded-full font-extrabold border ${
                          o.status === "paid" || o.status === "delivered" 
                            ? 'bg-menthe/10 text-menthe border-menthe/20' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                          {o.status === "paid" ? "Payée" : o.status === "delivered" ? "Livrée" : "En cours"}
                        </span>
                        <span className="font-extrabold text-encre tabular-nums">{formatFCFA(o.total)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-encre/30 italic font-semibold">Aucune commande assignée pour le moment.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg">
            <h3 className="text-sm font-black text-encre">Supprimer le livreur</h3>
            <p className="text-xs text-encre/60 leading-relaxed font-semibold">Êtes-vous certain de vouloir supprimer ce livreur de votre flotte logistique ? Cette action est définitive.</p>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-graphite/20 hover:border-encre rounded-xl text-xs font-bold text-encre transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleDeleteCourier(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold text-white transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
