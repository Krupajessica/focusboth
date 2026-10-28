/**
 * "Ask FocusBoth": a guarded tool-calling agent (Google Gemini) with retrieval-augmented answers.
 *
 * Design rules (same as the rest of FocusBoth):
 *  - The rules engine decides; the model only explains. Visa-clock numbers come from
 *    lib/compass-engine.ts via a tool, never from the model's memory.
 *  - Policy statements must cite retrieved passages [S1], [S2]... from official sources.
 *    Citations that do not match a retrieved passage are removed; a policy question with no
 *    retrieved source gets a fixed "ask your DSO" answer instead of a model answer.
 *  - No predictions of visa outcomes, no legal advice, no therapy.
 */
import { daysUntil, jobFailures, unemploymentAllowance } from "./compass-engine";
import { searchPolicy, type Hit } from "./policy-search";
import { signalForName } from "./sponsorship";
import { wageBand } from "./soc-wages";
import { predictSoc } from "./title-model";
import type { Job, VisaProfile } from "./types";

export const NO_SOURCE_ANSWER =
  "I could not find this in the official USCIS or 8 CFR 214.2 sources I search, so I won't guess. Please ask your Designated School Official (DSO). For a question about your own case, an immigration attorney is the right person.";

const SYSTEM = `You are "Ask FocusBoth", an assistant for F-1 international students on OPT or STEM OPT.
You MUST follow these rules:
1. For any question about visa, OPT, STEM OPT, unemployment days, reporting, E-Verify, H-1B or cap-gap rules, call search_policy first and answer ONLY from the passages it returns. Cite every policy sentence with the passage tag, e.g. [S2]. Never cite a tag you were not given.
2. If search_policy returns no passages, reply exactly: NO_SOURCE.
3. For the student's own dates, remaining unemployment days, or whether a tracked job passes the FocusBoth rules, call check_my_visa_clock and report its numbers exactly. Do not compute dates yourself.
4. For an employer's H-1B sponsorship history, call lookup_employer. For what occupation or typical H-1B wage a job title maps to, call classify_job_title. Report numbers exactly as returned and name the source (U.S. DOL LCA data).
5. Never predict whether a visa, petition, or H-1B lottery will be approved, never give legal advice, and never say a person is or is not "in status". Say that the DSO or an immigration attorney must confirm.
6. If the question is unrelated to work authorization, job search, sponsorship, or the FocusBoth app (for example cooking, sports, investing, medical or mental-health treatment), politely say you can only help with OPT, STEM OPT and job-search questions. For anything about crisis or self-harm, give the U.S. 988 Suicide & Crisis Lifeline.
7. Be concise: at most 150 words, plain language, end visa answers with "Confirm with your DSO."`;

