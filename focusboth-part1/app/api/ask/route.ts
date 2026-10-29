import { NextResponse } from "next/server";
import { askAgent } from "@/lib/agent";
import type { Job, VisaProfile } from "@/lib/types";

export const maxDuration = 60;

/**
 * Gemini model names to try in order. The model that answered every evaluation question
 * (gemini-flash-lite-latest) goes first; the others are fallbacks. A retired name (404), a busy
 * model (503, 429) or a timeout falls through to the next one, so one slow or overloaded model
 * never takes the assistant down. GEMINI_MODEL (if set) is tried second.
 */
function candidateModels(): string[] {
  const list = ["gemini-flash-lite-latest", process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash-lite",
    "gemini-2.5-flash", "gemini-2.0-flash"]
    .map((m) => (m ?? "").trim())
    .filter(Boolean);
  return [...new Set(list)];
}

const RETRYABLE = /Gemini (404|429|500|503)|not found|not supported|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|timeout|timed out|aborted/i;
const BUDGET_MS = 55_000; // stay inside Vercel's 60 s function limit
const STEP_TIMEOUT_MS = 25_000; // one Gemini call; a tool question needs two calls

/** POST /api/ask  { question, profile, jobs } -> grounded answer with citations and a tool trace. */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "The assistant is not configured on this server (GEMINI_API_KEY is missing)." }, { status: 503 });
  }
  let body: { question?: unknown; profile?: VisaProfile; jobs?: Job[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 600) {
    return NextResponse.json({ error: "Ask a question of 1 to 600 characters." }, { status: 400 });
  }
  if (!body.profile || typeof body.profile.eadEndDate !== "string") {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }

  const ctx = { profile: body.profile, jobs: Array.isArray(body.jobs) ? body.jobs : [] };
  const tried: string[] = [];
  const errors: string[] = [];
  let lastError = "";
  const start = Date.now();
  for (const model of candidateModels()) {
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 5_000) break;
    tried.push(model);
    try {
      const result = await askAgent(question, ctx, { apiKey, model, timeoutMs: Math.min(STEP_TIMEOUT_MS, left - 2_000) });
      return NextResponse.json(result);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`ask failed with ${model}:`, lastError);
      errors.push(`${model}: ${lastError.slice(0, 90)}`);
      // Missing, busy or slow models are worth trying the next name; anything else
      // (bad key, bad request) would fail the same way on every model.
      if (!RETRYABLE.test(lastError)) break;
    }
  }
  return NextResponse.json(
    {
      error: "The assistant could not answer right now.",
      // Google's error text (never contains the key) so the cause is visible without server logs.
      detail: errors.join(" | ").slice(0, 600),
      modelsTried: tried,
    },
    { status: 502 },
  );
}
