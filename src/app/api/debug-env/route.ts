import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const models = [
  "claude-sonnet-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-haiku-20240307",
  "claude-3-opus-20240229",
  "claude-3-5-haiku-20241022"
];

async function testModel(apiKey: string, model: string) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }]
      })
    });

    const data = await response.json();
    if (response.ok) {
      return { model, status: "SUCCESS", message: "200 OK" };
    } else {
      return { model, status: "FAILED", code: response.status, error: data.error?.message || data };
    }
  } catch (err: any) {
    return { model, status: "ERROR", message: err.message };
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY is not configured in Vercel environment variables.",
      instructions: "Please add ANTHROPIC_API_KEY to Vercel dashboard and redeploy."
    }, { status: 400 });
  }

  // Fetch actual allowed models from Anthropic
  let allowedModelsList: any = null;
  try {
    const modelsResponse = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    allowedModelsList = await modelsResponse.json();
  } catch (err: any) {
    allowedModelsList = { error: err.message };
  }

  // Fetch last 10 messages from Supabase
  let lastMessages: any = null;
  try {
    const { data, error } = await supabaseServer
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      lastMessages = { error: error.message };
    } else {
      lastMessages = data;
    }
  } catch (err: any) {
    lastMessages = { error: err.message };
  }

  // Check if followup_runs exists
  let followupRuns: any = null;
  try {
    const { data, error } = await supabaseServer
      .from("followup_runs")
      .select("*")
      .limit(5);
    if (error) {
      followupRuns = { error: error.message };
    } else {
      followupRuns = data;
    }
  } catch (err: any) {
    followupRuns = { error: err.message };
  }

  // Fetch all conversations
  let allConversations: any = null;
  try {
    const { data, error } = await supabaseServer
      .from("conversations")
      .select("*");
    if (error) {
      allConversations = { error: error.message };
    } else {
      allConversations = data;
    }
  } catch (err: any) {
    allConversations = { error: err.message };
  }

  // Fetch all businesses
  let allBusinesses: any = null;
  try {
    const { data, error } = await supabaseServer
      .from("businesses")
      .select("*");
    if (error) {
      allBusinesses = { error: error.message };
    } else {
      allBusinesses = data;
    }
  } catch (err: any) {
    allBusinesses = { error: err.message };
  }

  // Fetch all business members
  let allMembers: any = null;
  try {
    const { data, error } = await supabaseServer
      .from("business_members")
      .select("*");
    if (error) {
      allMembers = { error: error.message };
    } else {
      allMembers = data;
    }
  } catch (err: any) {
    allMembers = { error: err.message };
  }

  // Fetch all auth users
  let allUsers: any = null;
  try {
    const authClient = require("@supabase/supabase-js").createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'auth' } }
    );
    const { data, error } = await authClient
      .from("users")
      .select("id, email, created_at");
    if (error) {
      allUsers = { error: error.message };
    } else {
      allUsers = data;
    }
  } catch (err: any) {
    allUsers = { error: err.message };
  }

  const results = [];
  for (const model of models) {
    const res = await testModel(apiKey, model);
    results.push(res);
  }

  return NextResponse.json({
    message: "Anthropic model connectivity diagnostic results",
    apiKeyConfigured: true,
    apiKeyLength: apiKey.length,
    allowedModelsFromAPI: allowedModelsList,
    results: results,
    supabaseLastMessages: lastMessages,
    supabaseFollowupRuns: followupRuns,
    supabaseConversations: allConversations,
    supabaseBusinesses: allBusinesses,
    supabaseMembers: allMembers,
    supabaseUsers: allUsers
  });
}
