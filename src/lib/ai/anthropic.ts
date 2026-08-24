import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder-anthropic-key",
});

export const CLAUDE_MODEL = "claude-sonnet-5";
export const CLAUDE_MODEL_LIGHT = "claude-haiku-4-5-20251001";
