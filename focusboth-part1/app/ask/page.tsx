"use client";

import { FormEvent, useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { PageHead, Status } from "@/components/ui";
import type { AgentResult } from "@/lib/agent";

const EXAMPLES = [
  "How many days can I be unemployed on STEM OPT?",
  "Does Stripe sponsor H-1B visas?",
  "Which of my tracked jobs fail the visa rules, and why?",
  "What occupation is a 'Senior Analytics Engineer' and what does it pay on H-1B?",
  "How often do I have to report to my DSO on STEM OPT?",
];

type Turn = { question: string; result?: AgentResult; error?: string };

export default function AskPage() {
  const { data } = useCompassStore();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuestion("");
    setTurns((t) => [{ question: text }, ...t]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, profile: data.profile, jobs: data.jobs }),
      });
      const payload = await res.json();
      setTurns((t) => [{ question: text, ...(res.ok ? { result: payload as AgentResult } : { error: payload.error ?? "Request failed" }) }, ...t.slice(1)]);
    } catch {
      setTurns((t) => [{ question: text, error: "Network error. Try again." }, ...t.slice(1)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content">
      <PageHead
        eyebrow="Ask FocusBoth"
        title="Answers with sources, not guesses."
        description="An AI assistant that answers OPT and STEM OPT questions only from official USCIS pages and 8 CFR 214.2, and uses FocusBoth's own data and rules for your dates and employers."
      />

      <section className="card" style={{ marginBottom: 18 }}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(question); }} className="actions" style={{ alignItems: "stretch" }}>
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Ask about OPT, STEM OPT, an employer, or your tracked jobs…"
            value={question} maxLength={600} onChange={(e) => setQuestion(e.target.value)} aria-label="Your question" />
          <button className="btn primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
        </form>
        <div className="filter-row" style={{ marginTop: 12 }}>
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="filter" disabled={busy} onClick={() => void ask(q)}>{q}</button>
          ))}
        </div>
        <p className="notice" style={{ marginTop: 10 }}>
          Not legal advice. FocusBoth never predicts visa outcomes; confirm anything about your own case with your DSO. In a crisis in the U.S., call or text 988.
        </p>
      </section>

      {turns.map((t, i) => (
        <section className="card" key={`${t.question}-${turns.length - i}`} style={{ marginBottom: 14 }}>
          <div className="eyebrow">You asked</div>
          <h3 style={{ margin: "4px 0 12px" }}>{t.question}</h3>
          {!t.result && !t.error && <p className="notice">Searching official sources and FocusBoth data…</p>}
          {t.error && <div className="alert"><strong>Unavailable</strong><span>{t.error}</span></div>}
          {t.result && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Status tone={t.result.grounded ? "good" : "warn"}>{t.result.grounded ? "Cited official sources" : "No policy citation"}</Status>
              </div>
              <p className="brief" style={{ whiteSpace: "pre-wrap", fontSize: 16 }}>{t.result.answer}</p>
              {t.result.citations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow">Sources</div>
                  <ul className="notice" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {t.result.citations.map((c) => (
                      <li key={c.tag}><strong>[{c.tag}]</strong> <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              {t.result.tools.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary className="notice">How this answer was built ({t.result.tools.length} tool call{t.result.tools.length > 1 ? "s" : ""}, {t.result.model})</summary>
                  <ol className="notice" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {t.result.tools.map((tool, k) => <li key={k}><code>{tool.name}</code>: {tool.summary}</li>)}
                  </ol>
                </details>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
