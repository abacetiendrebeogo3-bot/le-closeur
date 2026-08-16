import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { gsap } from "gsap";

interface CustomerFormProps {
  showCustomerModal: { mode: "create" | "edit", customerId?: string } | null;
  setShowCustomerModal: (val: { mode: "create" | "edit", customerId?: string } | null) => void;
  custFormName: string;
  setCustFormName: (val: string) => void;
  custFormPhone: string;
  setCustFormPhone: (val: string) => void;
  custFormEmail: string;
  setCustFormEmail: (val: string) => void;
  custFormAddress: string;
  setCustFormAddress: (val: string) => void;
  handleSaveCustomer: (e: React.FormEvent) => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  showCustomerModal,
  setShowCustomerModal,
  custFormName,
  setCustFormName,
  custFormPhone,
  setCustFormPhone,
  custFormEmail,
  setCustFormEmail,
  custFormAddress,
  setCustFormAddress,
  handleSaveCustomer
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCustomerModal && overlayRef.current && modalRef.current) {
      gsap.fromTo(overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: "power2.out" }
      );
      gsap.fromTo(modalRef.current,
        { scale: 0.95, opacity: 0, y: 15 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, delay: 0.05, ease: "back.out(1.5)" }
      );
    }
  }, [showCustomerModal]);

  if (!showCustomerModal) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div ref={modalRef} className="bg-white w-full max-w-md rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-encre">
            {showCustomerModal.mode === "create" ? "Ajouter un nouveau client" : "Modifier le client"}
          </h3>
          <button onClick={() => setShowCustomerModal(null)} className="text-encre/50 hover:text-menthe p-1 hover:bg-neige rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Nom complet *</label>
            <input
              type="text"
              required
              value={custFormName}
              onChange={(e) => setCustFormName(e.target.value)}
              placeholder="Ex: Youssou Ndiaye"
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Numéro WhatsApp *</label>
            <input
              type="text"
              required
              value={custFormPhone}
              onChange={(e) => setCustFormPhone(e.target.value)}
              placeholder="Ex: +221 77 654 32 10"
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold font-mono text-encre"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Email (optionnel)</label>
            <input
              type="email"
              value={custFormEmail}
              onChange={(e) => setCustFormEmail(e.target.value)}
              placeholder="Ex: client@domain.sn"
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Adresse</label>
            <input
              type="text"
              value={custFormAddress}
              onChange={(e) => setCustFormAddress(e.target.value)}
              placeholder="Ex: Almadies, Villa 12, Dakar"
              className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
            />
          </div>

          <button type="submit" className="magnetic-btn bg-menthe text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-md shadow-menthe/20">
            Enregistrer le client
          </button>
        </form>
      </div>
    </div>
  );
};
