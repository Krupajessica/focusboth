import { NextResponse } from "next/server";
import { askAgent } from "@/lib/agent";
import type { Job, VisaProfile } from "@/lib/types";

export const maxDuration = 60;

/** POST /api/ask  { question, profile, jobs } -> grounded answer with citations and a tool trace. */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
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
  try {
    const result = await askAgent(question, { profile: body.profile, jobs: Array.isArray(body.jobs) ? body.jobs : [] }, {
      apiKey, model: process.env.GEMINI_MODEL || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("ask failed", err);
    return NextResponse.json({ error: "The assistant could not answer right now. Try again in a minute." }, { status: 502 });
  }
}
