import React, { useEffect, useState, useRef, useCallback } from "react";
import { 
  ShoppingBag, 
  UserCheck, 
  Database, 
  Settings, 
  ArrowUpRight, 
  TrendingUp, 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Send,
  Plus
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie 
} from "recharts";
import { gsap } from "gsap";
import { Order } from "../../types";

interface DashboardViewProps {
  orders: Order[];
  formatFCFA: (val: number) => string;
  orderBadges: Record<string, React.ReactNode>;
  paymentBadges: Record<string, React.ReactNode>;
  onViewOrder: (id: string) => void;
  onNavigateToSettings: () => void;
  onNavigateToOrders: () => void;
  onNavigateToConversations?: () => void;
}

// Yearly overview data
const yearlyData = [
  { name: "Juil", montant: 1800000, percentage: "+10%" },
  { name: "Août", montant: 2900000, percentage: "+15%", isCurrent: true },
  { name: "Sept", montant: 1500000, percentage: "-5%" },
  { name: "Oct", montant: 2200000, percentage: "+8%" },
  { name: "Nov", montant: 2400000, percentage: "+12%" },
  { name: "Déc", montant: 3100000, percentage: "+20%" },
  { name: "Jan", montant: 1900000, percentage: "-8%" },
  { name: "Fév", montant: 2100000, percentage: "+5%" },
  { name: "Mar", montant: 2800000, percentage: "+14%" },
  { name: "Avr", montant: 3500000, percentage: "+25%" },
  { name: "Mai", montant: 2700000, percentage: "-10%" },
  { name: "Juin", montant: 3200000, percentage: "+18%" }
];

// Weekly overview data
const weeklyData = [
  { name: "Lun", montant: 450000, percentage: "+5%" },
  { name: "Mar", montant: 650000, percentage: "+8%" },
  { name: "Mer", montant: 300000, percentage: "-12%" },
  { name: "Jeu", montant: 850000, percentage: "+15%" },
  { name: "Ven", montant: 1200000, percentage: "+22%", isCurrent: true },
  { name: "Sam", montant: 950000, percentage: "+12%" },
  { name: "Dim", montant: 580000, percentage: "-3%" }
];

// Monthly overview data (Weeks of the month)
const monthlyData = [
  { name: "Sem 1", montant: 1200000, percentage: "+8%" },
  { name: "Sem 2", montant: 1900000, percentage: "+14%" },
  { name: "Sem 3", montant: 2400000, percentage: "+18%", isCurrent: true },
  { name: "Sem 4", montant: 1500000, percentage: "-4%" }
];

