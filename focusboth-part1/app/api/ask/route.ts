import { NextResponse } from "next/server";
import { askAgent } from "@/lib/agent";
import type { Job, VisaProfile } from "@/lib/types";

export const maxDuration = 60;

/** Gemini model names to try in order. A retired name (404) falls through to the next one. */
function candidateModels(): string[] {
  const list = [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]
    .map((m) => (m ?? "").trim())
    .filter(Boolean);
  return [...new Set(list)];
}

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
  let lastError = "";
  for (const model of candidateModels()) {
    tried.push(model);
    try {
      const result = await askAgent(question, ctx, { apiKey, model });
      return NextResponse.json(result);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`ask failed with ${model}:`, lastError);
      // Only a missing/retired model is worth retrying with the next name.
      if (!/Gemini 404|not found|not supported/i.test(lastError)) break;
    }
  }
  return NextResponse.json(
    {
      error: "The assistant could not answer right now.",
      // Google's error text (never contains the key) so the cause is visible without server logs.
      detail: lastError.slice(0, 400),
      modelsTried: tried,
    },
    { status: 502 },
  );
}
