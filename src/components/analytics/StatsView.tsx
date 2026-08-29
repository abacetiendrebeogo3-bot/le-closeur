"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase/client";
import { 
  BarChart3, 
  MessageSquare, 
  ShoppingBag, 
  TrendingUp, 
  AlertCircle, 
  TrendingDown, 
  RefreshCw, 
  Bot, 
  Sparkles,
  Play
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Legend
} from "recharts";

interface StatsViewProps {
  businessId: string;
}

export const StatsView: React.FC<StatsViewProps> = ({ businessId }) => {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Coach states
  const [coachAnalysis, setCoachAnalysis] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/summary?businessId=${businessId}&period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSummary({
        nb_conversations: data.nb_conversations,
        nb_messages: data.nb_messages,
        nb_commandes: data.nb_commandes,
        taux_conversion: data.taux_conversion,
        nb_silencieuses: data.nb_silencieuses,
        taux_abandon: data.taux_abandon,
      });
      setChartData(data.chartData || []);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => {
    if (businessId) {
      fetchStats();
    }
  }, [businessId, period, fetchStats]);

  const handleRunCoach = async () => {
    setLoadingAnalysis(true);
    setCoachAnalysis("");
    try {
      const res = await fetch("/api/analytics/coach-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoachAnalysis(data.analysis);
    } catch (err: any) {
      console.error("Coach analysis error:", err);
      setCoachAnalysis(`### Erreur\n\nUne erreur est survenue lors de la génération de l'analyse : ${err.message}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const renderMarkdown = (md: string) => {
    if (!md) return null;
    return md.split("\n").map((line, idx) => {
      // Bold rendering within lines
      const processBold = (text: string) => {
        const parts = text.split("**");
        return parts.map((part, i) => {
          if (i % 2 === 1) {
            return <strong key={i} className="font-extrabold text-encre">{part}</strong>;
          }
          return part;
        });
      };

      if (line.startsWith("### ")) {
        return <h4 key={idx} className="text-xs font-bold text-encre mt-4 mb-2">{processBold(line.replace("### ", ""))}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={idx} className="text-sm font-extrabold text-encre mt-5 mb-2 border-b border-graphite/5 pb-1">{processBold(line.replace("## ", ""))}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={idx} className="text-base font-black text-encre mt-6 mb-3">{processBold(line.replace("# ", ""))}</h2>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-encre/70 font-semibold leading-relaxed my-1">
            {processBold(line.substring(2))}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs text-encre/70 font-semibold leading-relaxed mb-2">{processBold(line)}</p>;
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full text-encre">
      {/* Header and selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-encre/40 tracking-wider">Supervision & Performance</span>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-encre">Statistiques Clés</h3>
            <span className="text-[10px] bg-menthe/10 text-menthe border border-menthe/20 px-2 py-0.5 rounded-full font-bold">Coach IA inclus</span>
          </div>
        </div>

        {/* Period Switcher */}
        <div className="flex gap-1.5 bg-neige p-1 rounded-xl border border-graphite/5 self-start md:self-auto">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p 
                  ? "bg-white text-encre shadow-xs border border-graphite/5" 
                  : "text-encre/50 hover:text-encre"
              }`}
            >
              {p === "day" ? "Aujourd'hui" : p === "week" ? "7 Jours" : "30 Jours"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-menthe animate-spin" />
          <span className="text-xs font-bold text-encre/40">Chargement des données...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main statistics cards & chart */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Card 1: Conversations */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Conversations</span>
                  <MessageSquare className="w-4 h-4 text-encre/40" />
                </div>
                <span className="text-xl font-black">{summary?.nb_conversations || 0}</span>
                <span className="text-[9px] text-encre/30 font-semibold">Ayant reçu au moins 1 message</span>
              </div>

              {/* Card 2: Messages reçus */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Messages Reçus</span>
                  <BarChart3 className="w-4 h-4 text-encre/40" />
                </div>
                <span className="text-xl font-black">{summary?.nb_messages || 0}</span>
                <span className="text-[9px] text-encre/30 font-semibold">Provenance exclusive des clients</span>
              </div>

              {/* Card 3: Commandes */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Commandes</span>
                  <ShoppingBag className="w-4 h-4 text-encre/40" />
                </div>
                <span className="text-xl font-black">{summary?.nb_commandes || 0}</span>
                <span className="text-[9px] text-encre/30 font-semibold">Générées dans la période</span>
              </div>

              {/* Card 4: Taux de conversion */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Taux de conversion</span>
                  <TrendingUp className="w-4 h-4 text-menthe" />
                </div>
                <span className="text-xl font-black text-menthe">{summary?.taux_conversion || 0}%</span>
                <span className="text-[9px] text-encre/30 font-semibold">Commandes / Conversations</span>
              </div>

              {/* Card 5: Silencieuses */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Silencieuses &gt; 24h</span>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-xl font-black text-amber-600">{summary?.nb_silencieuses || 0}</span>
                <span className="text-[9px] text-encre/30 font-semibold">Sans réponse après l&apos;IA</span>
              </div>

              {/* Card 6: Taux d'abandon */}
              <div className="bg-white p-5 rounded-2xl border border-graphite/10 shadow-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-encre/40 uppercase">Taux d&apos;abandon</span>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xl font-black text-red-600">{summary?.taux_abandon || 0}%</span>
                <span className="text-[9px] text-encre/30 font-semibold">Silencieuses / Conversations</span>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-4">
              <span className="text-xs font-black uppercase text-encre/70">Activité & Conversion (30 Derniers Jours)</span>
              <div className="h-72 w-full">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-encre/40 italic">Aucune donnée historique.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={9} tickLine={false} />
                      <YAxis stroke="#9CA3AF" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1C1C1E", borderRadius: "1rem", border: "none", color: "#FAFAFA", fontSize: "10px" }}
                        formatter={(val: number, name: string) => [
                          name.includes("taux") || name.includes("Rate") || name.includes("conversion") ? `${val}%` : val,
                          name === "conversations" ? "Conversations" : "Taux de conversion"
                        ]}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
                      <Line type="monotone" dataKey="conversations" name="Conversations" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="conversionRate" name="Taux de conversion (%)" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Coach IA column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="p-5 bg-encre text-neige rounded-[2rem] border border-graphite shadow-md flex flex-col gap-4 h-full min-h-[500px]">
              <div className="flex items-center justify-between border-b border-graphite-light pb-3 shrink-0">
                <span className="text-xs font-black uppercase text-neige/90 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-menthe" /> Coach des Ventes IA
                </span>
                <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-menthe/10 text-menthe border border-menthe/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Analyser
                </span>
              </div>

              <div className="flex flex-col gap-2.5 text-xs text-neige/75 leading-relaxed font-semibold shrink-0">
                <p>
                  Le Coach IA examine les conversations récentes restées sans réponse après le closing de l&apos;agent.
                </p>
                <p className="text-[10px] text-neige/50 italic">
                  Il identifie les questions bloquantes et suggère des ajustements immédiats pour votre script de vente.
                </p>
              </div>

              <button
                onClick={handleRunCoach}
                disabled={loadingAnalysis}
                className="magnetic-btn bg-white hover:bg-menthe text-encre hover:text-neige font-black py-3 rounded-xl text-center text-xs transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {loadingAnalysis ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-menthe" />
                    <span>Lancer le diagnostic</span>
                  </>
                )}
              </button>

              {/* Analysis output container */}
              <div className="flex-1 overflow-y-auto bg-black/20 rounded-2xl p-4 border border-graphite-light/20 min-h-[250px]">
                {loadingAnalysis ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-neige/40 py-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-menthe" />
                    <span className="text-[10px] font-bold">Lecture de vos conversations...</span>
                  </div>
                ) : coachAnalysis ? (
                  <div className="text-neige/90 overflow-x-hidden">
                    {renderMarkdown(coachAnalysis)}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neige/30 text-[10px] italic py-10">
                    Cliquez sur le bouton ci-dessus pour générer l&apos;audit de closing IA.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