// Custom range/quarter overview data
const periodData = [
  { name: "T1", montant: 6500000, percentage: "+10%" },
  { name: "T2", montant: 7800000, percentage: "+12%" },
  { name: "T3", montant: 9200000, percentage: "+18%", isCurrent: true },
  { name: "T4", montant: 8400000, percentage: "+8%" }
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  formatFCFA,
  orderBadges,
  paymentBadges,
  onViewOrder,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToConversations
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [activePeriod, setActivePeriod] = useState<"weekly" | "monthly" | "yearly" | "period">("yearly");

  // Dynamic Chart Data Calculation
  const refDate = orders.length > 0 
    ? new Date(orders.map(o => o.date).sort().pop() || "") 
    : new Date();
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth(); // 0-indexed

  // 1. Yearly data (last 12 months ending at refMonth/refYear)
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  const dynamicYearlyData = Array.from({ length: 12 }).map((_, idx) => {
    // 11 months ago to current month
    const d = new Date(refYear, refMonth - 11 + idx, 1);
    const mName = monthNames[d.getMonth()];
    const totalAmount = orders
      .filter(o => {
        if (!o.date || !o.date.includes("-")) return false;
        const [oy, om] = o.date.split("-").map(Number);
        return oy === d.getFullYear() && om === (d.getMonth() + 1);
      })
      .reduce((sum, o) => sum + o.total, 0);

    return {
      name: mName,
      montant: totalAmount,
      percentage: "",
      isCurrent: d.getMonth() === refMonth && d.getFullYear() === refYear
    };
  });

  // 2. Weekly data (Monday to Sunday of the refDate week)
  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };
  const monday = getMonday(refDate);
  const dynamicWeeklyData = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((dayName, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const totalAmount = orders
      .filter(o => {
        if (!o.date || !o.date.includes("-")) return false;
        const [oy, om, od] = o.date.split("-").map(Number);
        return oy === d.getFullYear() && om === (d.getMonth() + 1) && od === d.getDate();
      })
      .reduce((sum, o) => sum + o.total, 0);

    return {
      name: dayName,
      montant: totalAmount,
      percentage: "",
      isCurrent: d.getDate() === refDate.getDate() && d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
    };
  });

  // 3. Monthly data (Weeks of the refMonth)
  const dynamicMonthlyData = [
    { name: "Sem 1", start: 1, end: 7 },
    { name: "Sem 2", start: 8, end: 14 },
    { name: "Sem 3", start: 15, end: 21 },
    { name: "Sem 4", start: 22, end: 31 }
  ].map(w => {
    const totalAmount = orders
      .filter(o => {
        if (!o.date || !o.date.includes("-")) return false;
        const [oy, om, od] = o.date.split("-").map(Number);
        return oy === refYear && om === (refMonth + 1) && od >= w.start && od <= w.end;
      })
      .reduce((sum, o) => sum + o.total, 0);

    const isCurrentWeek = refDate.getDate() >= w.start && refDate.getDate() <= w.end;
    return {
      name: w.name,
      montant: totalAmount,
      percentage: "",
      isCurrent: isCurrentWeek
    };
  });

  // 4. Period data (Quarters of refYear)
  const dynamicPeriodData = [
    { name: "T1", months: [1, 2, 3] },
    { name: "T2", months: [4, 5, 6] },
    { name: "T3", months: [7, 8, 9] },
    { name: "T4", months: [10, 11, 12] }
  ].map(q => {
    const totalAmount = orders
      .filter(o => {
        if (!o.date || !o.date.includes("-")) return false;
        const [oy, om] = o.date.split("-").map(Number);
        return oy === refYear && q.months.includes(om);
      })
      .reduce((sum, o) => sum + o.total, 0);

    const isCurrentQuarter = q.months.includes(refMonth + 1);
    return {
      name: q.name,
      montant: totalAmount,
      percentage: "",
      isCurrent: isCurrentQuarter
    };
  });

  const currentChartData = activePeriod === "weekly" ? dynamicWeeklyData
    : activePeriod === "monthly" ? dynamicMonthlyData
    : activePeriod === "period" ? dynamicPeriodData
    : dynamicYearlyData;

  const [selectedBar, setSelectedBar] = useState<any>(null);
  const [chatInput, setChatInput] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(refDate.getDate());

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selected bar whenever active period or orders list changes
  useEffect(() => {
    const currentItem = currentChartData.find(d => d.isCurrent) || currentChartData[0];
    setSelectedBar(currentItem);
  }, [activePeriod, orders, currentChartData]);

  // GSAP Animations on entry
  useEffect(() => {
    setIsMounted(true);
    
    if (containerRef.current) {
      const ctx = gsap.context(() => {
        // Staggered fade up for stat cards
        gsap.from(".stat-card", {
          opacity: 0,
          y: 20,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out"
        });

        // Staggered slide/fade up for grid cards
        gsap.from(".grid-card", {
          opacity: 0,
          y: 30,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          delay: 0.2
        });

        // Soft entry for visual tags/text
        gsap.from(".animated-text", {
          opacity: 0,
          x: -15,
          duration: 0.5,
          stagger: 0.08,
          ease: "power3.out",
          delay: 0.1
        });
      }, containerRef.current);

      return () => ctx.revert();
    }
  }, [isMounted]);

  const totalBilled = orders.reduce((acc, o) => acc + o.total, 0);
  const totalPaid = orders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);
  const totalPending = orders.filter(o => o.status !== "paid" && o.status !== "cancelled").reduce((acc, o) => acc + o.total, 0);

  // Group orders by delivery zone for the Donut Chart
  const zoneStats = orders.reduce((acc: Record<string, number>, o) => {
    const zone = o.deliveryZone || "Autre";
    acc[zone] = (acc[zone] || 0) + o.total;
    return acc;
  }, {});

  // Convert to chart array format
  const donutColors = ["#16A34A", "#1C1C1E", "#3A3A3C", "#84CC16", "#A3E635", "#E2E8F0"];
  const donutData = Object.entries(zoneStats).map(([name, value], idx) => ({
    name,
    value,
    color: donutColors[idx % donutColors.length]
  }));

  // Dynamically generate calendar days for refYear and refMonth (Mon-Sun layout)
  const getCalendarDays = () => {
    const firstDayIndex = new Date(refYear, refMonth, 1).getDay(); // 0 is Sunday, 1 is Monday...
    const emptySlots = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDays = new Date(refYear, refMonth + 1, 0).getDate();

    const days: (number | null)[] = Array(emptySlots).fill(null);
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  };
  const calendarDays = getCalendarDays();

  // Check if a day has orders
  const getDayOrders = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${refYear}-${(refMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return orders.filter(o => o.date === dateStr);
  };

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      setSelectedBar(data.activePayload[0].payload);
    }
  };

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatInput("");
    if (onNavigateToConversations) {
      onNavigateToConversations();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-6 text-encre bg-neige">
      
      {/* Top statistics summary bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card bg-white p-5 rounded-[1.5rem] border border-graphite/5 shadow-sm flex items-center justify-between hover:scale-[1.01] hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-encre/40">Commandes Enregistrées</span>
            <div className="text-2xl font-black text-encre mt-1 tabular-nums">{orders.length}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe/10 flex items-center justify-center text-menthe">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card bg-white p-5 rounded-[1.5rem] border border-graphite/5 shadow-sm flex items-center justify-between hover:scale-[1.01] hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-encre/40">Total Facturé (CA global)</span>
            <div className="text-2xl font-black text-encre mt-1 tabular-nums">{formatFCFA(totalBilled)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-encre/5 flex items-center justify-center text-encre">
            <span className="text-xs font-black">XOF</span>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-menthe/[0.04] via-white to-white p-5 rounded-[1.5rem] border border-menthe/20 shadow-sm flex items-center justify-between hover:scale-[1.01] hover:shadow-md transition-all duration-300">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-black text-menthe">Clôturé & Encaissé</span>
            <div className="text-2xl font-black text-encre mt-1 tabular-nums">{formatFCFA(totalPaid)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-menthe text-white flex items-center justify-center shadow-sm">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Row 1: Revenue Main Chart & Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Revenue Bar Chart (2/3 width) */}
        <div className="grid-card lg:col-span-2 bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-encre/40">Vue d&apos;ensemble</span>
              <h2 className="text-xl font-black text-encre tracking-tight mt-0.5 animated-text">Revenus & Volumes</h2>
            </div>
            
            {/* Filter Toggle pills */}
            <div className="flex items-center bg-neige p-1 rounded-full border border-graphite/5 self-start text-xs font-bold text-encre/60">
              <button 
                onClick={() => setActivePeriod("weekly")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  activePeriod === "weekly" 
                    ? "bg-white text-encre shadow-sm border border-graphite/5 font-black" 
                    : "hover:text-encre"
                }`}
              >
                Hebdo
              </button>
              <button 
                onClick={() => setActivePeriod("monthly")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  activePeriod === "monthly" 
                    ? "bg-white text-encre shadow-sm border border-graphite/5 font-black" 
                    : "hover:text-encre"
                }`}
              >
                Mensuel
              </button>
              <button 
                onClick={() => setActivePeriod("yearly")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  activePeriod === "yearly" 
                    ? "bg-white text-encre shadow-sm border border-graphite/5 font-black" 
                    : "hover:text-encre"
                }`}
              >
                Annuel
              </button>
              <button 
                onClick={() => setActivePeriod("period")}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  activePeriod === "period" 
                    ? "bg-white text-encre shadow-sm border border-graphite/5 font-black" 
                    : "hover:text-encre"
                }`}
              >
                Période
              </button>
            </div>
          </div>

          {/* Metric Highlight under Title */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-black tracking-tight text-encre tabular-nums transition-all duration-300">
              {formatFCFA(selectedBar?.montant || totalBilled)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] bg-menthe/10 text-menthe px-2.5 py-0.5 rounded-full font-bold transition-all duration-300">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{selectedBar?.percentage || "+12%"}</span>
            </span>
            <span className="text-xs text-encre/40 ml-1">vs période préc. ({selectedBar?.name})</span>
          </div>

          {/* Recharts Custom Bar Chart */}
          <div className="w-full h-64 relative text-[10px] mt-2">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={currentChartData} 
                  margin={{ top: 15, right: 5, left: -20, bottom: 5 }}
                  onClick={handleBarClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F4" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    tickLine={false} 
                    axisLine={false} 
                    className="font-semibold"
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${v / 1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(28, 28, 30, 0.03)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-encre text-white px-3.5 py-2.5 rounded-xl shadow-xl flex flex-col gap-1 border border-graphite">
                            <span className="text-[10px] font-black text-white/50 uppercase">{data.name}</span>
                            <span className="text-xs font-bold">{formatFCFA(data.montant)}</span>
                            <span className="text-[10px] text-menthe font-bold">{data.percentage} de croissance</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="montant" 
                    radius={[8, 8, 0, 0]} 
                    barSize={activePeriod === "weekly" ? 38 : activePeriod === "monthly" ? 54 : 28}
                  >
                    {currentChartData.map((entry, index) => {
                      const isSelected = entry.name === selectedBar?.name;
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={isSelected ? "#16A34A" : "#1C1C1E"} 
                          fillOpacity={isSelected ? 1.0 : 0.08}
                          className="transition-all duration-300 cursor-pointer"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-neige rounded-2xl animate-pulse" />
            )}
          </div>
        </div>

        {/* Right Side: Calendar & Mini Spark Metric (1/3 width) */}
        <div className="flex flex-col gap-6">
          
          {/* Calendar Widget */}
          <div className="grid-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-encre uppercase tracking-wider animated-text">
                {monthNames[refMonth]} {refYear}
              </span>
              <div className="flex items-center gap-1">
                <button className="p-1 hover:bg-neige rounded-lg border border-graphite/5 text-encre/70 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1 hover:bg-neige rounded-lg border border-graphite/5 text-encre/70 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 text-center gap-1.5 text-[10px] font-bold text-encre/40 mb-2">
              <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-[11px]">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                const dayOrders = getDayOrders(day);
                const hasOrders = dayOrders.length > 0;
                const isSelected = day === selectedCalendarDay;
                
                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setSelectedCalendarDay(day)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center font-bold transition-all relative ${
                      isSelected 
                        ? 'bg-menthe text-white shadow-sm scale-105' 
                        : hasOrders
                          ? 'bg-menthe/10 text-menthe border border-menthe/20 hover:bg-menthe/20'
                          : 'hover:bg-neige text-encre/80'
                    }`}
                  >
                    <span>{day}</span>
                    {hasOrders && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 bg-menthe rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick list of orders for the selected day */}
            <div className="mt-4 pt-4 border-t border-graphite/5 min-h-[50px] flex flex-col gap-2">
              <span className="text-[9px] uppercase tracking-widest font-black text-encre/40">Commandes du jour</span>
              {selectedCalendarDay && getDayOrders(selectedCalendarDay).length > 0 ? (
                getDayOrders(selectedCalendarDay).map(o => (
                  <div 
                    key={o.id}
                    onClick={() => onViewOrder(o.id)}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-neige border border-graphite/5 hover:border-menthe/30 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-encre">{o.customer}</span>
                      <span className="text-[10px] text-encre/50">{o.id}</span>
                    </div>
                    <span className="font-extrabold text-menthe tabular-nums">{formatFCFA(o.total)}</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-encre/40 italic py-1">Aucune transaction ce jour.</div>
              )}
            </div>
          </div>

          {/* Today's Stats Box */}
          <div className="grid-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow duration-300">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-encre/40">Closing de la Semaine</span>
              <span className="text-2xl font-black text-encre tabular-nums">{formatFCFA(orders.slice(0, 2).reduce((a, b) => a + b.total, 0))}</span>
              <span className="text-[10px] text-menthe font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +12.4% vs moy.
              </span>
            </div>
            <div className="w-16 h-8 flex items-end">
              {/* Micro Sparkline */}
              <div className="flex items-end gap-1 h-full w-full">
                <div className="w-2.5 h-[20%] bg-encre/10 rounded-full"></div>
                <div className="w-2.5 h-[40%] bg-encre/10 rounded-full"></div>
                <div className="w-2.5 h-[30%] bg-encre/10 rounded-full"></div>
                <div className="w-2.5 h-[70%] bg-encre/10 rounded-full"></div>
                <div className="w-2.5 h-[90%] bg-menthe rounded-full"></div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Row 2: AI Companion, Zone Donut, Latest Orders with Closing score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Widget 1: How can I help you? (AI Chat Summary & Quick stats) */}
        <div className="grid-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between min-h-[380px] hover:shadow-md transition-shadow duration-300">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-menthe/10 flex items-center justify-center text-menthe">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-encre">Assistant Mon Closeur</span>
              </div>
              <span className="text-[9px] font-bold bg-menthe text-white px-2 py-0.5 rounded-full uppercase">Actif</span>
            </div>
            
            <h3 className="text-base font-black text-encre mt-1 animated-text">Comment puis-je vous aider ?</h3>
            
            <div className="bg-neige p-4 rounded-2xl border border-graphite/5 text-xs text-encre/70 leading-relaxed">
              <span className="font-bold text-encre block mb-1">Résumé IA :</span>
              L&apos;activité financière de cette période reste stable. Le volume d&apos;affaires montre des variations saines avec un closing automatique de 78.5% sur WhatsApp. Aucun retard de livraison majeur.
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-neige px-3 py-2 rounded-xl border border-graphite/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase tracking-wider text-encre/40 font-bold">Relances Automatiques</span>
                <span className="text-xs font-extrabold text-encre">7 Actives</span>
              </div>
              <div className="bg-neige px-3 py-2 rounded-xl border border-graphite/5 flex flex-col gap-0.5">
                <span className="text-[8px] uppercase tracking-wider text-encre/40 font-bold">Fiches WhatsApp</span>
                <span className="text-xs font-extrabold text-menthe">25 Traitées</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSendPrompt} className="relative mt-4">
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Posez-moi une question sur le business..."
              className="w-full bg-neige text-xs text-encre placeholder:text-encre/30 pl-4 pr-10 py-3 rounded-xl border border-graphite/5 focus:outline-none focus:border-menthe/50 transition-all font-semibold"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-menthe hover:bg-menthe/10 rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Widget 2: Spending/Revenue Donut Chart */}
        <div className="grid-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between min-h-[380px] hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-encre/40 font-bold">Données Logistiques</span>
              <h3 className="text-base font-black text-encre tracking-tight mt-0.5 animated-text">Répartition par Zone</h3>
            </div>
            <span className="text-[9px] font-black uppercase text-encre/40 bg-neige px-2.5 py-1 rounded-lg border border-graphite/5">30 jours</span>
          </div>

          {/* Donut graphic */}
          <div className="w-full h-44 relative flex items-center justify-center">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="bg-white border border-graphite/10 px-3 py-2 rounded-xl shadow-md text-xs font-bold">
                            <span className="text-encre">{data.name}: </span>
                            <span className="text-menthe">{formatFCFA(Number(data.value))}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-neige border-t-menthe animate-spin" />
            )}
            
            {/* Donut Center Label */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase font-bold text-encre/30">Total</span>
              <span className="text-sm font-black text-encre tabular-nums">{formatFCFA(totalBilled)}</span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-encre/70 mt-2">
            {donutData.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="truncate">{d.name}</span>
                <span className="text-encre/40 font-medium ml-auto">
                  {((d.value / totalBilled) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-encre/40 italic text-center mt-2">
            La majorité des transactions se concentrent sur {donutData[0]?.name || "Almadies"}.
          </p>
        </div>

        {/* Widget 3: Invoices, Invoice List, & Closing Score bar */}
        <div className="grid-card bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col justify-between min-h-[380px] hover:shadow-md transition-shadow duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-black text-encre/40 font-bold">Cycle de Facturation</span>
                <h3 className="text-base font-black text-encre tracking-tight mt-0.5 animated-text">Dernières Factures</h3>
              </div>
              <button 
                onClick={onNavigateToOrders}
                className="w-7 h-7 rounded-lg bg-neige hover:bg-menthe/10 hover:text-menthe border border-graphite/5 flex items-center justify-center transition-all text-encre/60"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Closing Score indicator (battery style) */}
            <div className="bg-neige p-3 rounded-2xl border border-graphite/5 mb-4">
              <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                <span className="text-encre/50 uppercase">Score de Closing</span>
                <span className="text-menthe font-extrabold">78.5%</span>
              </div>
              
              {/* Segments progress bar */}
              <div className="flex gap-1 h-2 w-full">
                {Array.from({ length: 20 }).map((_, idx) => {
                  const isActive = idx < 16; // 80% approximately
                  return (
                    <div 
                      key={idx}
                      className={`flex-1 rounded-sm transition-all duration-500 ${
                        isActive 
                          ? idx < 6 
                            ? 'bg-amber-400' 
                            : 'bg-menthe' 
                          : 'bg-encre/10'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Invoices list */}
            <div className="flex flex-col gap-3">
              {orders.slice(0, 3).map(order => (
                <div 
                  key={order.id} 
                  onClick={() => onViewOrder(order.id)}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl hover:bg-neige border border-transparent hover:border-graphite/5 transition-all cursor-pointer hover:scale-[1.01] duration-300"
                >
                  <div className="flex flex-col">
                    <span className="font-extrabold text-encre">{order.customer}</span>
                    <span className="text-[10px] text-encre/40">{new Date(order.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {orderBadges[order.status]}
                    <span className="font-extrabold text-encre tabular-nums">{formatFCFA(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={onNavigateToOrders}
            className="w-full text-center text-[11px] font-black text-menthe hover:underline mt-4 flex items-center justify-center gap-1"
          >
            <span>Voir toutes les factures</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
