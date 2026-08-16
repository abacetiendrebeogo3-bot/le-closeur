import React, { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, X, Package, MapPin, Layers, Coins, Image } from "lucide-react";
import { Product, Zone } from "../../types";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface CatalogViewProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  zones: Zone[];
  setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
  formatFCFA: (val: number) => string;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  businessId: string | null;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  setProducts,
  zones,
  setZones,
  formatFCFA,
  triggerToast,
  businessId
}) => {
  const [activeTab, setActiveTab] = useState<"products" | "zones">("products");
  
  // Product Form States
  const [showProductModal, setShowProductModal] = useState<{ mode: "create" | "edit"; productId?: string } | null>(null);
  const [prodFormName, setProdFormName] = useState("");
  const [prodFormPrice, setProdFormPrice] = useState(0);
  const [prodFormCategory, setProdFormCategory] = useState("");
  const [prodFormActive, setProdFormActive] = useState(true);
  const [prodFormStock, setProdFormStock] = useState<string>("");
  const [prodFormImageUrl, setProdFormImageUrl] = useState("");

  // Zone Form States
  const [showZoneModal, setShowZoneModal] = useState<{ mode: "create" | "edit"; zoneId?: string } | null>(null);
  const [zoneFormName, setZoneFormName] = useState("");
  const [zoneFormFee, setZoneFormFee] = useState(0);
  const [zoneFormTime, setZoneFormTime] = useState("24h");

  // Confirm Delete states
  const [showDeleteConfirmProd, setShowDeleteConfirmProd] = useState<string | null>(null);
  const [showDeleteConfirmZone, setShowDeleteConfirmZone] = useState<string | null>(null);

  // Refs for animation
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Extract unique categories from actual catalog for suggestions
  const existingCategories = Array.from(
    new Set(products.map(p => p.category).filter(Boolean))
  );

  // Animate the list on mount or tab change
  useEffect(() => {
    gsap.fromTo(".catalog-row",
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
    );
  }, [activeTab, products, zones]);

  // Animate Modal on Open
  useEffect(() => {
    if ((showProductModal || showZoneModal) && overlayRef.current && modalRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.fromTo(modalRef.current, { scale: 0.95, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.5)" });
    }
  }, [showProductModal, showZoneModal]);

  // Open Product Modal
  const openProductForm = (prod?: Product) => {
    if (prod) {
      setShowProductModal({ mode: "edit", productId: prod.id });
      setProdFormName(prod.name);
      setProdFormPrice(prod.price);
      setProdFormCategory(prod.category);
      setProdFormActive(prod.active);
      setProdFormStock(prod.stock !== undefined ? prod.stock.toString() : "");
      setProdFormImageUrl(prod.imageUrl || "");
    } else {
      setShowProductModal({ mode: "create" });
      setProdFormName("");
      setProdFormPrice(0);
      setProdFormCategory("");
      setProdFormActive(true);
      setProdFormStock("");
      setProdFormImageUrl("");
    }
  };

  // Open Zone Modal
  const openZoneForm = (z?: Zone) => {
    if (z) {
      setShowZoneModal({ mode: "edit", zoneId: z.id });
      setZoneFormName(z.name);
      setZoneFormFee(z.fee);
      setZoneFormTime(z.deliveryTime);
    } else {
      setShowZoneModal({ mode: "create" });
      setZoneFormName("");
      setZoneFormFee(0);
      setZoneFormTime("24h");
    }
  };

  // Save Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodFormName.trim()) return;

    const parsedStock = prodFormStock.trim() !== "" ? parseInt(prodFormStock) : undefined;

    if (showProductModal?.mode === "edit" && showProductModal.productId) {
      const { error } = await supabase.from("products").update({
        name: prodFormName.trim(),
        price: prodFormPrice,
        category: prodFormCategory.trim() || "Général",
        active: prodFormActive,
        stock: parsedStock,
        image_url: prodFormImageUrl.trim() || null
      }).eq("id", showProductModal.productId);

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      setProducts(prev => prev.map(p => p.id === showProductModal.productId ? {
        ...p,
        name: prodFormName.trim(),
        price: prodFormPrice,
        category: prodFormCategory.trim() || "Général",
        active: prodFormActive,
        stock: parsedStock,
        imageUrl: prodFormImageUrl.trim() || undefined
      } : p));
      triggerToast(`Produit mis à jour avec succès.`, "success");
    } else {
      const newId = `PROD-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from("products").insert({
        id: newId,
        business_id: businessId,
        name: prodFormName.trim(),
        price: prodFormPrice,
        category: prodFormCategory.trim() || "Général",
        active: prodFormActive,
        stock: parsedStock,
        image_url: prodFormImageUrl.trim() || null
      });

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      const newProd: Product = {
        id: newId,
        name: prodFormName.trim(),
        price: prodFormPrice,
        category: prodFormCategory.trim() || "Général",
        active: prodFormActive,
        stock: parsedStock,
        imageUrl: prodFormImageUrl.trim() || undefined
      };
      setProducts(prev => [...prev, newProd]);
      triggerToast(`Produit "${prodFormName}" ajouté au catalogue.`, "success");
    }
    setShowProductModal(null);
  };

  // Save Zone
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneFormName.trim()) return;

    if (showZoneModal?.mode === "edit" && showZoneModal.zoneId) {
      const { error } = await supabase.from("delivery_zones").update({
        name: zoneFormName.trim(),
        fee: zoneFormFee,
        delivery_time: zoneFormTime.trim()
      }).eq("id", showZoneModal.zoneId);

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      setZones(prev => prev.map(z => z.id === showZoneModal.zoneId ? {
        ...z,
        name: zoneFormName.trim(),
        fee: zoneFormFee,
        deliveryTime: zoneFormTime.trim()
      } : z));
      triggerToast(`Zone de livraison mise à jour.`, "success");
    } else {
      const newId = `ZONE-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from("delivery_zones").insert({
        id: newId,
        business_id: businessId,
        name: zoneFormName.trim(),
        fee: zoneFormFee,
        delivery_time: zoneFormTime.trim()
      });

      if (error) {
        triggerToast(`Erreur Supabase: ${error.message}`, "warning");
        return;
      }

      const newZone: Zone = {
        id: newId,
        name: zoneFormName.trim(),
        fee: zoneFormFee,
        deliveryTime: zoneFormTime.trim()
      };
      setZones(prev => [...prev, newZone]);
      triggerToast(`Zone "${zoneFormName}" ajoutée avec succès.`, "success");
    }
    setShowZoneModal(null);
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    triggerToast(`Produit "${prod?.name}" retiré du catalogue.`, "info");
    setShowDeleteConfirmProd(null);
  };

  // Delete Zone
  const handleDeleteZone = async (id: string) => {
    const z = zones.find(zn => zn.id === id);
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }
    setZones(prev => prev.filter(zn => zn.id !== id));
    triggerToast(`Zone de livraison "${z?.name}" supprimée.`, "info");
    setShowDeleteConfirmZone(null);
  };

  // Helper to render stock badge
  const renderStockBadge = (stockVal?: number) => {
    if (stockVal === undefined) {
      return <span className="text-[10px] text-encre/40 font-semibold">Non suivi</span>;
    }
    if (stockVal === 0) {
      return (
        <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-extrabold border bg-red-50 text-red-600 border-red-200">
          Rupture
        </span>
      );
    }
    if (stockVal < 5) {
      return (
        <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-extrabold border bg-amber-50 text-amber-600 border-amber-200">
          Bas ({stockVal})
        </span>
      );
    }
    return (
      <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-menthe/10 text-menthe border-menthe/20">
        {stockVal} dispo.
      </span>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-6 w-full">
      
      {/* Upper Tabs navigation & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-encre/40 tracking-wider">Gestion de l&apos;offre</span>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-encre">Catalogue & Zones</h3>
            <span className="text-[10px] bg-menthe/10 text-menthe border border-menthe/20 px-2 py-0.5 rounded-full font-bold">Centralisé</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 bg-neige p-1 rounded-xl border border-graphite/5 self-start md:self-auto w-full md:w-auto">
          <button 
            onClick={() => setActiveTab("products")}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "products" ? 'bg-white text-encre shadow-xs border border-graphite/5' : 'text-encre/50 hover:text-encre'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Produits ({products.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab("zones")}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "zones" ? 'bg-white text-encre shadow-xs border border-graphite/5' : 'text-encre/50 hover:text-encre'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Zones ({zones.length})</span>
          </button>
        </div>
      </div>

      {/* PRODUCTS TAB VIEW */}
      {activeTab === "products" && (
        <div className="flex flex-col gap-6">
          
          {/* Header Actions */}
          <div className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
            <span className="text-xs font-bold text-encre">Catalogue des articles</span>
            <button
              onClick={() => openProductForm()}
              className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un produit</span>
            </button>
          </div>

          {/* TABLE FOR DESKTOP (>= 768px) */}
          <div className="hidden md:block bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                    <th className="py-3 px-4">Visuel</th>
                    <th className="py-3 px-4">Désignation</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4 text-right">Prix Unitaire</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {products.map(prod => (
                    <tr key={prod.id} className="catalog-row border-b border-graphite/5 hover:bg-neige/40 transition-colors">
                      <td className="py-2 px-4">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt={prod.name} className="w-8 h-8 rounded-lg object-cover border border-graphite/10 shadow-xs" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-neige border border-graphite/10 flex items-center justify-center text-encre/40">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-encre">{prod.name}</span>
                          <span className="text-[9px] font-mono text-encre/40">{prod.id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-neige px-2.5 py-0.5 rounded-full border border-graphite/5 font-semibold text-[10px] text-encre/70">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold tabular-nums text-encre">{formatFCFA(prod.price)}</td>
                      <td className="py-3.5 px-4 text-center">{renderStockBadge(prod.stock)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                          prod.active 
                            ? 'bg-menthe/10 text-menthe border-menthe/20' 
                            : 'bg-graphite/10 text-graphite-light border-graphite/20'
                        }`}>
                          {prod.active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openProductForm(prod)}
                            className="text-encre/60 hover:text-menthe p-1.5 bg-neige border border-graphite/10 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirmProd(prod.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 border border-red-100 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* LIST FOR MOBILE (< 768px) */}
          <div className="md:hidden flex flex-col gap-4">
            {products.map(prod => (
              <div key={prod.id} className="catalog-row bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  {prod.imageUrl ? (
                    <img src={prod.imageUrl} alt={prod.name} className="w-12 h-12 rounded-xl object-cover border border-graphite/10 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-neige border border-graphite/10 flex items-center justify-center text-encre/40 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[9px] text-encre/40 font-mono">{prod.id}</span>
                    <span className="font-bold text-xs text-encre truncate">{prod.name}</span>
                    <span className="text-[9px] bg-neige px-2.5 py-0.5 rounded-full border border-graphite/5 font-bold self-start mt-1 text-encre/70">{prod.category}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-graphite/5 pt-3">
                  <div>
                    <span className="text-encre/45 font-semibold block mb-0.5">Prix unitaire</span>
                    <span className="font-bold text-encre text-xs">{formatFCFA(prod.price)}</span>
                  </div>
                  <div>
                    <span className="text-encre/45 font-semibold block mb-0.5">Stock disponible</span>
                    <span className="font-bold text-encre">{renderStockBadge(prod.stock)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-graphite/5 pt-3 mt-1">
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${
                    prod.active ? 'bg-menthe/10 text-menthe border-menthe/20' : 'bg-graphite/10 text-graphite-light border-graphite/20'
                  }`}>
                    {prod.active ? "Actif" : "Inactif"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openProductForm(prod)}
                      className="text-xs font-bold text-encre/75 px-3 py-1.5 bg-neige border border-graphite/10 rounded-xl flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Modifier</span>
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirmProd(prod.id)}
                      className="text-xs font-bold text-red-600 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ZONES TAB VIEW */}
      {activeTab === "zones" && (
        <div className="flex flex-col gap-6">
          
          {/* Header Actions */}
          <div className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
            <span className="text-xs font-bold text-encre">Zones logistiques</span>
            <button
              onClick={() => openZoneForm()}
              className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une zone</span>
            </button>
          </div>

          {/* TABLE FOR DESKTOP (>= 768px) */}
          <div className="hidden md:block bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                    <th className="py-3 px-4">Zone</th>
                    <th className="py-3 px-4">Délai estimé</th>
                    <th className="py-3 px-4 text-right">Frais logistiques</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {zones.map(z => (
                    <tr key={z.id} className="catalog-row border-b border-graphite/5 hover:bg-neige/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-encre">{z.name}</td>
                      <td className="py-3.5 px-4 text-encre/60 font-semibold">{z.deliveryTime}</td>
                      <td className="py-3.5 px-4 text-right font-black tabular-nums text-menthe">{formatFCFA(z.fee)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openZoneForm(z)}
                            className="text-encre/60 hover:text-menthe p-1.5 bg-neige border border-graphite/10 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirmZone(z.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 border border-red-100 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* LIST FOR MOBILE (< 768px) */}
          <div className="md:hidden flex flex-col gap-4">
            {zones.map(z => (
              <div key={z.id} className="catalog-row bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-encre">{z.name}</span>
                  <span className="text-xs font-black text-menthe">{formatFCFA(z.fee)}</span>
                </div>
                
                <div className="text-[10px] text-encre/50 font-semibold">
                  Délai estimé de livraison : <span className="text-encre font-bold">{z.deliveryTime}</span>
                </div>

                <div className="flex gap-2 justify-end border-t border-graphite/5 pt-3 mt-1">
                  <button
                    onClick={() => openZoneForm(z)}
                    className="text-xs font-bold text-encre/75 px-3.5 py-1.5 bg-neige border border-graphite/10 rounded-xl flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirmZone(z.id)}
                    className="text-xs font-bold text-red-600 px-3.5 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* EDIT/CREATE PRODUCT MODAL */}
      {showProductModal && (
        <div ref={overlayRef} className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div ref={modalRef} className="bg-white w-full max-w-md rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-encre">
                {showProductModal.mode === "create" ? "Ajouter un produit" : "Modifier le produit"}
              </h3>
              <button onClick={() => setShowProductModal(null)} className="text-encre/50 hover:text-menthe p-1 hover:bg-neige rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Désignation du produit *</label>
                <input
                  type="text"
                  required
                  value={prodFormName}
                  onChange={(e) => setProdFormName(e.target.value)}
                  placeholder="Ex: T-shirt noir, Panier garni..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-encre/50">Prix (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={prodFormPrice}
                    onChange={(e) => setProdFormPrice(parseInt(e.target.value) || 0)}
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre text-right"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-encre/50">Stock (optionnel)</label>
                  <input
                    type="number"
                    min={0}
                    value={prodFormStock}
                    onChange={(e) => setProdFormStock(e.target.value)}
                    placeholder="Illimité"
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre text-right"
                  />
                </div>
              </div>

              {/* Free Text Category with suggestions pills */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Catégorie *</label>
                <input
                  type="text"
                  required
                  value={prodFormCategory}
                  onChange={(e) => setProdFormCategory(e.target.value)}
                  placeholder="Ex: Vêtements, Électronique, Alimentaire..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
                
                {/* Categories suggestions pills */}
                {existingCategories.length > 0 && (
                  <div className="mt-1">
                    <span className="text-[9px] text-encre/30 font-semibold block mb-1">Suggestions de catégories :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {existingCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setProdFormCategory(cat)}
                          className="text-[9px] bg-neige hover:bg-menthe/10 hover:text-menthe px-2 py-0.5 rounded-md border border-graphite/5 font-bold transition-all text-encre/60"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Image URL field */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">URL de l&apos;image (optionnelle)</label>
                <input
                  type="text"
                  value={prodFormImageUrl}
                  onChange={(e) => setProdFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
              </div>

              <div className="flex items-center gap-3 py-1">
                <input
                  id="prodActive"
                  type="checkbox"
                  checked={prodFormActive}
                  onChange={(e) => setProdFormActive(e.target.checked)}
                  className="w-4 h-4 text-menthe border-graphite/20 rounded focus:ring-menthe"
                />
                <label htmlFor="prodActive" className="text-xs font-bold text-encre/70 cursor-pointer">Activer ce produit dans le catalogue de vente</label>
              </div>

              <button type="submit" className="magnetic-btn bg-menthe text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-md shadow-menthe/20">
                Enregistrer le produit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT/CREATE ZONE MODAL */}
      {showZoneModal && (
        <div ref={overlayRef} className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div ref={modalRef} className="bg-white w-full max-w-md rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-encre">
                {showZoneModal.mode === "create" ? "Ajouter une zone" : "Modifier la zone"}
              </h3>
              <button onClick={() => setShowZoneModal(null)} className="text-encre/50 hover:text-menthe p-1 hover:bg-neige rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Nom de la zone *</label>
                <input
                  type="text"
                  required
                  value={zoneFormName}
                  onChange={(e) => setZoneFormName(e.target.value)}
                  placeholder="Ex: Secteur A, Ville Haute..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Frais logistiques (FCFA) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={zoneFormFee}
                  onChange={(e) => setZoneFormFee(parseInt(e.target.value) || 0)}
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre text-right"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Délai estimé</label>
                <input
                  type="text"
                  value={zoneFormTime}
                  onChange={(e) => setZoneFormTime(e.target.value)}
                  placeholder="Ex: 24h, 2 heures..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                />
              </div>

              <button type="submit" className="magnetic-btn bg-menthe text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-md shadow-menthe/20">
                Enregistrer la zone
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE PRODUCT MODAL */}
      {showDeleteConfirmProd && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg">
            <h3 className="text-sm font-black text-encre">Supprimer le produit</h3>
            <p className="text-xs text-encre/60 leading-relaxed font-semibold">Êtes-vous certain de vouloir retirer ce produit du catalogue ? Cette action est irréversible.</p>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setShowDeleteConfirmProd(null)}
                className="px-4 py-2 border border-graphite/20 hover:border-encre rounded-xl text-xs font-bold text-encre transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleDeleteProduct(showDeleteConfirmProd)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold text-white transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ZONE MODAL */}
      {showDeleteConfirmZone && (
        <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] border border-graphite/10 p-6 flex flex-col gap-5 shadow-lg">
            <h3 className="text-sm font-black text-encre">Supprimer la zone</h3>
            <p className="text-xs text-encre/60 leading-relaxed font-semibold">Êtes-vous certain de vouloir supprimer cette zone de livraison ? Toutes les futures commandes sur cette zone devront être réassignées.</p>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setShowDeleteConfirmZone(null)}
                className="px-4 py-2 border border-graphite/20 hover:border-encre rounded-xl text-xs font-bold text-encre transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleDeleteZone(showDeleteConfirmZone)}
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
