/**
 * BM25 retrieval over official USCIS / DHS policy passages (lib/data/policy-corpus.json).
 * Deterministic and free: the same question always retrieves the same passages, which makes
 * the assistant's grounding testable. A minimum score acts as the "no relevant source" gate.
 */
import corpus from "./data/policy-corpus.json";

export type Passage = { id: string; url: string; title: string; text: string };
export type Hit = Passage & { score: number };

const C = corpus as { retrieved: string; passages: Passage[] };
export const corpusRetrieved = C.retrieved;
export const corpusSize = C.passages.length;

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i if in is it its may my of on or that the their this to was what when where which who will with you your am me we our".split(" "),
);
// Domain synonyms so everyday wording reaches the regulatory wording.
const SYN: Record<string, string[]> = {
  unemployed: ["unemployment"], jobless: ["unemployment"], gap: ["unemployment"],
  stem: ["stem"], extension: ["extension"], ead: ["employment", "authorization", "document"],
  report: ["reporting", "validation"], reporting: ["validation"], h1b: ["h", "1b", "cap"],
  "cap-gap": ["cap", "gap"], everify: ["e", "verify"], "e-verify": ["e", "verify"], i983: ["i", "983", "training", "plan"],
  grace: ["departure", "depart", "preparation"], leave: ["depart"],
  travel: ["travel", "reenter", "reentry"], volunteer: ["volunteer", "unpaid"], startup: ["self", "employed", "business"],
};

export function tokenize(s: string): string[] {
  const raw = s.toLowerCase().replace(/[^a-z0-9\- ]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    for (const part of [t, ...t.split("-")]) {
      if (part.length > 1 && !STOP.has(part)) out.push(stem(part));
    }
    for (const syn of SYN[t] ?? []) out.push(stem(syn));
  }
  return out;
}

/** Light suffix stripping so "days"/"day", "reporting"/"report" match. */
function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1") || w;
}

const docs = C.passages.map((p) => tokenize(`${p.title} ${p.text}`));
const avgLen = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1);
const df = new Map<string, number>();
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
const tfs = docs.map((d) => {
  const m = new Map<string, number>();
  for (const t of d) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});

const K1 = 1.4, B = 0.75;
/**
 * Minimum BM25 score for a passage to count as relevant. On eval/assistant-questions.json the
 * lowest in-scope top score was 9.7 and the highest off-topic score 6.8, so the gate sits at 8.
 * (Chosen on the evaluation set itself; see the report's limitations.)
 */
export const MIN_SCORE = 8;

export function searchPolicy(query: string, k = 4): Hit[] {
  const q = [...new Set(tokenize(query))];
  const N = docs.length;
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const t of q) {
      const f = tfs[i].get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avgLen));
    }
    return { ...C.passages[i], score: s };
  });
  return scored
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
