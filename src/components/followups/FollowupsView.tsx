import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Clock, CheckCircle, Ban, TrendingUp, Sparkles, MessageSquare, AlertCircle } from "lucide-react";
import { FollowupStep } from "../../types";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface FollowupsViewProps {
  followupsActive: boolean;
  setFollowupsActive: (active: boolean) => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  onNavigateToChat: (customerName: string) => void;
  businessId: string | null;
}

// Prefilled default steps
const defaultSteps: FollowupStep[] = [
  {
    id: "STEP-1",
    delayValue: 1,
    delayUnit: "hours",
    name: "Rappel Panier Abandonné",
    messageText: "Bonjour {{name}}, nous avons remarqué que vous n’avez pas validé votre panier de {{total_amount}} FCFA. Souhaitez-vous de l’aide ?",
    metaTemplateName: "cart_recovery_fr"
  },
  {
    id: "STEP-2",
    delayValue: 24,
    delayUnit: "hours",
    name: "Offre de livraison prioritaire",
    messageText: "Bonjour {{name}} ! Finalisez votre commande aujourd’hui et profitez d’une expédition rapide pour {{delivery_zone}}.",
    metaTemplateName: "delivery_incentive_fr"
  },
  {
    id: "STEP-3",
    delayValue: 3,
    delayUnit: "days",
    name: "Relance Relationnelle",
    messageText: "Bonjour {{name}}, nous aimerions savoir si vous êtes toujours intéressé par nos solutions.",
    metaTemplateName: "nurture_followup_fr"
  },
  {
    id: "STEP-4",
    delayValue: 7,
    delayUnit: "days",
    name: "Offre Spéciale d'Accompagnement",
    messageText: "Bonjour {{name}} ! Pour vous remercier de votre intérêt, nous vous offrons les frais de livraison pour votre colis vers {{delivery_zone}}.",
    metaTemplateName: "special_offer_fr"
  },
  {
    id: "STEP-5",
    delayValue: 10,
    delayUnit: "days",
    name: "Dernière tentative",
    messageText: "Bonjour {{name}}, ceci est notre dernière tentative pour finaliser votre commande avant son annulation automatique. À bientôt !",
    metaTemplateName: "last_chance_fr"
  }
];

// Mock data for clients currently in followup
interface FollowupClient {
  id: string;
  name: string;
  currentStepIndex: number;
  nextFollowupTime: string;
  status: "active" | "stopped_replied" | "stopped_ordered" | "completed_no_reply";
}

const mockFollowupClients: FollowupClient[] = [
  { id: "FC-01", name: "Youssou Ndiaye", currentStepIndex: 0, nextFollowupTime: "Aujourd'hui à 15:30", status: "active" },
  { id: "FC-02", name: "Fatou Diome", currentStepIndex: 1, nextFollowupTime: "- (Arrêtée)", status: "stopped_replied" },
  { id: "FC-03", name: "Mariama Bâ", currentStepIndex: 2, nextFollowupTime: "- (Arrêtée)", status: "stopped_ordered" },
  { id: "FC-04", name: "Abdoulaye Wade", currentStepIndex: 4, nextFollowupTime: "Demain à 10:00", status: "active" },
  { id: "FC-05", name: "Aminata Touré", currentStepIndex: 4, nextFollowupTime: "- (Terminée)", status: "completed_no_reply" }
];

