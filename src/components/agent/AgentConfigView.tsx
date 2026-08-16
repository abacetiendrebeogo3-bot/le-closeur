import React, { useState, useEffect } from "react";
import { Sparkles, Bot, Shield, AlertCircle, Play, Eye } from "lucide-react";
import { gsap } from "gsap";

interface AgentConfig {
  identity: string;
  salesRules: string;
  escalationRules: string;
  tone: string;
}

interface AgentConfigViewProps {
  config: AgentConfig;
  onSaveConfig: (newConfig: AgentConfig) => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
}

export const AgentConfigView: React.FC<AgentConfigViewProps> = ({
  config,
  onSaveConfig,
  triggerToast
}) => {
  // Local state initialized with props
  const [identity, setIdentity] = useState(config.identity);
  const [salesRules, setSalesRules] = useState(config.salesRules);
  const [escalationRules, setEscalationRules] = useState(config.escalationRules);
  const [tone, setTone] = useState(config.tone);

  // Simulator state
  const [testMessage, setTestMessage] = useState("");
  const [simulationResponse, setSimulationResponse] = useState("");
  const [simulatedPrompt, setSimulatedPrompt] = useState("");

  // Stagger entry animation
  useEffect(() => {
    gsap.fromTo(".config-card",
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
  }, []);

  // Update compiled preview prompt in real-time
  useEffect(() => {
    const assembled = `[ROLE & IDENTITÉ]
${identity || "(Non renseigné)"}

[TONALITÉ CONVERSATIONNELLE]
${tone || "Chaleureux et Respectueux"}

[RÈGLES DE VENTE]
${salesRules || "(Aucune règle définie)"}

[RÈGLES D'ESCALADE]
${escalationRules || "(Aucune règle définie)"}`;

    setSimulatedPrompt(assembled);
  }, [identity, salesRules, escalationRules, tone]);

  // Handle saving configurations
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      identity: identity.trim(),
      salesRules: salesRules.trim(),
      escalationRules: escalationRules.trim(),
      tone
    });
    triggerToast("Instructions de l'Agent IA sauvegardées avec succès.", "success");
  };

  // Run the mini client simulator logic
  const handleSimulateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    const query = testMessage.trim().toLowerCase();
    let response = "";

    // Simple routing mockup simulating prompt compliance
    if (query.includes("humain") || query.includes("conseiller") || query.includes("responsable") || query.includes("rembourser") || query.includes("réclamation")) {
      response = `[DÉCISION D'ESCALADE] ⚠️ Conforme aux règles d'escalade définies. \n\n"Je comprends parfaitement votre demande. Je passe immédiatement le relais à un conseiller humain pour qu'il puisse traiter votre dossier personnellement. Un instant s'il vous plaît."`;
    } else if (query.includes("remise") || query.includes("reduction") || query.includes("gratuit") || query.includes("cadeau")) {
      response = `[DÉCISION COMMERCIALE] 🛑 Conforme aux règles de vente (Pas de promesse hors consigne). \n\n"Nos tarifs sont calculés au plus juste pour garantir une qualité optimale. Aucune remise supplémentaire n'est disponible pour le moment. Souhaitez-vous continuer avec le prix affiché ?"`;
    } else {
      response = `[RÉPONSE COMPLIANTE] ✅ Réponse générée sur le ton : "${tone}".\n\n"Bonjour ! Merci pour votre intérêt. Oui, nous pouvons tout à fait organiser cela. Vos informations de livraison sont validées. Comment souhaitez-vous procéder pour le paiement ?"`;
    }

    setSimulationResponse(response);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full text-encre bg-neige">
      
      {/* LEFT COLUMN: IA Config Forms */}
      <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-menthe/10 flex items-center justify-center text-menthe shrink-0">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-encre">Configuration de l&apos;Agent IA</h3>
            <span className="text-[10px] text-encre/40 font-semibold block">Définissez la personnalité et les limites de votre closeur automatique</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          
          {/* Identité & Rôle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Identité & Rôle de l&apos;agent *</label>
            <textarea
              required
              rows={4}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="Ex: Tu es l'agent IA de vente de notre commerce de cosmétiques. Accueille chaleureusement le client et propose le catalogue en FCFA..."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          {/* Tonalité */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Tonalité conversationnelle</label>
            <select 
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-bold text-encre"
            >
              <option value="Chaleureux et Respectueux">Chaleureux et Respectueux</option>
              <option value="Direct et Professionnel">Direct et Professionnel</option>
              <option value="Amical et Détendu">Amical et Détendu</option>
            </select>
          </div>

          {/* Règles de vente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Règles de vente (Consignes commerciales)</label>
            <textarea
              rows={3}
              value={salesRules}
              onChange={(e) => setSalesRules(e.target.value)}
              placeholder="Ex: Les prix sont fixes. Ne jamais accorder plus de 10% de réduction sans validation humaine. Ne pas promettre de livraison sous 1h."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          {/* Règles d'escalade */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Règles d&apos;escalade (Reprise humaine) *</label>
            <textarea
              required
              rows={3}
              value={escalationRules}
              onChange={(e) => setEscalationRules(e.target.value)}
              placeholder="Ex: Transférer immédiatement le contrôle (human_takeover) si le client s'énerve, s'il y a une plainte, ou s'il demande un produit personnalisé."
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe leading-relaxed text-encre font-semibold"
            />
          </div>

          <button 
            type="submit" 
            className="magnetic-btn bg-encre text-neige hover:bg-menthe hover:text-neige font-bold py-3 rounded-xl text-center text-xs transition-all mt-2 shadow-sm"
          >
            Enregistrer la configuration IA
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Real-Time Preview & Simulator */}
      <div className="flex flex-col gap-6">
        
        {/* Real-Time Compiled Prompt Preview */}
        <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 text-encre/50">
            <Eye className="w-4 h-4 text-menthe" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Aperçu du prompt système compilé</span>
          </div>
          
          <div className="bg-encre text-neige/90 p-4 rounded-2xl border border-graphite/40 font-mono text-[10px] leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
            {simulatedPrompt}
          </div>
          <p className="text-[10px] text-encre/40 italic font-semibold leading-relaxed">
            Voici les directives exactes qui seront combinées puis injectées au début de chaque discussion avec vos prospects.
          </p>
        </div>

        {/* Mini Simulator / Test sandbox */}
        <div className="config-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-menthe" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Simulateur de comportement</span>
            </div>
            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-menthe/10 text-menthe border border-menthe/20">Sandbox</span>
          </div>

          <form onSubmit={handleSimulateTest} className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Ex: Je veux un rabais / Passez moi un humain..."
              className="flex-1 bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-menthe font-semibold text-encre"
            />
            <button 
              type="submit"
              className="bg-encre text-neige px-4 py-2 rounded-xl text-xs font-bold hover:bg-menthe hover:text-neige transition-colors shadow-xs"
            >
              Simuler
            </button>
          </form>

          {simulationResponse && (
            <div className="bg-neige p-3.5 rounded-xl border border-graphite/5 text-[11px] leading-normal font-medium text-encre whitespace-pre-wrap transition-all">
              {simulationResponse}
            </div>
          )}
          
          <div className="flex gap-2 items-start text-[9px] text-encre/45 font-semibold bg-neige/50 p-2.5 rounded-xl border border-graphite/5 mt-1">
            <AlertCircle className="w-3.5 h-3.5 text-menthe shrink-0 mt-0.5" />
            <span>Tapez un mot-clé comme &quot;humain&quot; (pour tester l&apos;escalade) ou &quot;remise&quot; (pour tester les consignes commerciales).</span>
          </div>
        </div>

      </div>

    </div>
  );
};