const TOOLS = [{
  functionDeclarations: [
    { name: "search_policy", description: "Search official USCIS pages and 8 CFR 214.2 for OPT / STEM OPT / cap-gap rules. Returns tagged passages to cite.",
      parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Search query in plain words" } }, required: ["query"] } },
    { name: "lookup_employer", description: "H-1B LCA filing history and FocusBoth sponsorship score for an employer name, from U.S. DOL data.",
      parameters: { type: "OBJECT", properties: { name: { type: "STRING", description: "Employer name, ideally the legal name" } }, required: ["name"] } },
    { name: "classify_job_title", description: "Map a job title to its most likely SOC occupation and the DOL entry-level (Level I) median H-1B wage.",
      parameters: { type: "OBJECT", properties: { title: { type: "STRING" } }, required: ["title"] } },
    { name: "check_my_visa_clock", description: "The student's own visa clock and rule checks from the FocusBoth rules engine: EAD end, days left, unemployment days left, reporting date, and which tracked jobs fail which rules.",
      parameters: { type: "OBJECT", properties: {} } },
  ],
}];

export type ToolTrace = { name: string; args: Record<string, unknown>; summary: string };
export type Citation = { tag: string; url: string; title: string };
export type AgentResult = { answer: string; citations: Citation[]; tools: ToolTrace[]; model: string; grounded: boolean };
export type AgentContext = { profile: VisaProfile; jobs: Job[] };

type Part = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
type Content = { role: "user" | "model"; parts: Part[] };

/** Runs one tool. Pure except for reading the bundled data files. */
export function runTool(name: string, args: Record<string, unknown>, ctx: AgentContext, hits: Map<string, Hit>) {
  if (name === "search_policy") {
    const found = searchPolicy(String(args.query ?? ""), 4);
    const passages = found.map((h) => {
      const existing = [...hits.entries()].find(([, v]) => v.id === h.id);
      const tag = existing ? existing[0] : `S${hits.size + 1}`;
      hits.set(tag, h);
      return { tag, source: h.title, text: h.text };
    });
    return { result: passages.length ? { passages } : { passages: [], note: "NO RELEVANT OFFICIAL SOURCE FOUND" },
      summary: `${passages.length} passage(s) for “${String(args.query ?? "")}”` };
  }
  if (name === "lookup_employer") {
    const s = signalForName(String(args.name ?? ""));
    return { result: s ? { found: true, ...s, sponsorScoreMeaning: "model probability (x100) of a new-hire H-1B LCA next quarter; a ranking, not a promise" }
                       : { found: false, note: "No H-1B LCA filings under this exact legal name in FY2025Q4-FY2026Q3 DOL data. The employer may file under a different legal name." },
      summary: s ? `${s.legalName}: ${s.filings} LCAs, score ${s.score}` : `no DOL record for “${String(args.name ?? "")}”` };
  }
  if (name === "classify_job_title") {
    const top = predictSoc(String(args.title ?? ""), 3);
    const result = top.map((t) => ({ soc: t.soc, occupation: t.title, probability: Math.round(t.probability * 100) / 100, entryLevelMedianH1BWage: wageBand(t.soc, "I")?.p50 ?? null }));
    return { result: { predictions: result, source: "FocusBoth M2 model trained on DOL LCA titles; wages from certified DOL LCAs" },
      summary: `${top[0]?.soc} ${top[0]?.title}` };
  }
  if (name === "check_my_visa_clock") {
    const p = ctx.profile;
    const a = unemploymentAllowance(p);
    const result = {
      visaStatus: p.visaStatus, eadEndDate: p.eadEndDate, daysUntilEadEnd: daysUntil(p.eadEndDate),
      unemploymentCap: a.cap, unemploymentDaysUsed: p.unemploymentDaysUsed, unemploymentDaysRemaining: a.remaining,
      nextReportingDate: p.nextReportingDate, daysUntilReporting: daysUntil(p.nextReportingDate),
      trackedJobs: ctx.jobs.slice(0, 12).map((j) => ({ company: j.company, role: j.role, status: j.status, failures: jobFailures(j, p) })),
      note: "Computed by the FocusBoth rules engine from dates the student entered. Not a legal determination.",
    };
    return { result, summary: `${a.remaining} unemployment days left, EAD ends ${p.eadEndDate}` };
  }
  return { result: { error: "unknown tool" }, summary: "unknown tool" };
}

/** Removes citation tags the model was never given, and returns the valid citations in order. */
export function validateCitations(text: string, hits: Map<string, Hit>): { text: string; citations: Citation[] } {
  const used: Citation[] = [];
  // Models write single tags [S1] and grouped tags [S1, S2] / [S1; S2]; both are checked tag by tag.
  const clean = text.replace(/\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\]/g, (_m, group: string) => {
    const valid = group.split(/\s*[,;]\s*/).filter((tag) => {
      const h = hits.get(tag);
      if (!h) return false;
      if (!used.find((c) => c.tag === tag)) used.push({ tag, url: h.url, title: h.title });
      return true;
    });
    return valid.map((tag) => `[${tag}]`).join("");
  });
  return { text: clean.replace(/\s+([.,;])/g, "$1").trim(), citations: used };
}

export async function askAgent(question: string, ctx: AgentContext, opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<AgentResult> {
  const model = opts.model ?? "gemini-2.5-flash";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  // Gemini 2.5 models "think" by default, which adds seconds per tool step; this task is
  // retrieval plus short synthesis, so thinking is switched off where the model allows it.
  const thinking = /^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
  const f = opts.fetchImpl ?? fetch;
  const contents: Content[] = [{ role: "user", parts: [{ text: question.slice(0, 600) }] }];
  const tools: ToolTrace[] = [];
  const hits = new Map<string, Hit>();
  let policySearched = false;
  let policyFound = false;

  for (let step = 0; step < 5; step++) {
    const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools: TOOLS,
        generationConfig: { temperature: 0.1, maxOutputTokens: 700, ...thinking } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: Content }> };
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const raw = parts.map((p) => p.text ?? "").join("").trim();
      if (raw === "NO_SOURCE" || raw.startsWith("NO_SOURCE") || (policySearched && !policyFound && /\b(OPT|STEM|EAD|H-1B|cap-gap|unemploy)/i.test(raw) && !/DSO/.test(raw))) {
        return { answer: NO_SOURCE_ANSWER, citations: [], tools, model, grounded: false };
      }
      const { text, citations } = validateCitations(raw, hits);
      return { answer: text || NO_SOURCE_ANSWER, citations, tools, model, grounded: citations.length > 0 };
    }
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls) {
      const { name, args } = c.functionCall!;
      const out = runTool(name, args ?? {}, ctx, hits);
      if (name === "search_policy") {
        policySearched = true;
        if ((out.result as { passages: unknown[] }).passages.length) policyFound = true;
      }
      tools.push({ name, args: args ?? {}, summary: out.summary });
      responses.push({ functionResponse: { name, response: out.result } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { answer: NO_SOURCE_ANSWER, citations: [], tools, model, grounded: false };
}
