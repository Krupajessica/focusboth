// Runs eval/assistant-questions.json against a deployed FocusBoth (/api/ask) and scores it.
// Usage: BASE_URL=https://your-app.vercel.app node eval/run-assistant-eval.mjs
// Writes outputs/assistant_eval.json. The API key stays on the server (Vercel env var).
import fs from "node:fs";

const base = process.env.BASE_URL;
if (!base) throw new Error("Set BASE_URL");
const qs = JSON.parse(fs.readFileSync(new URL("./assistant-questions.json", import.meta.url)));
const { demoData } = await import("./demo-profile.mjs");
const rows = [];
for (const q of qs) {
  const t0 = Date.now();
  let r, err;
  for (let attempt = 0; attempt < 3 && !r; attempt++) {
    try {
      const res = await fetch(`${base}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.q, profile: demoData.profile, jobs: demoData.jobs }) });
      const body = await res.json();
      if (res.ok) r = body; else { err = body.error; await new Promise((s) => setTimeout(s, 4000)); }
    } catch (e) { err = String(e); }
  }
  const answer = r?.answer ?? "";
  const mustOk = (q.must ?? []).every((m) => new RegExp(m, "i").test(answer));
  const cites = r?.citations ?? [];
  const citeOk = q.type !== "policy" ? null : cites.some((c) => q.expect.some((e) => c.url.includes(e) || c.title.includes(e)));
  const toolOk = q.type !== "tool" ? null : (r?.tools ?? []).some((t) => t.name === q.tool);
  const refuseOk = q.type !== "refuse" ? null : mustOk && cites.length === 0;
  rows.push({ id: q.id, type: q.type, question: q.q, ok: !!r, ms: Date.now() - t0, mustOk, citeOk, toolOk, refuseOk,
    citations: cites.map((c) => c.title), tools: (r?.tools ?? []).map((t) => t.name), answer, error: err });
  console.log(q.id, q.type, r ? "ok" : "ERR", { mustOk, citeOk, toolOk, refuseOk });
}
const rate = (xs) => xs.length ? xs.filter(Boolean).length / xs.length : null;
const by = (t) => rows.filter((r) => r.type === t);
const summary = {
  n: rows.length, answered: rate(rows.map((r) => r.ok)),
  policy_citation_accuracy: rate(by("policy").map((r) => r.citeOk)),
  policy_key_fact_present: rate(by("policy").map((r) => r.mustOk)),
  tool_selection_accuracy: rate(by("tool").map((r) => r.toolOk)),
  tool_answer_correct: rate(by("tool").map((r) => r.mustOk)),
  refusal_accuracy: rate(by("refuse").map((r) => r.refuseOk)),
  median_latency_ms: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
};
fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync("outputs/assistant_eval.json", JSON.stringify({ base, run: new Date().toISOString(), summary, rows }, null, 2));
console.log(summary);