export const FollowupsView: React.FC<FollowupsViewProps> = ({
  followupsActive,
  setFollowupsActive,
  triggerToast,
  onNavigateToChat,
  businessId
}) => {
  const [steps, setSteps] = useState<FollowupStep[]>(defaultSteps);
  const [clientsList, setClientsList] = useState<FollowupClient[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    stopped: 0,
    conversion: 0
  });
  const [loading, setLoading] = useState(true);

  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const clientsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch steps from Supabase
  useEffect(() => {
    if (!businessId) return;
    const fetchSteps = async () => {
      const { data, error } = await supabase
        .from("followup_steps")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        setSteps(data.map(fs => ({
          id: fs.id,
          delayValue: fs.delay_value,
          delayUnit: fs.delay_unit,
          name: fs.name,
          messageText: fs.message_text,
          metaTemplateName: fs.meta_template_name,
          active: fs.active
        })));
      }
    };
    fetchSteps();
  }, [businessId]);

  // Fetch metrics & dynamic clients list from Supabase
  useEffect(() => {
    if (!businessId) return;

    const loadFollowupData = async () => {
      setLoading(true);
      try {
        // 1. Fetch conversations
        const { data: convs, error: convsErr } = await supabase
          .from("conversations")
          .select("*")
          .eq("business_id", businessId);

        if (convsErr || !convs) {
          console.error("Error loading conversations:", convsErr);
          setLoading(false);
          return;
        }

        const convIds = convs.map(c => c.id);

        // 2. Fetch followup runs
        let runs: any[] = [];
        if (convIds.length > 0) {
          const { data: runsData } = await supabase
            .from("followup_runs")
            .select("*")
            .in("conversation_id", convIds);
          runs = runsData || [];
        }

        // 3. Fetch orders
        let orders: any[] = [];
        if (convIds.length > 0) {
          const { data: ordersData } = await supabase
            .from("orders")
            .select("*")
            .in("chat_id", convIds);
          orders = ordersData || [];
        }

        // Compute metrics
        // Active: Count total followups sent (rows in followup_runs)
        const activeCount = runs.length;

        // Stopped: Conversations where status is human_takeover or closed
        const stoppedCount = convs.filter(c => c.status === "human_takeover" || c.status === "closed").length;

        // Conversion: % of conversations that have an order
        const totalConvs = convs.length;
        const convertedCount = orders.length;
        const conversionRate = totalConvs > 0 ? parseFloat(((convertedCount / totalConvs) * 100).toFixed(1)) : 0;

        setStats({
          active: activeCount,
          stopped: stoppedCount,
          conversion: conversionRate
        });

        // Construct client list
        const clientListFormatted: FollowupClient[] = convs
          .filter(c => {
            // Only list clients that have at least one followup run
            const hasRuns = runs.some(r => r.conversation_id === c.id);
            return hasRuns;
          })
          .map(c => {
            const convRuns = runs.filter(r => r.conversation_id === c.id);
            const hasOrder = orders.some(o => o.chat_id === c.id);
            const currentStepIdx = Math.max(0, convRuns.length - 1);

            let status: FollowupClient["status"] = "active";
            if (hasOrder) {
              status = "stopped_ordered";
            } else if (c.status === "human_takeover") {
              status = "stopped_replied";
            } else if (convRuns.length >= steps.length) {
              status = "completed_no_reply";
            }

            const lastRun = convRuns[convRuns.length - 1];
            let nextTime = "-";
            if (status === "active") {
              if (lastRun) {
                nextTime = new Date(new Date(lastRun.created_at).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit"
                });
              } else {
                nextTime = "En attente";
              }
            } else if (status === "stopped_replied") {
              nextTime = "- (Reprise)";
            } else if (status === "stopped_ordered") {
              nextTime = "- (Achat)";
            } else {
              nextTime = "- (Terminée)";
            }

            return {
              id: String(c.id),
              name: c.customer_name,
              currentStepIndex: currentStepIdx,
              nextFollowupTime: nextTime,
              status
            };
          });

        setClientsList(clientListFormatted);
      } catch (err) {
        console.error("Error loading followup data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFollowupData();
  }, [businessId, steps.length]);

  // GSAP Entrance animations
  useEffect(() => {
    gsap.fromTo(".followup-card",
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
  }, []);

  // Recalculate total sequence duration in days
  const calculateTotalDuration = () => {
    let totalHours = 0;
    steps.forEach(step => {
      if (step.delayUnit === "hours") {
        totalHours += step.delayValue;
      } else {
        totalHours += step.delayValue * 24;
      }
    });
    const days = totalHours / 24;
    return days % 1 === 0 ? days : parseFloat(days.toFixed(1));
  };

  // Add template for specific tier
  const handleAddTemplateForTier = async (value: number, unit: "hours" | "days") => {
    if (!businessId) return;
    const newId = `STEP-${Date.now()}`;
    const newStep: FollowupStep = {
      id: newId,
      delayValue: value,
      delayUnit: unit,
      name: `Modèle ${unit === "days" ? "J" + value : value + "h"} - Option ${steps.filter(s => s.delayValue === value && s.delayUnit === unit).length + 1}`,
      messageText: "Bonjour {{name}}, ...",
      metaTemplateName: "custom_template",
      active: false
    };

    const { error } = await supabase.from("followup_steps").insert({
      id: newId,
      business_id: businessId,
      delay_value: newStep.delayValue,
      delay_unit: newStep.delayUnit,
      name: newStep.name,
      message_text: newStep.messageText,
      meta_template_name: newStep.metaTemplateName,
      active: false
    });

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setSteps(prev => [...prev, newStep]);
    triggerToast("Nouveau modèle de relance ajouté pour ce palier.", "success");
  };

  // Activate a specific template and deactivate others of the same step
  const handleActivateStep = async (stepId: string, delayValue: number, delayUnit: string) => {
    setSteps(prev => prev.map(step => {
      if (step.delayValue === delayValue && step.delayUnit === delayUnit) {
        return { ...step, active: step.id === stepId };
      }
      return step;
    }));

    await supabase.from("followup_steps")
      .update({ active: false })
      .eq("business_id", businessId)
      .eq("delay_value", delayValue)
      .eq("delay_unit", delayUnit);

    const { error } = await supabase.from("followup_steps")
      .update({ active: true })
      .eq("id", stepId);

    if (error) {
      triggerToast(`Erreur d'activation: ${error.message}`, "warning");
    } else {
      triggerToast("Modèle activé avec succès pour ce palier.", "success");
    }
  };

  // Get all unique delay tiers present in the steps, sorted chronologically
  const getUniqueTiers = () => {
    const tiersMap = new Map<string, { value: number; unit: "hours" | "days" }>();
    
    // Always include the default J1, J3, J5, J7, J12, J15, J21 tiers
    const defaultTiers: { value: number; unit: "hours" | "days" }[] = [
      { value: 1, unit: "days" },
      { value: 3, unit: "days" },
      { value: 5, unit: "days" },
      { value: 7, unit: "days" },
      { value: 12, unit: "days" },
      { value: 15, unit: "days" },
      { value: 21, unit: "days" },
    ];
    
    defaultTiers.forEach(t => {
      tiersMap.set(`${t.value}_${t.unit}`, t);
    });

    steps.forEach(s => {
      tiersMap.set(`${s.delayValue}_${s.delayUnit}`, { value: s.delayValue, unit: s.delayUnit });
    });

    return Array.from(tiersMap.values()).sort((a, b) => {
      const aVal = a.unit === "hours" ? a.value : a.value * 24;
      const bVal = b.unit === "hours" ? b.value : b.value * 24;
      return aVal - bVal;
    });
  };

  // Add step
  const handleAddStep = async () => {
    if (!businessId) return;
    const newId = `STEP-${Date.now()}`;
    const newStep: FollowupStep = {
      id: newId,
      delayValue: 1,
      delayUnit: "days",
      name: `Nouvelle Étape ${steps.length + 1}`,
      messageText: "Bonjour {{name}}, ...",
      metaTemplateName: "custom_template",
      active: false
    };

    const { error } = await supabase.from("followup_steps").insert({
      id: newId,
      business_id: businessId,
      delay_value: newStep.delayValue,
      delay_unit: newStep.delayUnit,
      name: newStep.name,
      message_text: newStep.messageText,
      meta_template_name: newStep.metaTemplateName,
      active: false
    });

    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }

    setSteps(prev => [...prev, newStep]);
    triggerToast("Nouvelle étape de relance ajoutée.", "success");
  };

  // Update step field
  const handleUpdateStepField = async (id: string, field: keyof FollowupStep, value: any) => {
    setSteps(prev => prev.map(step => {
      if (step.id === id) {
        return { ...step, [field]: value };
      }
      return step;
    }));

    const dbField = field === "delayValue" ? "delay_value" :
                    field === "delayUnit" ? "delay_unit" :
                    field === "messageText" ? "message_text" :
                    field === "metaTemplateName" ? "meta_template_name" : "name";

    await supabase.from("followup_steps").update({
      [dbField]: value
    }).eq("id", id);
  };

  // Delete step
  const handleDeleteStep = async (id: string, index: number) => {
    const { error } = await supabase.from("followup_steps").delete().eq("id", id);
    if (error) {
      triggerToast(`Erreur Supabase: ${error.message}`, "warning");
      return;
    }
    setSteps(prev => prev.filter(step => step.id !== id));
    triggerToast(`Étape ${index + 1} supprimée de la séquence.`, "info");
  };

  // Helper for client badges
  const renderClientStatusBadge = (status: FollowupClient["status"]) => {
    const configs = {
      active: { label: "En cours", style: "bg-menthe/10 text-menthe border-menthe/20" },
      stopped_replied: { label: "Arrêtée - Répondu", style: "bg-amber-50 text-amber-600 border-amber-200" },
      stopped_ordered: { label: "Arrêtée - Commandé", style: "bg-green-50 text-green-600 border-green-200" },
      completed_no_reply: { label: "Terminée sans réponse", style: "bg-graphite/10 text-graphite-light border-graphite/20" }
    };
    const c = configs[status] || configs.active;
    return (
      <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-extrabold border ${c.style}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full text-encre bg-neige">
      
      {/* 1. VIEW STATS BLOCK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stat: Active followups */}
        <div className="followup-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40">Relances Actives</span>
            <span className="text-2xl font-black text-encre tabular-nums">{stats.active.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe/10 flex items-center justify-center text-menthe animate-pulse">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat: Stopped / Converted */}
        <div className="followup-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40">Arrêtées (Réponse / Achat)</span>
            <span className="text-2xl font-black text-encre tabular-nums">{stats.stopped.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-encre/5 flex items-center justify-center text-encre">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Stat: Conversion Rate */}
        <div className="followup-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40 font-bold">Conversion Relances</span>
            <span className="text-2xl font-black text-menthe tabular-nums">{stats.conversion}%</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe text-white flex items-center justify-center shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC SEQUENCE CONFIGURATOR */}
      <div className="followup-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-6">
        
        {/* Toggle header & total duration info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-graphite/5 pb-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-encre">Séquence de relance WhatsApp</h3>
              <span className="text-[10px] bg-menthe/10 text-menthe border border-menthe/20 px-2 py-0.5 rounded-full font-bold">Meta Compliant</span>
            </div>
            <span className="text-[10px] text-encre/45 font-semibold leading-relaxed">
              Durée totale de la séquence : <span className="text-menthe font-black">{calculateTotalDuration()} jours</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-encre/70">Statut Global</span>
            <button 
              onClick={() => { 
                setFollowupsActive(!followupsActive); 
                triggerToast(followupsActive ? "Relances suspendues." : "Relances réactivées.", followupsActive ? "warning" : "success"); 
              }} 
              className={`w-11 h-6 rounded-full relative transition-colors ${followupsActive ? 'bg-menthe' : 'bg-graphite'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${followupsActive ? 'left-6' : 'left-1'}`}></span>
            </button>
          </div>
        </div>

        {/* Grouped Steps List by Delay Tiers */}
        <div ref={stepsContainerRef} className="flex flex-col gap-8 pl-4 border-l-2 border-menthe/20">
          {getUniqueTiers().map((tier, idx) => {
            const templates = steps.filter(s => s.delayValue === tier.value && s.delayUnit === tier.unit);
            const tierLabel = tier.unit === "days" ? `Relance J${tier.value} (${tier.value} jour${tier.value > 1 ? "s" : ""})` : `Relance ${tier.value} heure${tier.value > 1 ? "s" : ""}`;
            
            return (
              <div key={`${tier.value}_${tier.unit}`} className="relative flex flex-col gap-4">
                {/* Chronological Dot badge */}
                <span className="absolute -left-[25px] top-1.5 w-3.5 h-3.5 bg-menthe rounded-full border-2 border-white shadow-xs"></span>
                
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-menthe tracking-wider">{tierLabel}</h4>
                  <button
                    onClick={() => handleAddTemplateForTier(tier.value, tier.unit)}
                    className="text-[10px] font-bold text-menthe hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un modèle
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div className="bg-neige/20 p-4 rounded-2xl border border-dashed border-graphite/10 text-center text-xs text-encre/40 font-medium">
                    Aucun modèle configuré pour ce palier. L&apos;agent utilisera la génération automatique par Claude.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((step) => {
                      const isActive = step.active === true;
                      return (
                        <div 
                          key={step.id} 
                          className={`followup-row flex flex-col gap-3 p-4 sm:p-5 rounded-[1.5rem] border transition-all ${
                            isActive 
                              ? "bg-menthe/5 border-menthe/40 shadow-sm" 
                              : "bg-neige/30 border-graphite/5 hover:border-graphite/10"
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-graphite/5 pb-2">
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                checked={isActive}
                                onChange={() => handleActivateStep(step.id, step.delayValue, step.delayUnit)}
                                className="w-3.5 h-3.5 text-menthe accent-menthe cursor-pointer"
                              />
                              <span className="text-xs font-bold text-encre">{step.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {isActive ? (
                                <span className="bg-menthe/10 text-menthe text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                                  Actif
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleActivateStep(step.id, step.delayValue, step.delayUnit)}
                                  className="text-[9px] font-bold text-encre/50 hover:text-menthe transition-colors"
                                >
                                  Activer
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStep(step.id, idx)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                title="Supprimer ce modèle"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Editable fields */}
                          <div className="flex flex-col gap-2.5">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase font-black text-encre/45">Nom de l&apos;option</label>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => handleUpdateStepField(step.id, "name", e.target.value)}
                                className="bg-white/80 border border-graphite/10 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                              />
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase font-black text-encre/45">Template Meta</label>
                              <input
                                type="text"
                                value={step.metaTemplateName || ""}
                                onChange={(e) => handleUpdateStepField(step.id, "metaTemplateName", e.target.value)}
                                className="bg-white/80 border border-graphite/10 rounded-xl px-2.5 py-1 text-[11px] focus:outline-none focus:border-menthe font-mono text-encre"
                              />
                            </div>

                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase font-black text-encre/45">Message</label>
                              <textarea
                                rows={3}
                                value={step.messageText}
                                onChange={(e) => handleUpdateStepField(step.id, "messageText", e.target.value)}
                                className="bg-white/80 border border-graphite/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-medium"
                              />
                            </div>

                            {/* Available variables label */}
                            <div className="flex gap-1 mt-1 text-[8px] text-encre/40 font-semibold">
                              <AlertCircle className="w-3 h-3 text-menthe shrink-0" />
                              <span>Variables : <code className="font-mono bg-neige px-0.5 rounded">{"{{name}}"}</code></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* 3. CURRENT CLIENTS LIST */}
      <div className="followup-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-menthe" />
          <h3 className="text-sm font-bold text-encre">Clients en cours de relance</h3>
        </div>

        {/* TABLE FOR DESKTOP (>= 768px) */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Étape Actuelle</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Prochaine relance</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Lien</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {clientsList.length > 0 ? (
                clientsList.map(client => (
                  <tr 
                    key={client.id} 
                    onClick={() => onNavigateToChat(client.name)}
                    className="border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-bold text-encre">{client.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-neige px-2.5 py-0.5 rounded-full border border-graphite/5 font-semibold text-[10px] text-encre/70">
                        Étape {client.currentStepIndex + 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-encre/65 font-medium">{steps[client.currentStepIndex]?.name || `Étape ${client.currentStepIndex + 1}`}</td>
                    <td className="py-3.5 px-4 font-mono text-encre/60 font-semibold">{client.nextFollowupTime}</td>
                    <td className="py-3.5 px-4 text-center">{renderClientStatusBadge(client.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[10px] font-bold text-menthe hover:underline">Ouvrir Chat →</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-encre/40 italic">
                    Aucun client en cours de relance pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* LIST FOR MOBILE (< 768px) */}
        <div className="md:hidden flex flex-col gap-4">
          {clientsList.length > 0 ? (
            clientsList.map(client => (
              <div 
                key={client.id}
                onClick={() => onNavigateToChat(client.name)}
                className="bg-neige/20 p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-neige/40 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs text-encre">{client.name}</span>
                  {renderClientStatusBadge(client.status)}
                </div>

                <div className="flex flex-col gap-1 text-[10px] text-encre/60 border-t border-graphite/5 pt-3">
                  <div>
                    <span className="text-encre/40 font-semibold">Action : </span>
                    <span className="text-encre font-bold">{steps[client.currentStepIndex]?.name || `Étape ${client.currentStepIndex + 1}`}</span>
                  </div>
                  <div>
                    <span className="text-encre/40 font-semibold">Étape : </span>
                    <span className="bg-neige px-2 py-0.5 rounded-md border border-graphite/5 text-[9px] font-bold text-encre">Étape {client.currentStepIndex + 1}</span>
                  </div>
                  <div>
                    <span className="text-encre/40 font-semibold">Prochaine : </span>
                    <span className="font-mono text-encre font-semibold">{client.nextFollowupTime}</span>
                  </div>
                </div>

                <div className="text-[10px] text-menthe font-bold text-right border-t border-graphite/5 pt-3 mt-1">
                  Ouvrir discussion WhatsApp →
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-encre/40 bg-neige/10 border border-dashed border-graphite/10 rounded-[2rem] italic">
              Aucun client en cours de relance.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
