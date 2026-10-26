import { describe, expect, it } from "vitest";
import questions from "../eval/assistant-questions.json";
import { askAgent, NO_SOURCE_ANSWER, validateCitations } from "../lib/agent";
import { searchPolicy, type Hit } from "../lib/policy-search";
import { demoData } from "../lib/demo-data";

const ctx = { profile: demoData.profile, jobs: demoData.jobs };

describe("retrieval (no LLM needed)", () => {
  const policy = questions.filter((q) => q.type === "policy");
  it.each(policy.map((q) => [q.id, q] as const))("%s retrieves an expected source in the top 4", (_id, q) => {
    const hits = searchPolicy(q.q, 4);
    expect(hits.some((h) => q.expect!.some((e) => h.url.includes(e) || h.title.includes(e)))).toBe(true);
  });
  it("off-topic questions retrieve nothing", () => {
    expect(searchPolicy("What is the best pizza place in San Francisco?")).toEqual([]);
    expect(searchPolicy("Which stocks should I buy with my first paycheck?")).toEqual([]);
  });
});

describe("guardrails", () => {
  it("strips citation tags that were never retrieved", () => {
    const hits = new Map<string, Hit>([["S1", { id: "1", url: "https://x", title: "T", text: "t", score: 9 }]]);
    const r = validateCitations("Rule A [S1]. Invented rule [S7].", hits);
    expect(r.text).toBe("Rule A [S1]. Invented rule.");
    expect(r.citations.map((c) => c.tag)).toEqual(["S1"]);
  });

  /** Fake Gemini: first asks for search_policy, then answers with one real and one fake tag. */
  function fakeGemini(finalText: string, query = "unemployment days STEM OPT"): typeof fetch {
    let call = 0;
    return (async () => {
      call += 1;
      const parts = call === 1 ? [{ functionCall: { name: "search_policy", args: { query } } }] : [{ text: finalText }];
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts } }] }), { status: 200 });
    }) as typeof fetch;
  }

  it("returns grounded answer with valid citations only", async () => {
    const r = await askAgent("unemployment?", ctx, { apiKey: "test", fetchImpl: fakeGemini("You can have 150 days [S1] and 999 days [S9]. Confirm with your DSO.") });
    expect(r.grounded).toBe(true);
    expect(r.citations[0].tag).toBe("S1");
    expect(r.answer).not.toContain("[S9]");
    expect(r.tools[0].name).toBe("search_policy");
  });

  it("falls back to the DSO answer when the model says NO_SOURCE", async () => {
    const r = await askAgent("x", ctx, { apiKey: "test", fetchImpl: fakeGemini("NO_SOURCE", "pizza") });
    expect(r.answer).toBe(NO_SOURCE_ANSWER);
    expect(r.grounded).toBe(false);
  });
});
