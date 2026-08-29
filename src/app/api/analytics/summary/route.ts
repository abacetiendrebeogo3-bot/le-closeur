import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const period = searchParams.get("period") || "week"; // day | week | month

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 });
    }

    const now = new Date();
    let startDate = new Date();
    if (period === "day") {
      startDate.setDate(now.getDate() - 1);
    } else if (period === "week") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setDate(now.getDate() - 30);
    }
    const startDateStr = startDate.toISOString();

    // 1. Fetch messages for the business
    const { data: allMessages, error: msgsError } = await supabaseServer
      .from("messages")
      .select("conversation_id, sender, created_at, conversations!inner(business_id)")
      .eq("conversations.business_id", businessId)
      .order("created_at", { ascending: true });

    if (msgsError) throw msgsError;

    // Filter messages for the selected period
    const periodCustomerMessages = (allMessages || []).filter((m: any) => {
      return m.sender === "customer" && new Date(m.created_at) >= startDate;
    });

    const uniqueConvIds = new Set(periodCustomerMessages.map((m: any) => m.conversation_id));
    const nb_conversations = uniqueConvIds.size;
    const nb_messages = periodCustomerMessages.length;

    // 2. Fetch orders in the selected period
    const { data: periodOrders, error: ordersError } = await supabaseServer
      .from("orders")
      .select("id, created_at")
      .eq("business_id", businessId)
      .gte("created_at", startDateStr);

    if (ordersError) throw ordersError;
    const nb_commandes = periodOrders ? periodOrders.length : 0;

    const taux_conversion = nb_conversations > 0 ? Math.round((nb_commandes / nb_conversations) * 100) : 0;

    // 3. Calculate silent conversations (last message is 'ai' and created > 24 hours ago)
    const latestMessageByConv: { [key: number]: { sender: string; created_at: string } } = {};
    for (const msg of (allMessages || [])) {
      latestMessageByConv[msg.conversation_id] = {
        sender: msg.sender,
        created_at: msg.created_at
      };
    }

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let nb_silencieuses = 0;

    for (const latestMsg of Object.values(latestMessageByConv)) {
      const msgDate = new Date(latestMsg.created_at);
      if (latestMsg.sender === "ai" && msgDate < cutoff24h) {
        nb_silencieuses++;
      }
    }

    const taux_abandon = nb_conversations > 0 ? Math.round((nb_silencieuses / nb_conversations) * 100) : 0;

    // 4. Calculate 30-day historical chart data
    const chartStartDate = new Date();
    chartStartDate.setDate(now.getDate() - 30);

    const { data: allOrders30Days, error: orders30Error } = await supabaseServer
      .from("orders")
      .select("id, created_at")
      .eq("business_id", businessId)
      .gte("created_at", chartStartDate.toISOString());

    if (orders30Error) throw orders30Error;

    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      
      const dayMsgs = (allMessages || []).filter((m: any) => {
        const mDate = new Date(m.created_at);
        return m.sender === "customer" && mDate >= startOfDay && mDate <= endOfDay;
      });
      const dayConvCount = new Set(dayMsgs.map((m: any) => m.conversation_id)).size;

      const dayOrders = (allOrders30Days || []).filter((o: any) => {
        const oDate = new Date(o.created_at);
        return oDate >= startOfDay && oDate <= endOfDay;
      });
      const dayOrderCount = dayOrders.length;
      const dayConversionRate = dayConvCount > 0 ? Math.round((dayOrderCount / dayConvCount) * 100) : 0;

      chartData.push({
        date: startOfDay.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        conversations: dayConvCount,
        conversionRate: dayConversionRate
      });
    }

    return NextResponse.json({
      nb_conversations,
      nb_messages,
      nb_commandes,
      taux_conversion,
      nb_silencieuses,
      taux_abandon,
      chartData
    });
  } catch (err: any) {
    console.error("Summary Analytics API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
