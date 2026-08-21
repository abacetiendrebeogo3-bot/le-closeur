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
    supabaseFollowupRuns: followupRuns
  });
}
