"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase/client";
import { 
  BookOpen, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Sparkles, 
  PlusCircle, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Target,
  Coins,
  TrendingUp
} from "lucide-react";
import { Product } from "../../types";

interface JournalViewProps {
  businessId: string;
  products: Product[];
  triggerToast: (msg: string, type: "success" | "warning" | "info") => void;
  formatFCFA?: (val: number) => string;
}

export const JournalView: React.FC<JournalViewProps> = ({
  businessId,
  products,
  triggerToast,
  formatFCFA
}) => {
  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Currency formatter fallback
  const formatMoney = useCallback((val: number) => {
    if (formatFCFA) return formatFCFA(val);
    return new Intl.NumberFormat("fr-FR").format(val) + " F";
  }, [formatFCFA]);

  // Data States
  const [journalContent, setJournalContent] = useState<string>("");
  const [journalId, setJournalId] = useState<string | null>(null);
  const [todos, setTodos] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [financeStats, setFinanceStats] = useState<{ objectif_ca: number; objectif_benefice: number; ca_realise: number } | null>(null);

  // Form States
  const [newTodoItem, setNewTodoItem] = useState<string>("");
  const [isSavingJournal, setIsSavingJournal] = useState<boolean>(false);
  const [isGeneratingTodos, setIsGeneratingTodos] = useState<boolean>(false);
  const [isAddingTodo, setIsAddingTodo] = useState<boolean>(false);

  // Campaign checklist creation form
  const [showNewChecklistForm, setShowNewChecklistForm] = useState<boolean>(false);
  const [checklistTitle, setChecklistTitle] = useState<string>("");
  const [checklistProduct, setChecklistProduct] = useState<string>("");
  const [newCustomItemText, setNewCustomItemText] = useState<Record<string, string>>({}); // checklistId -> text

  // Load daily journal & todos
  const loadDailyData = useCallback(async () => {
    try {
      // 1. Fetch Journal Entry
      const { data: jData, error: jErr } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("business_id", businessId)
        .eq("date", selectedDate)
        .maybeSingle();

      if (jErr) throw jErr;
      if (jData) {
        setJournalContent(jData.contenu);
        setJournalId(jData.id);
      } else {
        setJournalContent("");
        setJournalId(null);
      }

      // 2. Fetch Daily Todos
      const { data: tData, error: tErr } = await supabase
        .from("daily_todos")
        .select("*")
        .eq("business_id", businessId)
        .eq("date", selectedDate)
        .order("created_at", { ascending: true });

      if (tErr) throw tErr;
      setTodos(tData || []);

      // 3. Fetch Finance Info
      const { data: fData, error: fErr } = await supabase
        .from("finance_daily_entries")
        .select("objectif_ca, objectif_benefice, ca_realise")
        .eq("business_id", businessId)
        .eq("date", selectedDate)
        .maybeSingle();

      if (fErr) throw fErr;
      if (fData) {
        setFinanceStats({
          objectif_ca: fData.objectif_ca || 0,
          objectif_benefice: fData.objectif_benefice || 0,
          ca_realise: fData.ca_realise || 0
        });
      } else {
        setFinanceStats(null);
      }
    } catch (err: any) {
      console.error("Error loading journal/todos:", err);
    }
  }, [businessId, selectedDate]);

  // Load Campaign Checklists
  const loadChecklists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_checklists")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (err: any) {
      console.error("Error loading campaign checklists:", err);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadDailyData();
      loadChecklists();
    }
  }, [businessId, selectedDate, loadDailyData, loadChecklists]);

  // Save Journal Content
  const handleSaveJournal = async () => {
    setIsSavingJournal(true);
    try {
      const payload = {
        business_id: businessId,
        date: selectedDate,
        contenu: journalContent
      };

      const { data, error } = await supabase
        .from("journal_entries")
        .upsert(payload, { onConflict: "business_id, date" })
        .select()
        .single();

      if (error) throw error;
      setJournalId(data.id);
      triggerToast("Notes du journal enregistrées !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsSavingJournal(false);
    }
  };

  // Generate AI Todos
  const handleGenerateAiTodos = async () => {
    if (!journalId && !journalContent.trim()) {
      triggerToast("Veuillez d'abord rédiger et enregistrer des notes dans votre journal.", "warning");
      return;
    }
    setIsGeneratingTodos(true);
    try {
      const res = await fetch("/api/journal/generate-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, date: selectedDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate todos");

      triggerToast("Tâches suggérées par l'IA générées !", "success");
      loadDailyData();
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsGeneratingTodos(false);
    }
  };

  // Add Manual Todo
  const handleAddManualTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoItem.trim()) return;
    setIsAddingTodo(true);
    try {
      const { data, error } = await supabase
        .from("daily_todos")
        .insert({
          business_id: businessId,
          date: selectedDate,
          item: newTodoItem.trim(),
          source: "manuel",
          done: false
        })
        .select()
        .single();

      if (error) throw error;
      setTodos(prev => [...prev, data]);
      setNewTodoItem("");
      triggerToast("Tâche ajoutée !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setIsAddingTodo(false);
    }
  };

  // Toggle Todo Status
  const handleToggleTodo = async (id: string, currentDone: boolean) => {
    try {
      const { error } = await supabase
        .from("daily_todos")
        .update({ done: !currentDone })
        .eq("id", id);

      if (error) throw error;
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !currentDone } : t));
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete Todo
  const handleDeleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("daily_todos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setTodos(prev => prev.filter(t => t.id !== id));
      triggerToast("Tâche supprimée.", "info");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Create Campaign Checklist
  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistTitle.trim()) return;

    const defaultItems = [
      { label: "Visuels publicitaires prêts et vérifiés", done: false },
      { label: "Description/accroche rédigée", done: false },
      { label: "Prix affiché correct et cohérent avec le SaaS", done: false },
      { label: "Zones de livraison à jour dans le SaaS", done: false },
      { label: "Stock du produit vérifié et suffisant", done: false },
      { label: "Base de connaissances de l'agent IA à jour pour ce produit", done: false },
      { label: "Numéro de contact/paiement vérifié", done: false },
      { label: "Budget publicitaire défini", done: false }
    ];

    try {
      const { data, error } = await supabase
        .from("campaign_checklists")
        .insert({
          business_id: businessId,
          titre: checklistTitle.trim(),
          produit_associe: checklistProduct || null,
          items: defaultItems
        })
        .select()
        .single();

      if (error) throw error;
      setChecklists(prev => [data, ...prev]);
      setChecklistTitle("");
      setChecklistProduct("");
      setShowNewChecklistForm(false);
      triggerToast("Checklist de campagne créée !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Toggle Checklist Item Status
  const handleToggleChecklistItem = async (checklistId: string, itemIndex: number) => {
    const list = checklists.find(c => c.id === checklistId);
    if (!list) return;

    const updatedItems = [...list.items];
    updatedItems[itemIndex].done = !updatedItems[itemIndex].done;

    try {
      const { error } = await supabase
        .from("campaign_checklists")
        .update({ items: updatedItems })
        .eq("id", checklistId);

      if (error) throw error;
      setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, items: updatedItems } : c));
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Delete Campaign Checklist
  const handleDeleteChecklist = async (id: string) => {
    try {
      const { error } = await supabase
        .from("campaign_checklists")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setChecklists(prev => prev.filter(c => c.id !== id));
      triggerToast("Checklist de campagne supprimée.", "info");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Add Custom Item to Checklist
  const handleAddCustomChecklistItem = async (checklistId: string) => {
    const text = newCustomItemText[checklistId]?.trim();
    if (!text) return;

    const list = checklists.find(c => c.id === checklistId);
    if (!list) return;

    const updatedItems = [...list.items, { label: text, done: false }];

    try {
      const { error } = await supabase
        .from("campaign_checklists")
        .update({ items: updatedItems })
        .eq("id", checklistId);

      if (error) throw error;
      setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, items: updatedItems } : c));
      setNewCustomItemText(prev => ({ ...prev, [checklistId]: "" }));
      triggerToast("Élément ajouté à la checklist !", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Remove Item from Checklist
  const handleRemoveChecklistItem = async (checklistId: string, itemIndex: number) => {
    const list = checklists.find(c => c.id === checklistId);
    if (!list) return;

    const updatedItems = list.items.filter((_: any, idx: number) => idx !== itemIndex);

    try {
      const { error } = await supabase
        .from("campaign_checklists")
        .update({ items: updatedItems })
        .eq("id", checklistId);

      if (error) throw error;
      setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, items: updatedItems } : c));
      triggerToast("Élément retiré.", "info");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    }
  };

  // Date Stepper helper
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  return (
    <div className="flex flex-col gap-6 text-encre">
      
      {/* Date navigation bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-graphite/10 shadow-xs">
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
      </div>

      {/* Financial Objectives Banner Block */}
      <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-3">
        <span className="text-[10px] font-black uppercase text-encre/40 tracking-wider flex items-center gap-1.5">
          <Target className="w-4 h-4 text-menthe" /> Objectifs financiers du jour ({selectedDate})
        </span>

        {financeStats && (financeStats.objectif_ca > 0 || financeStats.objectif_benefice > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-1">
              <span className="text-[8px] uppercase font-bold text-encre/40 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-menthe" /> Objectif CA
              </span>
              <span className="text-sm font-black text-encre tabular-nums">
                {formatMoney(financeStats.objectif_ca)}
              </span>
            </div>

            <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-1">
              <span className="text-[8px] uppercase font-bold text-encre/40 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-menthe" /> Objectif Bénéfice Net
              </span>
              <span className="text-sm font-black text-encre tabular-nums">
                {formatMoney(financeStats.objectif_benefice)}
              </span>
            </div>

            <div className="p-4 bg-neige rounded-xl border border-graphite/5 flex flex-col gap-1">
              <span className="text-[8px] uppercase font-bold text-encre/40 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-menthe" /> CA Réalisé
              </span>
              <span className="text-sm font-black text-encre tabular-nums">
                {formatMoney(financeStats.ca_realise)}
              </span>
              {financeStats.objectif_ca > 0 && (
                <div className="w-full h-1 bg-white rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-menthe"
                    style={{ width: `${Math.min((financeStats.ca_realise / financeStats.objectif_ca) * 100, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 font-semibold leading-relaxed">
            Aucun objectif n&apos;a encore été défini pour cette journée. Rendez-vous dans l&apos;onglet <strong className="font-extrabold">&quot;Pilotage&quot;</strong> pour fixer vos objectifs de chiffre d&apos;affaires et de bénéfice net.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Block 1: Journal & Todo List */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Journal segment */}
          <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-graphite/5 pb-2">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-menthe" /> Journal libre de l&apos;entrepreneur
              </span>
              <button
                onClick={handleSaveJournal}
                disabled={isSavingJournal}
                className="text-[10px] bg-encre hover:bg-menthe text-neige font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                {isSavingJournal ? "Enregistrement..." : "Enregistrer les notes"}
              </button>
            </div>

            <textarea
              placeholder="Notez vos réflexions du jour, points bloquants, idées publicitaires, remarques sur les clients ou livreurs..."
              value={journalContent}
              onChange={(e) => setJournalContent(e.target.value)}
              className="w-full min-h-[400px] bg-[#FAF8F5] border border-graphite/10 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:border-menthe text-encre leading-[2rem] resize-y shadow-inner"
              style={{
                backgroundImage: "linear-gradient(#E2E2E2 1px, transparent 1px)",
                backgroundSize: "100% 2rem",
                paddingTop: "0.5rem"
              }}
            />
          </div>

          {/* Daily To-do segment */}
          <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-graphite/5 pb-2">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-2">
                  <CheckSquare className="w-4.5 h-4.5 text-menthe" /> Actions & To-do du jour
                </span>
                <span className="text-[9px] text-encre/40 font-bold mt-0.5">Tâches générées par l&apos;IA ou ajoutées manuellement</span>
              </div>
              <button
                onClick={handleGenerateAiTodos}
                disabled={isGeneratingTodos}
                className="p-1.5 bg-neige hover:bg-menthe/10 border border-graphite/10 text-encre/75 hover:text-menthe rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-bold"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingTodos ? 'animate-pulse' : ''}`} /> Suggérer par l&apos;IA
              </button>
            </div>

            {/* List of todos */}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {todos.length === 0 ? (
                <span className="text-[10px] italic text-encre/40 py-6 text-center">Aucune tâche enregistrée pour aujourd&apos;hui. Cliquez sur &quot;Suggérer par l&apos;IA&quot; ou ajoutez-en une.</span>
              ) : (
                todos.map((t) => (
                  <div key={t.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    t.done ? 'bg-neige/50 border-graphite/5 opacity-60' : 'bg-white border-graphite/10'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button 
                        onClick={() => handleToggleTodo(t.id, t.done)}
                        className="text-encre/40 hover:text-menthe transition-colors shrink-0"
                      >
                        {t.done ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-menthe fill-menthe/10" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>
                      <span className={`text-[11px] font-semibold truncate ${t.done ? 'line-through text-encre/40' : 'text-encre'}`}>
                        {t.item}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border ${
                        t.source === "ia" 
                          ? "bg-purple-50 text-purple-600 border-purple-100" 
                          : "bg-blue-50 text-blue-600 border-blue-100"
                      }`}>
                        {t.source === "ia" ? "IA" : "Manuel"}
                      </span>
                      <button 
                        onClick={() => handleDeleteTodo(t.id)}
                        className="p-1 text-encre/30 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Form to add manual todo */}
            <form onSubmit={handleAddManualTodo} className="flex gap-2 border-t border-graphite/5 pt-3">
              <input
                type="text"
                placeholder="Nouvelle tâche manuelle..."
                value={newTodoItem}
                onChange={(e) => setNewTodoItem(e.target.value)}
                className="flex-1 bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
              />
              <button
                type="submit"
                disabled={isAddingTodo || !newTodoItem.trim()}
                className="bg-encre hover:bg-menthe text-neige text-[10px] font-black px-4 rounded-xl transition-all"
              >
                Ajouter
              </button>
            </form>
          </div>

        </div>

        {/* Block 2: Checklists de campagne */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <div className="p-5 bg-white rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-graphite/5 pb-2">
              <span className="text-xs font-black uppercase text-encre/70 flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-menthe" /> Checklists de Lancement
              </span>
              <button
                onClick={() => setShowNewChecklistForm(!showNewChecklistForm)}
                className="text-[9px] bg-neige border border-graphite/10 rounded-lg px-2.5 py-1.5 font-bold text-encre/75 hover:text-menthe transition-colors flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Nouveau
              </button>
            </div>

            {/* Create form segment */}
            {showNewChecklistForm && (
              <form onSubmit={handleCreateChecklist} className="p-3 bg-neige rounded-xl border border-graphite/10 flex flex-col gap-2.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] uppercase font-bold text-encre/50">Nom de la Campagne *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Lancement Kit Minceur Septembre"
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    className="bg-white border border-graphite/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[8px] uppercase font-bold text-encre/50">Produit associé (Optionnel)</label>
                  <select
                    value={checklistProduct}
                    onChange={(e) => setChecklistProduct(e.target.value)}
                    className="w-full bg-white border border-graphite/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-encre focus:outline-none focus:border-menthe"
                  >
                    <option value="">Sélectionner un produit...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end text-[9px] font-bold">
                  <button type="button" onClick={() => setShowNewChecklistForm(false)} className="px-2 py-1 bg-white border border-graphite/10 rounded-lg">Annuler</button>
                  <button type="submit" className="px-3 py-1 bg-encre text-white rounded-lg font-black">Créer la checklist</button>
                </div>
              </form>
            )}

            {/* List of checklists */}
            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
              {checklists.length === 0 ? (
                <span className="text-[10px] italic text-encre/40 py-8 text-center">Aucune checklist de campagne configurée.</span>
              ) : (
                checklists.map((c) => {
                  const doneCount = c.items.filter((i: any) => i.done).length;
                  const totalCount = c.items.length;
                  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

                  return (
                    <div key={c.id} className="p-4 bg-neige/30 rounded-xl border border-graphite/10 flex flex-col gap-3 shadow-xs">
                      
                      {/* Checklist Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-graphite/5 pb-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-black text-encre truncate">{c.titre}</span>
                          {c.produit_associe && (
                            <span className="text-[8px] font-bold text-menthe mt-0.5 uppercase">Produit : {c.produit_associe}</span>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteChecklist(c.id)}
                          className="p-1 text-encre/30 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Progress indicator */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[8px] text-encre/45 font-bold">
                          <span>Progression du lancement</span>
                          <span>{doneCount}/{totalCount} ({progressPct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-neige rounded-full overflow-hidden border border-graphite/5">
                          <div 
                            className="h-full bg-menthe transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* List items */}
                      <div className="flex flex-col gap-1.5 mt-1">
                        {c.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-[10px] font-medium bg-white p-2 rounded-lg border border-graphite/5">
                            <button 
                              onClick={() => handleToggleChecklistItem(c.id, idx)}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            >
                              {item.done ? (
                                <CheckCircle2 className="w-4 h-4 text-menthe fill-menthe/10 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-encre/40 shrink-0" />
                              )}
                              <span className={`truncate ${item.done ? 'line-through text-encre/40' : 'text-encre'}`}>
                                {item.label}
                              </span>
                            </button>

                            <button
                              onClick={() => handleRemoveChecklistItem(c.id, idx)}
                              className="text-encre/30 hover:text-red-500 p-0.5 rounded transition-colors shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add custom item form */}
                      <div className="flex gap-1.5 mt-1">
                        <input
                          type="text"
                          placeholder="Autre critère personnalisé..."
                          value={newCustomItemText[c.id] || ""}
                          onChange={(e) => setNewCustomItemText(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="flex-1 bg-white border border-graphite/10 rounded-lg px-2 py-1 text-[9px] font-semibold text-encre focus:outline-none focus:border-menthe"
                        />
                        <button
                          onClick={() => handleAddCustomChecklistItem(c.id)}
                          disabled={!newCustomItemText[c.id]?.trim()}
                          className="bg-encre hover:bg-menthe text-neige text-[8px] font-black px-2.5 rounded-lg transition-all"
                        >
                          +
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
