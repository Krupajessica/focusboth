/**
 * Job title -> SOC occupation classifier (model M2), trained in analytics/models.py and
 * exported by analytics/export_title_model.py. TF-IDF (1-2 grams, sublinear tf, l2 norm)
 * followed by multinomial logistic regression, re-implemented here so it runs on the server.
 */
import model from "./data/title-model.json";

type TitleModel = {
  heldOutTop1Accuracy: number;
  classes: string[];
  socTitles: Record<string, string>;
  vocab: Record<string, number>;
  idf: number[];
  coef: number[][];
  intercept: number[];
};
const m = model as TitleModel;

export type SocPrediction = { soc: string; title: string; probability: number };

/** Same cleaning as clean_title() in analytics/models.py. */
export function cleanTitle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function vectorize(title: string): Map<number, number> {
  const tokens = cleanTitle(title).match(/\b\w\w+\b/g) ?? []; // sklearn default token_pattern
  const terms = [...tokens];
  for (let i = 0; i + 1 < tokens.length; i++) terms.push(`${tokens[i]} ${tokens[i + 1]}`);
  const counts = new Map<number, number>();
  for (const t of terms) {
    const idx = m.vocab[t];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  let norm = 0;
  const vec = new Map<number, number>();
  for (const [idx, tf] of counts) {
    const w = (1 + Math.log(tf)) * m.idf[idx];
    vec.set(idx, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [idx, w] of vec) vec.set(idx, w / norm);
  return vec;
}

/** Top-k SOC predictions with softmax probabilities. */
export function predictSoc(title: string, k = 3): SocPrediction[] {
  const x = vectorize(title);
  const scores = m.intercept.map((b, c) => {
    let s = b;
    for (const [idx, w] of x) s += m.coef[c][idx] * w;
    return s;
  });
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps
    .map((e, c) => ({ soc: m.classes[c], title: m.socTitles[m.classes[c]], probability: e / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, k);
}

export const titleModelAccuracy = m.heldOutTop1Accuracy;
