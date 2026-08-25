"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase/client";
import { 
  TrendingUp, 
  Coins, 
  Target, 
  AlertCircle, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Sliders,
  DollarSign
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { Order } from "../../types";

interface PilotageViewProps {
  businessId: string;
  orders: Order[];
  formatFCFA: (val: number) => string;
}

interface FinanceExpenses {
  pub: number;
  stock: number;
  livraison: number;
  salaires: number;
  autres: number;
}

export const PilotageView: React.FC<PilotageViewProps> = ({
  businessId,
  orders,
  formatFCFA
}) => {
  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // DB States
  const [entry, setEntry] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    repartition: { reserve_entreprise: 10, part_perso: 40, reinvestissement: 40, tampon: 10 },
    seuils_alerte: { marge_orange: 15, marge_rouge: 5, jours_deficit_rouge: 3 }
  });
  const [history, setHistory] = useState<any[]>([]);

  // Form inputs states
  const [objectifCa, setObjectifCa] = useState<number>(0);
  const [objectifBenefice, setObjectifBenefice] = useState<number>(0);
  const [caRealise, setCaRealise] = useState<number>(0);
  const [depenses, setDepenses] = useState<FinanceExpenses>({
    pub: 0,
    stock: 0,
    livraison: 0,
    salaires: 0,
    autres: 0
  });

  // Settings editing states
  const [showSettingsEdit, setShowSettingsEdit] = useState<boolean>(false);
  const [repReserve, setRepReserve] = useState<number>(10);
  const [repPerso, setRepPerso] = useState<number>(40);
  const [repReinvest, setRepReinvest] = useState<number>(40);
  const [repTampon, setRepTampon] = useState<number>(10);
  
  const [alertOrange, setAlertOrange] = useState<number>(15);
  const [alertRouge, setAlertRouge] = useState<number>(5);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [generatingIa, setGeneratingIa] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const triggerToast = useCallback((message: string, type: "success" | "warning" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Compute automatic CA for selectedDate from paid orders
  const calculateAutoCa = useCallback(() => {
    const dailyPaidOrders = orders.filter(
      (o) => o.date === selectedDate && o.paymentStatus === "paid"
    );
    return dailyPaidOrders.reduce((sum, o) => sum + o.total, 0);
  }, [orders, selectedDate]);

  // Load finance settings
  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("finance_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
        setRepReserve(data.repartition?.reserve_entreprise ?? 10);
        setRepPerso(data.repartition?.part_perso ?? 40);
        setRepReinvest(data.repartition?.reinvestissement ?? 40);
        setRepTampon(data.repartition?.tampon ?? 10);
        setAlertOrange(data.seuils_alerte?.marge_orange ?? 15);
        setAlertRouge(data.seuils_alerte?.marge_rouge ?? 5);
      }
    } catch (err: any) {
      console.error("Error loading settings:", err);
    }
  }, [businessId]);

  // Load daily entry for selectedDate
  const loadDailyEntry = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("finance_daily_entries")
        .select("*")
        .eq("business_id", businessId)
        .eq("date", selectedDate)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEntry(data);
        setObjectifCa(data.objectif_ca ?? 0);
        setObjectifBenefice(data.objectif_benefice ?? 0);
        setCaRealise(data.ca_realise ?? 0);
        setDepenses({
          pub: data.depenses?.pub ?? 0,
          stock: data.depenses?.stock ?? 0,
          livraison: data.depenses?.livraison ?? 0,
          salaires: data.depenses?.salaires ?? 0,
          autres: data.depenses?.autres ?? 0
        });
      } else {
        // Compute default auto CA
        const autoCa = calculateAutoCa();
        setEntry(null);
        setObjectifCa(0);
        setObjectifBenefice(0);
        setCaRealise(autoCa);
        setDepenses({ pub: 0, stock: 0, livraison: 0, salaires: 0, postgres: 0, autres: 0 });
      }
    } catch (err: any) {
      triggerToast(`Erreur chargement : ${err.message}`, "warning");
    } finally {
      setLoading(false);
    }
  }, [businessId, selectedDate, calculateAutoCa, triggerToast]);

  // Load 30-day history for charts
  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("finance_daily_entries")
        .select("date, ca_realise, depenses, objectif_benefice, commentaire_ia")
        .eq("business_id", businessId)
        .order("date", { ascending: true })
        .limit(30);

      if (error) throw error;
      if (data) {
        const mapped = data.map((d: any) => {
          const totalDep = 
            (d.depenses?.pub ?? 0) + 
            (d.depenses?.stock ?? 0) + 
            (d.depenses?.livraison ?? 0) + 
            (d.depenses?.salaires ?? 0) + 
            (d.depenses?.autres ?? 0);
          const beneficeNet = d.ca_realise - totalDep;
          return {
            date: d.date,
            ca: d.ca_realise,
            benefice: beneficeNet,
            objectif: d.objectif_benefice ?? 0
          };
        });
        setHistory(mapped);
      }
    } catch (err: any) {
      console.error("Error loading history:", err);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadSettings();
      loadDailyEntry();
      loadHistory();
    }
  }, [businessId, selectedDate, loadSettings, loadDailyEntry, loadHistory]);

  // Handle Save finance daily entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        business_id: businessId,
        date: selectedDate,
        objectif_ca: objectifCa,
        objectif_benefice: objectifBenefice,
        ca_realise: caRealise,
        depenses: depenses
      };

      const { data, error } = await supabase
        .from("finance_daily_entries")
        .upsert(payload, { onConflict: "business_id, date" })
        .select()
        .single();

      if (error) throw error;
      setEntry(data);
      triggerToast("Bilan financier enregistré avec succès !", "success");
      loadHistory();
    } catch (err: any) {
      triggerToast(`Erreur d'enregistrement : ${err.message}`, "warning");
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = repReserve + repPerso + repReinvest + repTampon;
    if (total !== 100) {
      triggerToast(`Le total de la répartition doit être de 100% (actuellement ${total}%).`, "warning");
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        repartition: {
          reserve_entreprise: repReserve,
          part_perso: repPerso,
          reinvestment: repReinvest,
          tampon: repTampon
        },
        seuils_alerte: {
          marge_orange: alertOrange,
          marge_rouge: alertRouge,
          jours_deficit_rouge: settings.seuils_alerte?.jours_deficit_rouge ?? 3
        }
      };

      const { data, error } = await supabase
        .from("finance_settings")
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
      setShowSettingsEdit(false);
      triggerToast("Paramètres financiers enregistrés !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Trigger IA Comment Generation
  const handleGenerateIaComment = async () => {
    setGeneratingIa(true);
    try {
      const res = await fetch("/api/finance/generate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, date: selectedDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      
      triggerToast("Commentaire IA généré !", "success");
      loadDailyEntry();
    } catch (err: any) {
      triggerToast(`Erreur IA : ${err.message}`, "warning");
    } finally {
      setGeneratingIa(false);
    }
  };

  // Helper computations
  const totalDepenses = 
    (depenses.pub || 0) + 
    (depenses.stock || 0) + 
    (depenses.livraison || 0) + 
    (depenses.salaires || 0) + 
    (depenses.autres || 0);

  const beneficeNet = caRealise - totalDepenses;
  const margeNette = caRealise > 0 ? (beneficeNet / caRealise) * 100 : 0;

  // Determine financial status health indicator
  const getHealthStatus = () => {
    if (caRealise === 0) return { label: "En attente", color: "bg-graphite/40 text-graphite-light", dot: "bg-graphite/60" };
    
    const seuils = settings.seuils_alerte ?? { marge_orange: 15, marge_rouge: 5 };
    if (beneficeNet < 0 || margeNette < seuils.marge_rouge) {
      return { label: "Alerte Rouge", color: "bg-red-50 text-red-600 border border-red-200", dot: "bg-red-500 animate-pulse" };
    }
    if (margeNette < seuils.marge_orange) {
      return { label: "Alerte Orange", color: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-500" };
    }
    return { label: "Santé Excellente", color: "bg-emerald-50 text-emerald-600 border border-emerald-200", dot: "bg-emerald-500" };
  };

  const health = getHealthStatus();

  // Handle Date Stepper
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  return (
    <div className="flex flex-col gap-6 text-encre">
      {/* Toast alert */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`p-4 rounded-2xl shadow-lg border text-xs font-bold transition-all ${
            toast.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
            toast.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-600" :
            "bg-blue-50 border-blue-100 text-blue-600"
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Date navigation bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-graphite/10 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-neige rounded-xl border border-graphite/5 transition-colors">
            <ChevronLeft className="w-4 h-4 text-encre/70" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-menthe" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-black text-encre bg-transparent border-none focus:outline-none cursor-pointer"
            />
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-neige rounded-xl border border-graphite/5 transition-colors">
            <ChevronRight className="w-4 h-4 text-encre/70" />
          </button>
        </div>

        {/* Health status pastille */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-bold text-encre/40">État financier :</span>
          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-2 ${health.color}`}>
            <span className={`w-2 h-2 rounded-full ${health.dot}`}></span>
            {health.label}
          </span>
          <button 
            onClick={() => setShowSettingsEdit(!showSettingsEdit)} 
            className="p-2 hover:bg-neige rounded-xl border border-graphite/5 text-encre/60 hover:text-menthe transition-colors flex items-center gap-1.5 text-[10px] font-bold"
          >
            <Sliders className="w-3.5 h-3.5" /> Répartition
          </button>
        </div>
      </div>

      {/* Settings edit modal/accordion */}
      {showSettingsEdit && (
        <form onSubmit={handleSaveSettings} className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
          <span className="text-xs font-black uppercase text-encre/75 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-menthe" /> Configuration de la répartition & Seuils
          </span>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Réserve (%)</label>
              <input
                type="number"
                min={0} max={100}
                value={repReserve}
                onChange={(e) => setRepReserve(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Part Perso (%)</label>
              <input
                type="number"
                min={0} max={100}
                value={repPerso}
                onChange={(e) => setRepPerso(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Réinvestissement (%)</label>
              <input
                type="number"
                min={0} max={100}
                value={repReinvest}
                onChange={(e) => setRepReinvest(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Tampon (%)</label>
              <input
                type="number"
                min={0} max={100}
                value={repTampon}
                onChange={(e) => setRepTampon(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Marge Seuil Orange (%)</label>
              <input
                type="number"
                value={alertOrange}
                onChange={(e) => setAlertOrange(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-encre/50">Marge Seuil Rouge (%)</label>
              <input
                type="number"
                value={alertRouge}
                onChange={(e) => setAlertRouge(parseInt(e.target.value) || 0)}
                className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-encre/50 font-bold border-t border-graphite/5 pt-3">
            <span>Total : {repReserve + repPerso + repReinvest + repTampon}% (Doit valoir 100%)</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSettingsEdit(false)} className="px-3 py-1.5 bg-neige border border-graphite/10 rounded-xl">Annuler</button>
              <button type="submit" className="px-4 py-1.5 bg-encre text-white rounded-xl font-black">Sauvegarder</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center text-xs py-8 text-encre/40 font-bold">Chargement du bilan journalier...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: form & calculations */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Form sheet */}
            <form onSubmit={handleSaveEntry} className="p-6 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                <Coins className="w-4.5 h-4.5 text-menthe" /> Bilan journalier ({selectedDate})
              </span>

              {/* Bloc 1: Objectif du jour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neige/50 p-4 rounded-xl border border-graphite/5">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50 flex items-center gap-1"><Target className="w-3 h-3 text-menthe" /> Objectif CA du jour (FCFA)</label>
                  <input
                    type="number"
                    value={objectifCa}
                    onChange={(e) => setObjectifCa(parseInt(e.target.value) || 0)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre text-right"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50 flex items-center gap-1"><Target className="w-3 h-3 text-menthe" /> Objectif Bénéfice du jour (FCFA)</label>
                  <input
                    type="number"
                    value={objectifBenefice}
                    onChange={(e) => setObjectifBenefice(parseInt(e.target.value) || 0)}
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre text-right"
                  />
                </div>
              </div>

              {/* CA réalisé & Expenses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-black text-encre/60">Chiffre d&apos;affaires réalisé (FCFA) *</label>
                    <input
                      type="number"
                      required
                      value={caRealise}
                      onChange={(e) => setCaRealise(parseInt(e.target.value) || 0)}
                      className="bg-white border border-graphite/15 rounded-xl px-3.5 py-3 text-sm font-black text-encre text-right focus:outline-none focus:border-menthe"
                    />
                    <div className="flex items-center justify-between text-[9px] text-encre/40 font-semibold px-1">
                      <span>Calculé depuis les commandes payées</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const autoCa = calculateAutoCa();
                          setCaRealise(autoCa);
                          triggerToast("CA réinitialisé à la valeur automatique.", "info");
                        }} 
                        className="text-menthe hover:underline"
                      >
                        Réinitialiser ({formatFCFA(calculateAutoCa())})
                      </button>
                    </div>
                  </div>

                  {/* Profit summary card */}
                  <div className="p-4 bg-encre text-neige rounded-xl flex flex-col gap-1 shadow-xs justify-center flex-1">
                    <span className="text-[9px] uppercase font-bold text-neige/55">Bénéfice Net Calculé</span>
                    <span className="text-xl font-black text-neige tabular-nums">{formatFCFA(beneficeNet)}</span>
                    <span className="text-[9px] text-neige/50 font-semibold">Marge nette : {margeNette.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-3 bg-neige/30 rounded-xl border border-graphite/5">
                  <span className="text-[10px] uppercase font-bold text-encre/60 px-1 border-b border-graphite/5 pb-1">Dépenses du Jour</span>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-encre/60">Publicités (Ads)</span>
                      <input 
                        type="number"
                        value={depenses.pub}
                        onChange={(e) => setDepenses(prev => ({ ...prev, pub: parseInt(e.target.value) || 0 }))}
                        className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-encre/60">Achat de stock</span>
                      <input 
                        type="number"
                        value={depenses.stock}
                        onChange={(e) => setDepenses(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                        className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-encre/60">Logistique / Livreur</span>
                      <input 
                        type="number"
                        value={depenses.livraison}
                        onChange={(e) => setDepenses(prev => ({ ...prev, livraison: parseInt(e.target.value) || 0 }))}
                        className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-encre/60">Salaires / Commissions</span>
                      <input 
                        type="number"
                        value={depenses.salaires}
                        onChange={(e) => setDepenses(prev => ({ ...prev, salaires: parseInt(e.target.value) || 0 }))}
                        className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold text-encre/60">Autres dépenses</span>
                      <input 
                        type="number"
                        value={depenses.autres}
                        onChange={(e) => setDepenses(prev => ({ ...prev, autres: parseInt(e.target.value) || 0 }))}
                        className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-graphite/5 pt-1.5 text-[9px] font-black text-encre/60 px-1 mt-0.5">
                      <span>TOTAL DÉPENSES</span>
                      <span className="tabular-nums">{formatFCFA(totalDepenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress target bar */}
              {objectifCa > 0 && (
                <div className="flex flex-col gap-1 border-t border-graphite/5 pt-3">
                  <div className="flex items-center justify-between text-[9px] text-encre/40 font-bold">
                    <span>Progression Objectif CA</span>
                    <span>{caRealise}F / {objectifCa}F ({(caRealise / objectifCa * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-neige rounded-full overflow-hidden border border-graphite/5">
                    <div 
                      className="h-full bg-menthe transition-all duration-500" 
                      style={{ width: `${Math.min(caRealise / objectifCa * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="magnetic-btn w-full bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-xs transition-all mt-1"
              >
                {saving ? "Enregistrement..." : "Enregistrer le Bilan journalier"}
              </button>
            </form>

            {/* Bloc 3: Répartition du bénéfice */}
            <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-3">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                <Sliders className="w-4.5 h-4.5 text-menthe" /> Répartition indicative du bénéfice net
              </span>

              {beneficeNet <= 0 ? (
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100/50 text-center text-[10px] text-amber-700 font-semibold">
                  Le bénéfice net du jour est nul ou négatif. Aucune somme n&apos;est à distribuer.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                    <span className="text-[8px] uppercase font-bold text-encre/40">Réserve ({settings.repartition?.reserve_entreprise ?? 10}%)</span>
                    <span className="text-xs font-black text-encre tabular-nums">{formatFCFA(beneficeNet * (settings.repartition?.reserve_entreprise ?? 10) / 100)}</span>
                  </div>
                  <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                    <span className="text-[8px] uppercase font-bold text-encre/40">Part Perso ({settings.repartition?.part_perso ?? 40}%)</span>
                    <span className="text-xs font-black text-encre tabular-nums">{formatFCFA(beneficeNet * (settings.repartition?.part_perso ?? 40) / 100)}</span>
                  </div>
                  <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                    <span className="text-[8px] uppercase font-bold text-encre/40">Réinvestissement ({settings.repartition?.reinvestissement ?? 40}%)</span>
                    <span className="text-xs font-black text-encre tabular-nums">{formatFCFA(beneficeNet * (settings.repartition?.reinvestissement ?? 40) / 100)}</span>
                  </div>
                  <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                    <span className="text-[8px] uppercase font-bold text-encre/40">Tampon ({settings.repartition?.tampon ?? 10}%)</span>
                    <span className="text-xs font-black text-encre tabular-nums">{formatFCFA(beneficeNet * (settings.repartition?.tampon ?? 10) / 100)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bloc 6: Historique chart */}
            <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-3">
              <span className="text-xs font-black uppercase text-encre/70">Historique des Bénéfices (30 Derniers Jours)</span>
              <div className="h-56 w-full">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-encre/40 italic">Aucune donnée historique.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={9} tickLine={false} />
                      <YAxis stroke="#9CA3AF" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1C1C1E", borderRadius: "1rem", border: "none", color: "#FAFAFA", fontSize: "10px" }}
                        formatter={(val: number) => [formatFCFA(val), ""]}
                      />
                      <Line type="monotone" dataKey="benefice" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="objectif" stroke="#D97706" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Right panel: IA commentary */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* IA Directeur financier card */}
            <div className="p-5 bg-encre text-neige rounded-2xl border border-graphite shadow-md flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-graphite-light pb-3">
                <span className="text-xs font-black uppercase text-neige/90 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-menthe" /> Rapport IA Directeur Financier
                </span>
                <button
                  onClick={handleGenerateIaComment}
                  disabled={generatingIa || !entry}
                  className="p-1.5 bg-graphite-light hover:bg-menthe text-neige/70 hover:text-neige rounded-xl transition-colors disabled:opacity-40 disabled:hover:bg-graphite-light"
                  title="Régénérer le commentaire IA"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingIa ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex flex-col gap-3 min-h-[150px]">
                {generatingIa ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-neige/55">
                    <RefreshCw className="w-5 h-5 animate-spin text-menthe" />
                    <span className="text-[10px] font-bold">Analyse des chiffres en cours...</span>
                  </div>
                ) : entry?.commentaire_ia ? (
                  <p className="text-[11px] leading-relaxed font-medium text-neige/85 whitespace-pre-line italic">
                    « {entry.commentaire_ia} »
                  </p>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center text-neige/50">
                    <span className="text-[10px] italic">Aucun commentaire généré pour cette date.</span>
                    {entry ? (
                      <button
                        onClick={handleGenerateIaComment}
                        className="bg-menthe text-neige text-[10px] font-bold px-4 py-2 rounded-xl"
                      >
                        Générer le rapport du soir
                      </button>
                    ) : (
                      <span className="text-[9px] text-neige/45 max-w-[200px]">Enregistrez le bilan de la journée à gauche d&apos;abord pour permettre à l&apos;IA d&apos;analyser les chiffres.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[8px] text-neige/40 font-bold border-t border-graphite-light pt-3 uppercase tracking-wider text-center">
                Analyse Générée par IA · Directeur Financier Virtuel
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
