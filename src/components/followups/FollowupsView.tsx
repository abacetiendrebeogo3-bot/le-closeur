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
  onNavigateToChat
}) => {
  const [steps, setSteps] = useState<FollowupStep[]>(defaultSteps);
  const [clientsList, setClientsList] = useState<FollowupClient[]>(mockFollowupClients);

  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const clientsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch steps from Supabase
  useEffect(() => {
    const fetchSteps = async () => {
      const { data, error } = await supabase
        .from("followup_steps")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        setSteps(data.map(fs => ({
          id: fs.id,
          delayValue: fs.delay_value,
          delayUnit: fs.delay_unit,
          name: fs.name,
          messageText: fs.message_text,
          metaTemplateName: fs.meta_template_name
        })));
      }
    };
    fetchSteps();
  }, []);

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

  // Add step
  const handleAddStep = async () => {
    const newId = `STEP-${Date.now()}`;
    const newStep: FollowupStep = {
      id: newId,
      delayValue: 1,
      delayUnit: "days",
      name: `Nouvelle Étape ${steps.length + 1}`,
      messageText: "Bonjour {{name}}, ...",
      metaTemplateName: "custom_template"
    };

    const { error } = await supabase.from("followup_steps").insert({
      id: newId,
      delay_value: newStep.delayValue,
      delay_unit: newStep.delayUnit,
      name: newStep.name,
      message_text: newStep.messageText,
      meta_template_name: newStep.metaTemplateName
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
            <span className="text-2xl font-black text-encre tabular-nums">1,248</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe/10 flex items-center justify-center text-menthe animate-pulse">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat: Stopped / Converted */}
        <div className="followup-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40">Arrêtées (Réponse / Achat)</span>
            <span className="text-2xl font-black text-encre tabular-nums">4,380</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-encre/5 flex items-center justify-center text-encre">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Stat: Conversion Rate */}
        <div className="followup-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-encre/40 font-bold">Conversion Relances</span>
            <span className="text-2xl font-black text-menthe tabular-nums">24.8%</span>
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

        {/* Steps List */}
        <div ref={stepsContainerRef} className="flex flex-col gap-6 pl-4 border-l-2 border-menthe/20">
          {steps.map((step, idx) => (
            <div key={step.id} className="followup-row relative flex flex-col gap-3.5 bg-neige/30 p-4 sm:p-5 rounded-[1.5rem] border border-graphite/5 shadow-xs">
              
              {/* Chronological Dot badge */}
              <span className="absolute -left-[25px] top-5 w-3 h-3 bg-menthe rounded-full border-2 border-white shadow-xs"></span>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-graphite/5 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-menthe">Étape {idx + 1}</span>
                  
                  {/* Delay fields */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-encre/40 font-semibold">après</span>
                    <input 
                      type="number" 
                      min={1}
                      value={step.delayValue}
                      onChange={(e) => handleUpdateStepField(step.id, "delayValue", parseInt(e.target.value) || 1)}
                      className="w-10 bg-white border border-graphite/10 rounded-lg py-0.5 text-center text-xs font-bold text-encre"
                    />
                    <select
                      value={step.delayUnit}
                      onChange={(e) => handleUpdateStepField(step.id, "delayUnit", e.target.value)}
                      className="bg-white border border-graphite/10 rounded-lg py-0.5 px-1 text-[10px] font-bold text-encre"
                    >
                      <option value="hours">Heure(s)</option>
                      <option value="days">Jour(s)</option>
                    </select>
                  </div>
                </div>

                {/* Delete step button */}
                <button
                  onClick={() => handleDeleteStep(step.id, idx)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-100 transition-colors self-end sm:self-auto"
                  title="Supprimer cette étape"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form details inline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/45">Nom de l&apos;action</label>
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => handleUpdateStepField(step.id, "name", e.target.value)}
                    placeholder="Ex: Rappel panier..."
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-encre/45">Nom du Template Meta (WhatsApp Business)</label>
                  <input
                    type="text"
                    value={step.metaTemplateName}
                    onChange={(e) => handleUpdateStepField(step.id, "metaTemplateName", e.target.value)}
                    placeholder="Ex: cart_recovery_fr..."
                    className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-mono text-encre"
                  />
                </div>
              </div>

              {/* Message text details */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-encre/45">Texte du message de relance</label>
                <textarea
                  rows={2}
                  value={step.messageText}
                  onChange={(e) => handleUpdateStepField(step.id, "messageText", e.target.value)}
                  placeholder="Écrivez le message ici..."
                  className="bg-white border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-medium"
                />
                
                {/* Available variables label */}
                <div className="flex gap-1.5 items-center mt-1 text-[9px] text-encre/40 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-menthe shrink-0" />
                  <span>Variables autorisées : <code className="font-mono text-encre font-black bg-neige px-1 rounded">{"{{name}}"}</code>, <code className="font-mono text-encre font-black bg-neige px-1 rounded">{"{{total_amount}}"}</code>, <code className="font-mono text-encre font-black bg-neige px-1 rounded">{"{{delivery_zone}}"}</code></span>
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* Add Step Action */}
        <button
          onClick={handleAddStep}
          className="magnetic-btn border border-dashed border-menthe/40 text-menthe hover:bg-menthe/5 hover:border-menthe/60 font-bold py-3.5 rounded-2xl text-center text-xs transition-all flex items-center justify-center gap-2 mt-2"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter une étape de relance</span>
        </button>

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
              {clientsList.map(client => (
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
              ))}
            </tbody>
          </table>
        </div>

        {/* LIST FOR MOBILE (< 768px) */}
        <div className="md:hidden flex flex-col gap-4">
          {clientsList.map(client => (
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
          ))}
        </div>

      </div>

    </div>
  );
};
