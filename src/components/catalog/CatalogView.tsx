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
  const getFirstImage = (urlField: string | undefined): string => {
    if (!urlField) return "";
    const trimmed = urlField.trim();
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr) && arr.length > 0) return arr[0];
      } catch (e) {}
    }
    return trimmed;
  };

  const [activeTab, setActiveTab] = useState<"products" | "zones">("products");
  
  // Product Form States
  const [showProductModal, setShowProductModal] = useState<{ mode: "create" | "edit"; productId?: string } | null>(null);
  const [prodFormName, setProdFormName] = useState("");
  const [prodFormPrice, setProdFormPrice] = useState(0);
  const [prodFormCategory, setProdFormCategory] = useState("");
  const [prodFormActive, setProdFormActive] = useState(true);
  const [prodFormStock, setProdFormStock] = useState<string>("");
  const [prodFormImageUrl, setProdFormImageUrl] = useState("");
  const [prodFormDescription, setProdFormDescription] = useState("");
  const [prodFormTestimonials, setProdFormTestimonials] = useState("");
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [tempTextTestimonial, setTempTextTestimonial] = useState("");

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
      setProdFormDescription(prod.description || "");
      setProdFormTestimonials(prod.testimonials || "");
    } else {
      setShowProductModal({ mode: "create" });
      setProdFormName("");
      setProdFormPrice(0);
      setProdFormCategory("");
      setProdFormActive(true);
      setProdFormStock("");
      setProdFormImageUrl("");
      setProdFormDescription("");
      setProdFormTestimonials("");
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let loadedCount = 0;
    const newImages: string[] = [];

    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          newImages.push(reader.result);
        }
        loadedCount++;
        if (loadedCount === fileList.length) {
          let currentList: string[] = [];
          if (prodFormImageUrl.trim().startsWith("[")) {
            try {
              currentList = JSON.parse(prodFormImageUrl);
            } catch (e) {}
          } else if (prodFormImageUrl.trim()) {
            currentList = [prodFormImageUrl.trim()];
          }
          const updatedList = [...currentList, ...newImages];
          setProdFormImageUrl(JSON.stringify(updatedList));
          triggerToast(`${newImages.length} image(s) chargée(s).`, "success");
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const generateAIDescription = async () => {
    if (!prodFormName.trim()) {
      triggerToast("Veuillez d'abord saisir la désignation du produit.", "warning");
      return;
    }
    setIsGeneratingDesc(true);
    try {
      const res = await fetch("/api/agent/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prodFormName, category: prodFormCategory }),
      });
      const data = await res.json();
      if (data.description) {
        setProdFormDescription(data.description);
        triggerToast("Description générée avec succès par l'IA !", "success");
      } else {
        triggerToast(data.error || "Impossible de générer la description.", "warning");
      }
    } catch (e) {
      triggerToast("Erreur lors de la génération de la description.", "warning");
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleTestimonialMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let loadedCount = 0;
    const newMedia: { type: "image" | "video"; content: string }[] = [];

    fileList.forEach(file => {
      const reader = new FileReader();
      const type = file.type.startsWith("video/") ? "video" : "image";
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          newMedia.push({ type, content: reader.result });
        }
        loadedCount++;
        if (loadedCount === fileList.length) {
          let currentList: any[] = [];
          if (prodFormTestimonials.trim().startsWith("[")) {
            try {
              currentList = JSON.parse(prodFormTestimonials);
            } catch (e) {}
          } else if (prodFormTestimonials.trim()) {
            currentList = [{ type: "text", content: prodFormTestimonials.trim() }];
          }
          const updatedList = [...currentList, ...newMedia];
          setProdFormTestimonials(JSON.stringify(updatedList));
          triggerToast(`${newMedia.length} média(s) de témoignage ajouté(s).`, "success");
        }
      };
      reader.readAsDataURL(file);
    });
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
        image_url: prodFormImageUrl.trim() || null,
        description: prodFormDescription.trim() || null,
        testimonials: prodFormTestimonials.trim() || null
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
        imageUrl: prodFormImageUrl.trim() || undefined,
        description: prodFormDescription.trim() || undefined,
        testimonials: prodFormTestimonials.trim() || undefined
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
        image_url: prodFormImageUrl.trim() || null,
        description: prodFormDescription.trim() || null,
        testimonials: prodFormTestimonials.trim() || null
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
        imageUrl: prodFormImageUrl.trim() || undefined,
        description: prodFormDescription.trim() || undefined,
        testimonials: prodFormTestimonials.trim() || undefined
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
                        {getFirstImage(prod.imageUrl) ? (
                          <img src={getFirstImage(prod.imageUrl)} alt={prod.name} className="w-8 h-8 rounded-lg object-cover border border-graphite/10 shadow-xs" />
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
                  {getFirstImage(prod.imageUrl) ? (
                    <img src={getFirstImage(prod.imageUrl)} alt={prod.name} className="w-12 h-12 rounded-xl object-cover border border-graphite/10 shrink-0" />
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
          <div ref={modalRef} className="bg-white w-full max-w-4xl rounded-[2.5rem] border border-graphite/10 p-8 flex flex-col gap-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-graphite/5 pb-4">
              <div className="flex flex-col">
                <h3 className="text-base font-extrabold text-encre">
                  {showProductModal.mode === "create" ? "Ajouter un nouveau produit" : "Modifier la fiche produit"}
                </h3>
                <span className="text-[10px] text-encre/40 font-semibold mt-0.5">Renseignez les détails, visuels et témoignages pour l&apos;Agent IA.</span>
              </div>
              <button onClick={() => setShowProductModal(null)} className="text-encre/50 hover:text-menthe p-2 hover:bg-neige rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* LEFT COLUMN: Visuels & Témoignages */}
              <div className="flex flex-col gap-5">
                
                {/* Images Section */}
                <div className="bg-neige/50 p-5 rounded-[2rem] border border-graphite/5 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-black tracking-wider text-encre/65">Galerie Visuels Produit</label>
                    <span className="text-[9px] text-encre/30 font-bold">Sélection multiple possible</span>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold text-encre cursor-pointer file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-menthe/10 file:text-menthe hover:file:bg-menthe/20 w-full"
                  />
                  <div className="text-[9px] text-encre/35 font-semibold">Ou collez une URL d&apos;image externe :</div>
                  <input
                    type="text"
                    value={prodFormImageUrl.startsWith("[") ? "" : prodFormImageUrl}
                    onChange={(e) => setProdFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                  />
                  
                  {/* Images Grid */}
                  {(() => {
                    let images: string[] = [];
                    if (prodFormImageUrl.trim().startsWith("[")) {
                      try {
                        images = JSON.parse(prodFormImageUrl);
                      } catch (e) {}
                    } else if (prodFormImageUrl.trim()) {
                      images = [prodFormImageUrl.trim()];
                    }
                    
                    if (images.length === 0) return null;
                    
                    return (
                      <div className="grid grid-cols-4 gap-2 mt-2 max-h-40 overflow-y-auto p-1">
                        {images.map((imgSrc, index) => (
                          <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-graphite/10 shadow-xs group">
                            <img src={imgSrc} alt={`Aperçu ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                const newList = images.filter((_, i) => i !== index);
                                setProdFormImageUrl(newList.length > 0 ? JSON.stringify(newList) : "");
                              }}
                              className="absolute inset-0 bg-red-600/80 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Testimonials Section */}
                <div className="bg-neige/50 p-5 rounded-[2rem] border border-graphite/5 flex flex-col gap-4">
                  <label className="text-[10px] uppercase font-black tracking-wider text-encre/65">Témoignages & Preuves Sociales</label>
                  
                  {/* Text testimonial addition */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Saisir un avis client..."
                      value={tempTextTestimonial}
                      onChange={(e) => setTempTextTestimonial(e.target.value)}
                      className="flex-1 bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempTextTestimonial.trim()) return;
                        let currentList: any[] = [];
                        if (prodFormTestimonials.trim().startsWith("[")) {
                          try {
                            currentList = JSON.parse(prodFormTestimonials);
                          } catch (e) {}
                        } else if (prodFormTestimonials.trim()) {
                          currentList = [{ type: "text", content: prodFormTestimonials.trim() }];
                        }
                        const updatedList = [...currentList, { type: "text", content: tempTextTestimonial.trim() }];
                        setProdFormTestimonials(JSON.stringify(updatedList));
                        setTempTextTestimonial("");
                        triggerToast("Témoignage texte ajouté.", "success");
                      }}
                      className="bg-menthe/10 hover:bg-menthe/20 text-menthe px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>

                  {/* Media uploads (photos / videos) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] text-encre/40 font-bold">Importer captures d&apos;écran d&apos;avis ou vidéos :</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleTestimonialMediaChange}
                      className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none cursor-pointer file:mr-3 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-black file:bg-menthe/10 file:text-menthe w-full"
                    />
                  </div>

                  {/* Testimonial Items List */}
                  {(() => {
                    let items: any[] = [];
                    if (prodFormTestimonials.trim().startsWith("[")) {
                      try {
                        items = JSON.parse(prodFormTestimonials);
                      } catch (e) {}
                    } else if (prodFormTestimonials.trim()) {
                      items = [{ type: "text", content: prodFormTestimonials.trim() }];
                    }

                    if (items.length === 0) return <div className="text-[10px] text-encre/30 font-semibold italic text-center py-2">Aucun témoignage enregistré.</div>;

                    return (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-graphite/5 shadow-xs flex items-center justify-between gap-3 text-xs">
                            <div className="flex-1 min-w-0">
                              {item.type === "text" && (
                                <p className="italic text-encre font-medium truncate">&ldquo;{item.content}&rdquo;</p>
                              )}
                              {item.type === "image" && (
                                <div className="flex items-center gap-2">
                                  <img src={item.content} className="w-10 h-10 object-cover rounded-lg border" alt="Aperçu capture" />
                                  <span className="text-[10px] text-encre/40 font-semibold">Capture d&apos;écran</span>
                                </div>
                              )}
                              {item.type === "video" && (
                                <div className="flex items-center gap-2">
                                  <video src={item.content} className="w-10 h-10 object-cover rounded-lg border bg-black" />
                                  <span className="text-[10px] text-encre/40 font-semibold">Vidéo Témoignage</span>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newList = items.filter((_, i) => i !== idx);
                                setProdFormTestimonials(newList.length > 0 ? JSON.stringify(newList) : "");
                              }}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN: Détails & IA */}
              <div className="flex flex-col justify-between gap-5">
                <div className="flex flex-col gap-4">
                  {/* Name field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-encre/50">Désignation du produit *</label>
                    <input
                      type="text"
                      required
                      value={prodFormName}
                      onChange={(e) => setProdFormName(e.target.value)}
                      placeholder="Ex: T-shirt noir, Kit Minceur..."
                      className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-menthe font-bold text-encre"
                    />
                  </div>

                  {/* Price & Stock Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-encre/50">Prix (FCFA) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={prodFormPrice}
                        onChange={(e) => setProdFormPrice(parseInt(e.target.value) || 0)}
                        className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-menthe font-black text-encre text-right"
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
                        className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-menthe font-bold text-encre text-right"
                      />
                    </div>
                  </div>

                  {/* Category Selection Carousel */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-encre/50">Catégorie du produit *</label>
                    <input
                      type="text"
                      required
                      value={prodFormCategory}
                      onChange={(e) => setProdFormCategory(e.target.value)}
                      placeholder="Catégorie..."
                      className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre"
                    />
                    {/* Predefined Carousel/Grid of pills */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {["Santé", "Cosmétique & Beauté", "Vêtements & Mode", "Alimentation", "Électronique", "Maison & Déco"].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setProdFormCategory(cat)}
                          className={`text-[9px] px-2.5 py-1 rounded-md border font-black transition-all ${
                            prodFormCategory === cat
                              ? "bg-menthe text-white border-menthe shadow-xs"
                              : "bg-neige hover:bg-menthe/10 hover:text-menthe border-graphite/5 text-encre/60"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description Section with AI Prompt button */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-encre/50">Description commerciale *</label>
                      <button
                        type="button"
                        onClick={generateAIDescription}
                        disabled={isGeneratingDesc}
                        className="text-[9px] font-black text-menthe bg-menthe/10 hover:bg-menthe/20 border border-menthe/20 px-2.5 py-1 rounded-md transition-all flex items-center gap-1"
                      >
                        {isGeneratingDesc ? "Génération..." : "✨ Rédiger avec l'IA"}
                      </button>
                    </div>
                    <textarea
                      value={prodFormDescription}
                      onChange={(e) => setProdFormDescription(e.target.value)}
                      placeholder="Saisissez ou générez une description persuasive pour aider l'Agent IA à argumenter et closer la vente..."
                      rows={5}
                      required
                      className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-menthe font-semibold text-encre resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Footer Controls within Right Column */}
                <div className="flex flex-col gap-4 mt-auto pt-4 border-t border-graphite/5">
                  <div className="flex items-center gap-3">
                    <input
                      id="prodActive"
                      type="checkbox"
                      checked={prodFormActive}
                      onChange={(e) => setProdFormActive(e.target.checked)}
                      className="w-4 h-4 text-menthe border-graphite/20 rounded focus:ring-menthe cursor-pointer"
                    />
                    <label htmlFor="prodActive" className="text-xs font-bold text-encre/70 cursor-pointer select-none">Activer ce produit dans le catalogue de vente</label>
                  </div>

                  <button type="submit" className="magnetic-btn bg-menthe text-neige font-extrabold py-3.5 rounded-xl text-center text-xs transition-all shadow-md shadow-menthe/20 w-full hover:brightness-105 active:scale-98">
                    Enregistrer la fiche produit
                  </button>
                </div>

              </div>

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
