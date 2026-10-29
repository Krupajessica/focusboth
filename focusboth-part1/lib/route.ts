import { NextResponse } from "next/server";
import { askAgent, askAgentOpenAI, type AgentResult } from "@/lib/agent";
import type { Job, VisaProfile } from "@/lib/types";

export const maxDuration = 60;

/**
 * Language models to try, in order. Groq (Llama 3.3 70B and gpt-oss-120b, fast and free, OpenAI-
 * compatible tool calling) comes first when GROQ_API_KEY is set; Gemini is the fallback. A retired
 * model (404), a busy one (503, 429) or a timeout falls through to the next, so one provider's bad
 * day never takes the assistant down. Every model gets the same prompt, tools and citation guard.
 */
type Candidate = { name: string; timeoutMs: number; run: (timeoutMs: number) => Promise<AgentResult> };

function candidates(question: string, ctx: Parameters<typeof askAgent>[1]): Candidate[] {
  const out: Candidate[] = [];
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    for (const model of ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) {
      out.push({ name: `groq:${model}`, timeoutMs: 20_000,
        run: (t) => askAgentOpenAI(question, ctx, { apiKey: groqKey, model, baseUrl: "https://api.groq.com/openai/v1", label: "Groq", timeoutMs: t }) });
    }
  }
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const models = [...new Set(["gemini-flash-lite-latest", process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"]
      .map((m) => (m ?? "").trim()).filter(Boolean))];
    for (const model of models) {
      out.push({ name: model, timeoutMs: 45_000, run: (t) => askAgent(question, ctx, { apiKey: geminiKey, model, timeoutMs: t }) });
    }
  }
  return out;
}

const RETRYABLE = /(Gemini|Groq) (404|408|413|429|500|502|503)|not found|not supported|decommissioned|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit|timeout|timed out|aborted/i;
const BUDGET_MS = 57_000; // stay inside Vercel's 60 s function limit

/** POST /api/ask  { question, profile, jobs } -> grounded answer with citations and a tool trace. */
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY?.trim() && !process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: "The assistant is not configured on this server (no GROQ_API_KEY or GEMINI_API_KEY)." }, { status: 503 });
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
  for (const c of candidates(question, ctx)) {
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 5_000) break;
    tried.push(c.name);
    try {
      return NextResponse.json(await c.run(Math.min(c.timeoutMs, left - 2_000)));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`ask failed with ${c.name}:`, lastError);
      errors.push(`${c.name}: ${lastError.slice(0, 90)}`);
      // A missing, busy or slow model is worth skipping past; anything else (bad request) is not.
      // A bad key only skips that provider's remaining models.
      // Any Groq failure falls back to Gemini, so adding Groq can never make the assistant worse.
      if (c.name.startsWith("groq:") || /Gemini 40[13]/.test(lastError)) continue;
      if (!RETRYABLE.test(lastError)) break;
    }
  }
  return NextResponse.json(
    {
      error: "The assistant could not answer right now.",
      // Each provider's error text (never contains a key) so the cause is visible without server logs.
      detail: errors.join(" | ").slice(0, 600),
      modelsTried: tried,
    },
    { status: 502 },
  );
}
