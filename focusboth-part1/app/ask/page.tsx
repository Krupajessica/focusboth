"use client";

import { FormEvent, useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { Status } from "@/components/ui";
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

  /** Bold (**text**) and source tags ([S1]) rendered as real elements instead of raw symbols. */
  function renderAnswer(result: AgentResult) {
    const order = new Map(result.citations.map((c, i) => [c.tag, i + 1]));
    return result.answer.split(/(\*\*[^*]+\*\*|\[S\d+\])/g).map((part, i) => {
      if (part.startsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
      const tag = /^\[(S\d+)\]$/.exec(part)?.[1];
      if (tag) return order.has(tag) ? <sup className="cite" key={i}>{order.get(tag)}</sup> : null;
      return part;
    });
  }

  return (
    <div className="content">
      <section className="hero jobs-hero">
        <div className="eyebrow">Ask FocusBoth</div>
        <h1>Answers with sources, not guesses.</h1>
        <p className="lead">Answers OPT and STEM OPT questions only from official USCIS pages and 8 CFR 214.2, and uses FocusBoth&apos;s own data and rules for your dates and employers.</p>
      </section>

      <form className="searchbar" onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(question); }}>
        <input placeholder="Ask about OPT, STEM OPT, an employer, or your tracked jobs…"
          value={question} maxLength={600} onChange={(e) => setQuestion(e.target.value)} aria-label="Your question" />
        <button className="btn primary" type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
      </form>
      <div className="filter-row search-filters" style={{ marginBottom: 10 }}>
        {EXAMPLES.map((q) => (
          <button key={q} type="button" className="filter" disabled={busy} onClick={() => void ask(q)}>{q}</button>
        ))}
      </div>
      <p className="notice" style={{ textAlign: "center", marginBottom: 26 }}>
        Not legal advice. FocusBoth never predicts visa outcomes; confirm anything about your own case with your DSO. In a crisis in the U.S., call or text 988.
      </p>

      {turns.map((t, i) => (
        <section className="askturn" key={`${t.question}-${turns.length - i}`}>
          <article className="card dark askanswer">
            <div className="eyebrow" style={{ color: "#fff" }}>You asked</div>
            <h2>{t.question}</h2>
            {!t.result && !t.error && <p className="brief thinking">Searching official sources and FocusBoth data…</p>}
            {t.error && <div className="alert"><strong>Unavailable</strong><span>{t.error}</span></div>}
            {t.result && <p className="answer">{renderAnswer(t.result)}</p>}
          </article>
          <div className="askside">
            <article className="card">
              <div className="card-head" style={{ marginBottom: 12 }}>
                <h3>Where this comes from</h3>
                {t.result && <Status tone={t.result.grounded ? "good" : "warn"}>{t.result.grounded ? "Cited official sources" : "No policy citation"}</Status>}
              </div>
              {t.result && t.result.citations.length > 0 ? (
                <div className="srclist">
                  {t.result.citations.map((c, k) => (
                    <a key={c.tag} href={c.url} target="_blank" rel="noopener noreferrer"><sup className="cite">{k + 1}</sup><span>{c.title}</span></a>
                  ))}
                </div>
              ) : (
                <p className="notice" style={{ margin: 0 }}>{t.result ? "This answer used FocusBoth's own data or rules, not a policy passage." : "Sources appear here with the answer."}</p>
              )}
            </article>
            <article className="card">
              <h3 style={{ marginBottom: 12 }}>How it was answered</h3>
              {t.result && t.result.tools.length > 0 ? (
                <ol className="steplist">
                  {t.result.tools.map((tool, k) => <li key={k}><i>{k + 1}</i><span><code>{tool.name}</code>: {tool.summary}</span></li>)}
                  <li><i>{t.result.tools.length + 1}</i><span>Answer written only from those results; every source tag checked. Model: {t.result.model}</span></li>
                </ol>
              ) : (
                <p className="notice" style={{ margin: 0 }}>{t.result ? "No tool was needed for this reply." : "The steps appear here with the answer."}</p>
              )}
            </article>
          </div>
        </section>
      ))}
    </div>
  );
}
