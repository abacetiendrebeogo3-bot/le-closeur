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
  DollarSign,
  Plus,
  Trash2,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  UserPlus,
  Briefcase,
  CreditCard,
  HandCoins
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
import { Order, Product, Employee, Debt } from "../../types";

interface PilotageViewProps {
  businessId: string;
  orders: Order[];
  formatFCFA: (val: number) => string;
  products: Product[];
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
  formatFCFA,
  products
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
  const [generatingAdsIa, setGeneratingAdsIa] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  // Caisse Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"bilan" | "caisse" | "employees" | "debts">("bilan");

  // Employees states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empSalary, setEmpSalary] = useState(0);
  const [empPayDay, setEmpPayDay] = useState(1);
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  // Debts states
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtLabel, setDebtLabel] = useState("");
  const [debtAmount, setDebtAmount] = useState(0);
  const [debtDueDate, setDebtDueDate] = useState("");
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);

  // Caisse States
  const [caisseSolde, setCaisseSolde] = useState<number>(0);
  const [caisseTransactions, setCaisseTransactions] = useState<any[]>([]);
  const [caisseObjectifs, setCaisseObjectifs] = useState<any[]>([]);
  const [caisseLoading, setCaisseLoading] = useState<boolean>(false);

  // Quick form for transaction
  const [txType, setTxType] = useState<"entree" | "sortie">("entree");
  const [txMontant, setTxMontant] = useState<number>(0);
  const [txCategorie, setTxCategorie] = useState<string>("vente");
  const [txDescription, setTxDescription] = useState<string>("");

  // Form for objective
  const [objTargetDate, setObjTargetDate] = useState<string>("");
  const [objMontantCible, setObjMontantCible] = useState<number>(0);
  const [objLabel, setObjLabel] = useState<string>("");
  const [showAddObj, setShowAddObj] = useState<boolean>(false);

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
        setDepenses({ pub: 0, stock: 0, livraison: 0, salaires: 0, autres: 0 });
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

  const loadCaisseData = useCallback(async () => {
    if (!businessId) return;
    setCaisseLoading(true);
    try {
      // 1. Fetch transactions
      const { data: txs, error: txsErr } = await supabase
        .from("caisse_transactions")
        .select("*")
        .eq("business_id", businessId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (txsErr) throw txsErr;

      // 2. Fetch objectives
      const { data: objs, error: objsErr } = await supabase
        .from("caisse_objectifs")
        .select("*")
        .eq("business_id", businessId)
        .order("target_date", { ascending: true });

      if (objsErr) throw objsErr;

      // 3. Compute current cash balance
      const balance = (txs || []).reduce((acc, t) => {
        const amt = Number(t.montant) || 0;
        return acc + (t.type === "entree" ? amt : -amt);
      }, 0);

      setCaisseSolde(balance);
      setCaisseTransactions(txs || []);
      setCaisseObjectifs(objs || []);
    } catch (err: any) {
      console.error("Error loading caisse data:", err);
      triggerToast(`Erreur chargement caisse : ${err.message}`, "warning");
    } finally {
      setCaisseLoading(false);
    }
  }, [businessId, triggerToast]);

  useEffect(() => {
    if (businessId && activeSubTab === "caisse") {
      loadCaisseData();
    }
  }, [businessId, activeSubTab, loadCaisseData]);

  // Load Employees
  const loadEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("business_id", businessId)
        .order("name", { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error("Error loading employees:", err);
    }
  }, [businessId]);

  // Save Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empRole.trim()) return;
    try {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          business_id: businessId,
          name: empName.trim(),
          role: empRole.trim(),
          monthly_salary: empSalary,
          pay_day: empPayDay
        })
        .select()
        .single();
      if (error) throw error;
      setEmployees(prev => [...prev, data]);
      setShowAddEmployee(false);
      setEmpName("");
      setEmpRole("");
      setEmpSalary(0);
      setEmpPayDay(1);
      triggerToast("Employé ajouté avec succès !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (id: string) => {
    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      setEmployees(prev => prev.filter(e => e.id !== id));
      triggerToast("Employé retiré.", "info");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Pay Salary
  const handlePaySalary = async (employee: any) => {
    try {
      const { error: txErr } = await supabase
        .from("caisse_transactions")
        .insert({
          business_id: businessId,
          date: new Date().toISOString().split("T")[0],
          type: "sortie",
          montant: employee.monthly_salary,
          categorie: "salaire",
          description: `Salaire mensuel payé à ${employee.name} (${employee.role})`
        });
      if (txErr) throw txErr;

      loadCaisseData();
      triggerToast(`Salaire de ${formatFCFA(employee.monthly_salary)} payé à ${employee.name} !`, "success");
    } catch (err: any) {
      triggerToast(`Erreur paiement : ${err.message}`, "warning");
    }
  };

  // Load Debts
  const loadDebts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("business_id", businessId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      setDebts(data || []);
    } catch (err: any) {
      console.error("Error loading debts:", err);
    }
  }, [businessId]);

  // Save Debt
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtLabel.trim() || !debtDueDate) return;
    try {
      const { data, error } = await supabase
        .from("debts")
        .insert({
          business_id: businessId,
          label: debtLabel.trim(),
          amount: debtAmount,
          due_date: debtDueDate,
          paid_amount: 0
        })
        .select()
        .single();
      if (error) throw error;
      setDebts(prev => [...prev, data]);
      setShowAddDebt(false);
      setDebtLabel("");
      setDebtAmount(0);
      setDebtDueDate("");
      triggerToast("Dette enregistrée avec succès !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete Debt
  const handleDeleteDebt = async (id: string) => {
    try {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
      setDebts(prev => prev.filter(d => d.id !== id));
      triggerToast("Dette supprimée.", "info");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Reimburse Debt
  const handleReimburseDebt = async (debt: any, refundVal: number) => {
    if (refundVal <= 0) return;
    const newPaidAmount = Number(debt.paid_amount || 0) + refundVal;
    if (newPaidAmount > debt.amount) {
      triggerToast("Le montant du remboursement dépasse le montant total de la dette.", "warning");
      return;
    }
    try {
      const { error: debtErr } = await supabase
        .from("debts")
        .update({ paid_amount: newPaidAmount })
        .eq("id", debt.id);
      if (debtErr) throw debtErr;

      const { error: txErr } = await supabase
        .from("caisse_transactions")
        .insert({
          business_id: businessId,
          date: new Date().toISOString().split("T")[0],
          type: "sortie",
          montant: refundVal,
          categorie: "facture",
          description: `Remboursement de dette : ${debt.label} (${formatFCFA(refundVal)})`
        });
      if (txErr) throw txErr;

      loadDebts();
      loadCaisseData();
      setSelectedDebtId(null);
      setRefundAmount(0);
      triggerToast(`Remboursement de ${formatFCFA(refundVal)} enregistré !`, "success");
    } catch (err: any) {
      triggerToast(`Erreur remboursement : ${err.message}`, "warning");
    }
  };

  useEffect(() => {
    if (businessId) {
      if (activeSubTab === "employees") {
        loadEmployees();
      } else if (activeSubTab === "debts") {
        loadDebts();
      }
    }
  }, [businessId, activeSubTab, loadEmployees, loadDebts]);

  // Compute automatic Stock cost (COGS)
  const autoStockCost = useCallback(() => {
    const dailyPaidOrders = orders.filter(
      (o) => o.date === selectedDate && o.paymentStatus === "paid"
    );
    return dailyPaidOrders.reduce((sum, o) => {
      const itemsCost = o.items.reduce((itemSum, item) => {
        const prod = products.find(p => p.name === item.product);
        const buyingPrice = prod?.buying_price ?? 0;
        return itemSum + (buyingPrice * item.quantity);
      }, 0);
      return sum + itemsCost;
    }, 0);
  }, [orders, selectedDate, products]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (txMontant <= 0) {
      triggerToast("Le montant doit être supérieur à 0.", "warning");
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        date: selectedDate,
        type: txType,
        montant: txMontant,
        categorie: txCategorie,
        description: txDescription
      };

      const { error } = await supabase
        .from("caisse_transactions")
        .insert(payload);

      if (error) throw error;

      triggerToast("Transaction ajoutée avec succès !", "success");
      setTxMontant(0);
      setTxDescription("");
      loadCaisseData();
    } catch (err: any) {
      triggerToast(`Erreur transaction : ${err.message}`, "warning");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("caisse_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      triggerToast("Transaction supprimée.", "info");
      loadCaisseData();
    } catch (err: any) {
      triggerToast(`Erreur suppression : ${err.message}`, "warning");
    }
  };

  const handleAddObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (objMontantCible <= 0 || !objTargetDate || !objLabel) {
      triggerToast("Veuillez remplir tous les champs de l'objectif.", "warning");
      return;
    }

    try {
      const payload = {
        business_id: businessId,
        target_date: objTargetDate,
        montant_cible: objMontantCible,
        label: objLabel
      };

      const { error } = await supabase
        .from("caisse_objectifs")
        .insert(payload);

      if (error) throw error;

      triggerToast("Nouvel objectif de caisse défini !", "success");
      setObjLabel("");
      setObjMontantCible(0);
      setObjTargetDate("");
      setShowAddObj(false);
      loadCaisseData();
    } catch (err: any) {
      triggerToast(`Erreur objectif : ${err.message}`, "warning");
    }
  };

  const handleDeleteObjective = async (id: string) => {
    try {
      const { error } = await supabase
        .from("caisse_objectifs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      triggerToast("Objectif supprimé.", "info");
      loadCaisseData();
    } catch (err: any) {
      triggerToast(`Erreur suppression : ${err.message}`, "warning");
    }
  };

  const getDaysRemaining = (targetDateStr: string) => {
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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

  // Trigger Meta Ads IA Critique Generation
  const handleGenerateAdsComment = async () => {
    setGeneratingAdsIa(true);
    try {
      const res = await fetch("/api/meta-ads/generate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, date: selectedDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");

      triggerToast("Rapport publicitaire généré !", "success");
      loadDailyEntry();
    } catch (err: any) {
      triggerToast(`Erreur IA Ads : ${err.message}`, "warning");
    } finally {
      setGeneratingAdsIa(false);
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

      {/* Sub-tabs Selector */}
      <div className="flex gap-4 border-b border-graphite/10 pb-1 mt-2">
        <button
          onClick={() => setActiveSubTab("bilan")}
          className={`pb-2 px-1 text-xs font-black uppercase transition-all border-b-2 ${
            activeSubTab === "bilan" 
              ? "border-menthe text-menthe" 
              : "border-transparent text-encre/40 hover:text-encre/70"
          }`}
        >
          Bilan Journalier & Analyses
        </button>
        <button
          onClick={() => setActiveSubTab("caisse")}
          className={`pb-2 px-1 text-xs font-black uppercase transition-all border-b-2 ${
            activeSubTab === "caisse" 
              ? "border-menthe text-menthe" 
              : "border-transparent text-encre/40 hover:text-encre/70"
          }`}
        >
          Gestion de Caisse
        </button>
        <button
          onClick={() => setActiveSubTab("employees")}
          className={`pb-2 px-1 text-xs font-black uppercase transition-all border-b-2 ${
            activeSubTab === "employees" 
              ? "border-menthe text-menthe" 
              : "border-transparent text-encre/40 hover:text-encre/70"
          }`}
        >
          Employés
        </button>
        <button
          onClick={() => setActiveSubTab("debts")}
          className={`pb-2 px-1 text-xs font-black uppercase transition-all border-b-2 ${
            activeSubTab === "debts" 
              ? "border-menthe text-menthe" 
              : "border-transparent text-encre/40 hover:text-encre/70"
          }`}
        >
          Dettes & Échéances
        </button>
      </div>

      {activeSubTab === "bilan" && (
        loading ? (
          <div className="text-center text-xs py-8 text-encre/40 font-bold">Chargement du bilan journalier...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left panel: form & calculations */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Form sheet */}
              <form onSubmit={handleSaveEntry} className="p-6 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
                <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                  <Coins className="w-4.5 h-4.5 text-menthe" /> Bilan journalier (`${selectedDate}`)
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
                          Réinitialiser (`${formatFCFA(calculateAutoCa())}`)
                        </button>
                      </div>
                    </div>

                    {/* Profit summary card */}
                    <div className="p-4 bg-encre text-neige rounded-xl flex flex-col gap-1 shadow-xs justify-center flex-1">
                      <span className="text-[9px] uppercase font-bold text-neige/55">Bénéfice Net Calculé</span>
                      <span className="text-xl font-black text-neige tabular-nums font-mono">`${formatFCFA(beneficeNet)}`</span>
                      <span className="text-[9px] text-neige/50 font-semibold">Marge nette : `${margeNette.toFixed(1)}` %</span>
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
                       <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-encre/60">Achat de stock</span>
                          <input 
                            type="number"
                            value={depenses.stock}
                            onChange={(e) => setDepenses(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                            className="w-28 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-xs text-right font-semibold text-encre"
                          />
                        </div>
                        <div className="text-right text-[8px]">
                          <button 
                            type="button" 
                            onClick={() => {
                              const cost = autoStockCost();
                              setDepenses(prev => ({ ...prev, stock: cost }));
                              triggerToast("Coût d'achat de stock mis à jour.", "info");
                            }}
                            className="text-menthe hover:underline font-semibold"
                          >
                            Calculer coût réel ({formatFCFA(autoStockCost())})
                          </button>
                        </div>
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
                        <span className="tabular-nums font-mono">`${formatFCFA(totalDepenses)}`</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress target bar */}
                {objectifCa > 0 && (
                  <div className="flex flex-col gap-1 border-t border-graphite/5 pt-3">
                    <div className="flex items-center justify-between text-[9px] text-encre/40 font-bold">
                      <span>Progression Objectif CA</span>
                      <span>`${caRealise}`F / `${objectifCa}`F (`${(caRealise / objectifCa * 100).toFixed(0)}`%)</span>
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
                      <span className="text-[8px] uppercase font-bold text-encre/40">Réserve (`${settings.repartition?.reserve_entreprise ?? 10}`%)</span>
                      <span className="text-xs font-black text-encre tabular-nums font-mono">`${formatFCFA(beneficeNet * (settings.repartition?.reserve_entreprise ?? 10) / 100)}`</span>
                    </div>
                    <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                      <span className="text-[8px] uppercase font-bold text-encre/40">Part Perso (`${settings.repartition?.part_perso ?? 40}`%)</span>
                      <span className="text-xs font-black text-encre tabular-nums font-mono">`${formatFCFA(beneficeNet * (settings.repartition?.part_perso ?? 40) / 100)}`</span>
                    </div>
                    <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                      <span className="text-[8px] uppercase font-bold text-encre/40">Réinvestissement (`${settings.repartition?.reinvestissement ?? 40}`%)</span>
                      <span className="text-xs font-black text-encre tabular-nums font-mono">`${formatFCFA(beneficeNet * (settings.repartition?.reinvestissement ?? 40) / 100)}`</span>
                    </div>
                    <div className="p-3 bg-neige rounded-xl flex flex-col gap-0.5 border border-graphite/5">
                      <span className="text-[8px] uppercase font-bold text-encre/40">Tampon (`${settings.repartition?.tampon ?? 10}`%)</span>
                      <span className="text-xs font-black text-encre tabular-nums font-mono">`${formatFCFA(beneficeNet * (settings.repartition?.tampon ?? 10) / 100)}`</span>
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

              {/* IA Meta Ads Critique card */}
              <div className="p-5 bg-encre text-neige rounded-2xl border border-graphite shadow-md flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-graphite-light pb-3">
                  <span className="text-xs font-black uppercase text-neige/90 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-menthe" /> Critique Pubs IA (Meta Ads)
                  </span>
                  <button
                    onClick={handleGenerateAdsComment}
                    disabled={generatingAdsIa || !entry}
                    className="p-1.5 bg-graphite-light hover:bg-menthe text-neige/70 hover:text-neige rounded-xl transition-colors disabled:opacity-40 disabled:hover:bg-graphite-light"
                    title="Régénérer la critique Ads IA"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingAdsIa ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 min-h-[150px]">
                  {generatingAdsIa ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-neige/55">
                      <RefreshCw className="w-5 h-5 animate-spin text-menthe" />
                      <span className="text-[10px] font-bold">Critique des campagnes en cours...</span>
                    </div>
                  ) : entry?.commentaire_ads_ia ? (
                    <p className="text-[11px] leading-relaxed font-medium text-neige/85 whitespace-pre-line italic">
                      « {entry.commentaire_ads_ia} »
                    </p>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center text-neige/50">
                      <span className="text-[10px] italic">Aucune critique générée pour cette date.</span>
                      {entry ? (
                        <button
                          onClick={handleGenerateAdsComment}
                          className="bg-menthe text-neige text-[10px] font-bold px-4 py-2 rounded-xl"
                        >
                          Générer la critique Ads
                        </button>
                      ) : (
                        <span className="text-[9px] text-neige/45 max-w-[200px]">Enregistrez le bilan de la journée à gauche d&apos;abord pour permettre à l&apos;IA de critiquer les pubs.</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[8px] text-neige/40 font-bold border-t border-graphite-light pt-3 uppercase tracking-wider text-center">
                  Analyse Générée par IA · Contrôleur Publicitaire Virtuel
                </div>
              </div>

            </div>

          </div>
        )
      )}

      {activeSubTab === "caisse" && (
        caisseLoading ? (
          <div className="text-center text-xs py-8 text-encre/40 font-bold">Chargement de la caisse...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Panel: Solde and Quick Add / Recent Tx */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Solde Card */}
              <div className="p-6 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-menthe/10 rounded-2xl border border-menthe/10 text-menthe shadow-sm">
                    <PiggyBank className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-encre/40 tracking-wider">Solde Actuel Disponible</span>
                    <span className={`text-2xl sm:text-3xl font-black ${caisseSolde >= 0 ? 'text-menthe' : 'text-red-500'}`}>
                      {formatFCFA(caisseSolde)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 border-t sm:border-t-0 sm:border-l border-graphite/5 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-around sm:justify-start">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-bold text-encre/40 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-menthe" /> Total Entrées</span>
                    <span className="text-sm font-black text-encre">
                      {formatFCFA(caisseTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + Number(t.montant), 0))}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-bold text-encre/40 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> Total Sorties</span>
                    <span className="text-sm font-black text-encre">
                      {formatFCFA(caisseTransactions.filter(t => t.type === 'sortie').reduce((sum, t) => sum + Number(t.montant), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form card */}
              <form onSubmit={handleAddTransaction} className="p-6 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
                <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-menthe" /> Ajouter une transaction de caisse
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-encre/45">Type de transaction</label>
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value as "entree" | "sortie")}
                      className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe cursor-pointer"
                    >
                      <option value="entree">Entrée (+)</option>
                      <option value="sortie">Sortie (-)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-encre/45">Montant (FCFA)</label>
                    <input
                      type="number"
                      min={0}
                      value={txMontant || ""}
                      onChange={(e) => setTxMontant(parseInt(e.target.value) || 0)}
                      placeholder="Ex: 25000"
                      className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-encre/45">Catégorie</label>
                    <select
                      value={txCategorie}
                      onChange={(e) => setTxCategorie(e.target.value)}
                      className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe cursor-pointer"
                    >
                      <option value="vente">Vente</option>
                      <option value="salaire">Salaire</option>
                      <option value="facture">Facture</option>
                      <option value="achat_stock">Achat Stock</option>
                      <option value="transport">Transport</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/45">Description libre (facultatif)</label>
                  <input
                    type="text"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="Ex: Achat d'emballages carton..."
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2.5 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-encre hover:bg-graphite text-white hover:scale-[1.01] font-black text-xs py-3 rounded-2xl transition-all shadow-sm mt-1"
                >
                  Enregistrer la Transaction
                </button>
              </form>

              {/* Transactions List */}
              <div className="p-6 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
                <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                  <Coins className="w-4.5 h-4.5 text-menthe" /> Historique récent de caisse
                </span>

                <div className="overflow-x-auto w-full">
                  {caisseTransactions.length === 0 ? (
                    <div className="text-center text-xs py-8 text-encre/40 italic">Aucune transaction de caisse pour le moment.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-graphite/5 text-[9px] text-encre/40 uppercase tracking-widest font-black">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Catégorie</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Montant</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caisseTransactions.slice(0, 15).map((t) => (
                          <tr key={t.id} className="border-b border-graphite/5 text-xs hover:bg-neige/30 transition-colors font-medium">
                            <td className="py-3 px-3 font-mono font-bold text-encre/60">{t.date}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                t.type === 'entree' ? 'bg-menthe/10 text-menthe' : 'bg-red-50 text-red-500'
                              }`}>
                                {t.type === 'entree' ? 'Entrée' : 'Sortie'}
                              </span>
                            </td>
                            <td className="py-3 px-3 capitalize font-bold text-encre">{t.categorie}</td>
                            <td className="py-3 px-3 text-encre/60 max-w-[200px] truncate">{t.description || "-"}</td>
                            <td className={`py-3 px-3 text-right font-black ${
                              t.type === 'entree' ? 'text-menthe' : 'text-red-500'
                            }`}>
                              {t.type === 'entree' ? '+' : '-'}{formatFCFA(Number(t.montant))}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors inline-block"
                                title="Supprimer la transaction"
                                type="button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* Right Panel: Objectives */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Objectives lists */}
              <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-graphite/5 pb-3">
                  <span className="text-xs font-black uppercase text-encre/80 flex items-center gap-1.5">
                    <Target className="w-4.5 h-4.5 text-menthe" /> Objectifs de Caisse
                  </span>
                  <button
                    onClick={() => setShowAddObj(!showAddObj)}
                    className="p-1 hover:bg-neige rounded-xl border border-graphite/5 text-menthe transition-colors"
                    title="Définir un nouvel objectif"
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {showAddObj && (
                  <form onSubmit={handleAddObjective} className="p-3 bg-neige/40 border border-graphite/5 rounded-xl flex flex-col gap-3">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[8px] uppercase font-bold text-encre/45">Label de l&apos;objectif</label>
                      <input
                        type="text"
                        value={objLabel}
                        onChange={(e) => setObjLabel(e.target.value)}
                        placeholder="Ex: Objectif 1 semaine"
                        className="bg-white border border-graphite/10 rounded-lg px-2.5 py-1 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[8px] uppercase font-bold text-encre/45">Montant Cible (FCFA)</label>
                      <input
                        type="number"
                        min={1}
                        value={objMontantCible || ""}
                        onChange={(e) => setObjMontantCible(parseInt(e.target.value) || 0)}
                        placeholder="Ex: 1000000"
                        className="bg-white border border-graphite/10 rounded-lg px-2.5 py-1 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[8px] uppercase font-bold text-encre/45">Date cible</label>
                      <input
                        type="date"
                        value={objTargetDate}
                        onChange={(e) => setObjTargetDate(e.target.value)}
                        className="bg-white border border-graphite/10 rounded-lg px-2.5 py-1 text-xs font-bold text-encre focus:outline-none focus:border-menthe cursor-pointer"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <button type="button" onClick={() => setShowAddObj(false)} className="text-[9px] font-bold text-encre/50 px-2 py-1 hover:underline">Annuler</button>
                      <button type="submit" className="bg-menthe text-white text-[9px] font-black px-3 py-1 rounded-lg">Définir</button>
                    </div>
                  </form>
                )}

                <div className="flex flex-col gap-4">
                  {caisseObjectifs.length === 0 ? (
                    <div className="text-center text-xs py-8 text-encre/40 italic">Aucun objectif défini.</div>
                  ) : (
                    caisseObjectifs.map((obj) => {
                      const daysLeft = getDaysRemaining(obj.target_date);
                      const target = Number(obj.montant_cible) || 1;
                      const progressPct = Math.min(100, Math.max(0, (caisseSolde / target) * 100));

                      return (
                        <div key={obj.id} className="p-4 bg-neige/30 border border-graphite/5 rounded-xl flex flex-col gap-2 relative group hover:border-graphite/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-encre">{obj.label}</span>
                            <button
                              onClick={() => handleDeleteObjective(obj.id)}
                              className="text-red-400 hover:text-red-600 p-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Supprimer l'objectif"
                              type="button"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex justify-between items-baseline text-[10px] font-black text-encre/55">
                            <span>{formatFCFA(caisseSolde)} / {formatFCFA(target)}</span>
                            <span>{progressPct.toFixed(0)}%</span>
                          </div>

                          <div className="w-full bg-graphite/10 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-menthe h-full rounded-full transition-all duration-500" 
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[8px] text-encre/40 font-bold uppercase">
                            <span>Cible : {obj.target_date}</span>
                            <span className={daysLeft < 0 ? 'text-red-500' : daysLeft <= 2 ? 'text-amber-500' : 'text-menthe'}>
                              {daysLeft < 0 ? 'Échu' : daysLeft === 0 ? "Aujourd'hui" : `${daysLeft}j restant${daysLeft > 1 ? 's' : ''}`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        )
      )}

      {/* EMPLOYEES SUBTAB */}
      {activeSubTab === "employees" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-menthe" /> Gestion du Personnel
              </span>
              <span className="text-[10px] text-encre/40 font-semibold">Gérez les fiches des employés, les salaires et enregistrez les paiements en Caisse.</span>
            </div>
            <button
              onClick={() => setShowAddEmployee(!showAddEmployee)}
              className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
              type="button"
            >
              <UserPlus className="w-4 h-4" />
              <span>Recruter / Ajouter</span>
            </button>
          </div>

          {/* Add Employee Form */}
          {showAddEmployee && (
            <form onSubmit={handleSaveEmployee} className="p-6 bg-white rounded-2xl border border-graphite/15 shadow-sm flex flex-col gap-4 max-w-xl animate-fade-in">
              <span className="text-xs font-extrabold text-encre">Nouvel Employé</span>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Nom Complet *</label>
                  <input
                    type="text"
                    required
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Ex: Fatou Diop"
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Poste / Rôle *</label>
                  <input
                    type="text"
                    required
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    placeholder="Ex: Commerciale, Livreur..."
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Salaire Mensuel (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={empSalary || ""}
                    onChange={(e) => setEmpSalary(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 150000"
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe text-right"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Jour de Paie (1-31) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={31}
                    value={empPayDay}
                    onChange={(e) => setEmpPayDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe text-right"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-graphite/5 pt-3 mt-1">
                <button type="button" onClick={() => setShowAddEmployee(false)} className="px-3.5 py-2 bg-neige border border-graphite/10 rounded-xl text-xs font-bold text-encre">Annuler</button>
                <button type="submit" className="px-4.5 py-2 bg-menthe text-white rounded-xl text-xs font-black">Ajouter l&apos;employé</button>
              </div>
            </form>
          )}

          {/* Employees List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.length === 0 ? (
              <div className="bg-white p-8 rounded-[2rem] border border-graphite/10 shadow-sm text-center text-xs text-encre/40 italic col-span-full">
                Aucun employé enregistré.
              </div>
            ) : (
              employees.map(emp => {
                const today = new Date();
                const currentDay = today.getDate();
                const isPaydaySoon = Math.abs(emp.pay_day - currentDay) <= 3 || currentDay >= emp.pay_day;

                return (
                  <div key={emp.id} className="p-6 bg-white rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4 relative group hover:border-graphite/20 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-encre">{emp.name}</span>
                        <span className="text-[10px] text-encre/45 font-semibold capitalize">{emp.role}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Licencier / Supprimer"
                        type="button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-neige/50 p-3 rounded-xl border border-graphite/5 text-xs">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-encre/40 block">Salaire Mensuel</span>
                        <span className="font-extrabold text-encre">{formatFCFA(emp.monthly_salary)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] uppercase font-bold text-encre/40 block">Jour de paie</span>
                        <span className="font-extrabold text-encre">{emp.pay_day} de chaque mois</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      {isPaydaySoon ? (
                        <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-600 border-amber-200 animate-pulse">
                          Jour de paie proche
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-neige text-encre/40 border-graphite/5">
                          En attente
                        </span>
                      )}
                      
                      <button
                        onClick={() => handlePaySalary(emp)}
                        className="bg-menthe text-white text-[10px] font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:brightness-105 active:scale-95 transition-all"
                        type="button"
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                        <span>Payer salaire</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DEBTS SUBTAB */}
      {activeSubTab === "debts" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-menthe" /> Suivi des Dettes & Échéances
              </span>
              <span className="text-[10px] text-encre/40 font-semibold">Suivez vos dettes fournisseurs ou créances, configurez des alertes d&apos;échéance et remboursez en caisse.</span>
            </div>
            <button
              onClick={() => setShowAddDebt(!showAddDebt)}
              className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
              type="button"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer une dette</span>
            </button>
          </div>

          {/* Add Debt Form */}
          {showAddDebt && (
            <form onSubmit={handleSaveDebt} className="p-6 bg-white rounded-2xl border border-graphite/15 shadow-sm flex flex-col gap-4 max-w-xl animate-fade-in">
              <span className="text-xs font-extrabold text-encre">Nouvel Engagement Financier</span>
              
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-encre/50">Libellé / Objet de la dette *</label>
                <input
                  type="text"
                  required
                  value={debtLabel}
                  onChange={(e) => setDebtLabel(e.target.value)}
                  placeholder="Ex: Facture fournisseur tissu, Achat matériel..."
                  className="bg-neige border border-graphite/10 rounded-xl px-3.5 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Montant total (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={debtAmount || ""}
                    onChange={(e) => setDebtAmount(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 500000"
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-bold text-encre focus:outline-none focus:border-menthe text-right"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/50">Date d&apos;Échéance *</label>
                  <input
                    type="date"
                    required
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="bg-neige border border-graphite/10 rounded-xl px-3 py-1.5 text-xs font-bold text-encre focus:outline-none focus:border-menthe cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-graphite/5 pt-3 mt-1">
                <button type="button" onClick={() => setShowAddDebt(false)} className="px-3.5 py-2 bg-neige border border-graphite/10 rounded-xl text-xs font-bold text-encre">Annuler</button>
                <button type="submit" className="px-4.5 py-2 bg-menthe text-white rounded-xl text-xs font-black">Ajouter la dette</button>
              </div>
            </form>
          )}

          {/* Debts List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {debts.length === 0 ? (
              <div className="bg-white p-8 rounded-[2rem] border border-graphite/10 shadow-sm text-center text-xs text-encre/40 italic col-span-full">
                Aucune dette en cours.
              </div>
            ) : (
              debts.map(debt => {
                const total = Number(debt.amount) || 0;
                const paid = Number(debt.paid_amount) || 0;
                const remaining = total - paid;
                const pctProgress = Math.min(100, (paid / total) * 100);
                
                const dueDateObj = new Date(debt.due_date);
                const diffTime = dueDateObj.getTime() - Date.now();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0 && remaining > 0;
                const isSoon = diffDays >= 0 && diffDays <= 5 && remaining > 0;

                return (
                  <div key={debt.id} className="p-6 bg-white rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4 relative group hover:border-graphite/20 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-encre">{debt.label}</span>
                        <span className="text-[9px] text-encre/40 font-mono font-bold mt-0.5">Échéance : {debt.due_date}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteDebt(debt.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer"
                        type="button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[10px] font-black text-encre/60">
                        <span>Remboursé : {formatFCFA(paid)} / {formatFCFA(total)}</span>
                        <span>{pctProgress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-graphite/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-menthe h-full rounded-full transition-all" style={{ width: `${pctProgress}%` }} />
                      </div>
                    </div>

                    {selectedDebtId === debt.id ? (
                      <div className="flex flex-col gap-2 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                        <label className="text-[9px] uppercase font-bold text-encre/50">Montant du Remboursement (FCFA)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            max={remaining}
                            value={refundAmount || ""}
                            onChange={(e) => setRefundAmount(parseInt(e.target.value) || 0)}
                            placeholder="Ex: 50000"
                            className="flex-1 bg-white border border-graphite/10 rounded-lg px-2.5 py-1.5 text-xs text-right font-bold text-encre"
                          />
                          <button
                            onClick={() => handleReimburseDebt(debt, refundAmount)}
                            className="bg-menthe text-white text-[10px] font-black px-3.5 py-1.5 rounded-lg"
                            type="button"
                          >
                            Valider
                          </button>
                        </div>
                        <button onClick={() => setSelectedDebtId(null)} className="text-center text-[9px] text-encre/40 hover:underline font-bold" type="button">Annuler</button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center mt-1">
                        <div>
                          {remaining === 0 ? (
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-menthe/10 text-menthe border-menthe/20">
                              Remboursé
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-red-50 text-red-600 border-red-200 animate-pulse">
                              Échu ({Math.abs(diffDays)}j de retard)
                            </span>
                          ) : isSoon ? (
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-600 border-amber-200">
                              Échéance dans {diffDays}j
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-semibold border bg-neige text-encre/40 border-graphite/5">
                              {diffDays} jours restants
                            </span>
                          )}
                        </div>

                        {remaining > 0 && (
                          <button
                            onClick={() => {
                              setSelectedDebtId(debt.id);
                              setRefundAmount(remaining);
                            }}
                            className="bg-encre text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl hover:bg-graphite transition-colors shadow-xs"
                            type="button"
                          >
                            Rembourser
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
