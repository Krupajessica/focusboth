"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCompassStore } from "@/components/compass-store";
import { Progress, Status } from "@/components/ui";
import { coordinatorBrief, daysBetween, daysUntil, jobFailures, jobPassesConstraints, nextActions, unemploymentAllowance } from "@/lib/compass-engine";

const noopSubscribe = () => () => {};
/** Stable string snapshot ("Monday · October 26|15") so React does not re-render in a loop. */
function clientClock() {
  const d = new Date();
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).replace(",", " ·")}|${d.getHours()}`;
}

/** Counts up to `target` once on load (skipped when the user prefers reduced motion). */
function useCountUp(target: number) {
  const [n, setN] = useState(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1600);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

/** One short line per failed rule, for the Today tile. */
function shortReason(reason?: string) {
  if (!reason) return "fails a rule";
  if (reason.startsWith("starts")) return "starts after your EAD ends";
  return reason.replace(" (DOL)", "");
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Home() {
  const { data } = useCompassStore();
  const { profile, jobs } = data;
  const allowance = unemploymentAllowance(profile);
  const qualifyingJobs = jobs.filter((job) => jobPassesConstraints(job, profile));
  const activeJobs = jobs.filter((job) => ["Applied", "Interview", "Offer"].includes(job.status));
  const actions = nextActions(profile, jobs, data.paths);
  // Read the clock only in the browser, so the prerendered HTML never shows a stale build date.
  const clock = useSyncExternalStore(noopSubscribe, clientClock, () => null);
  const [dateLine, hour] = clock ? clock.split("|") : ["Today", ""];
  const h = Number(hour);
  const greeting = !clock ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  const runway = Math.max(0, daysUntil(profile.eadEndDate));
  const shown = useCountUp(runway);
  const eadTotal = Math.max(1, daysBetween(profile.eadStartDate, profile.eadEndDate));
  const eadUsedPct = Math.max(0, Math.min(100, Math.round(((eadTotal - runway) / eadTotal) * 100)));
  const best = [...qualifyingJobs].sort((x, y) => y.resumeFit + y.sponsorScore - (x.resumeFit + x.sponsorScore))[0];
  const failing = jobs.filter((job) => !jobPassesConstraints(job, profile)).slice(0, 3);
  const barsOn = Math.round((profile.unemploymentDaysUsed / Math.max(1, allowance.cap)) * 10);

  return (
    <div className="content">
      <section className="hero">
        <div className="eyebrow">{dateLine.replace(" ·", ",")}</div>
        <h1><span className="shine">{shown} days.</span><br />Make each one count.</h1>
        <p className="lead">
          {greeting}, {profile.studentName.split(" ")[0]}. Your work permit ends {fmt(profile.eadEndDate)}. Here is where to spend the time you have.
        </p>
        <Link href="/jobs" className="btn primary" style={{ marginTop: 8 }}>Add application</Link>
      </section>

      <div className="bento grid">
        <Link href="/visa" className="tile vivid">
          <span className="tile-label">Runway</span>
          <div className="dial">
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="14" />
              <circle className="arc" cx="100" cy="100" r="90" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round"
                strokeDasharray="565" strokeDashoffset={565 - (565 * eadUsedPct) / 100} transform="rotate(-90 100 100)" />
            </svg>
            <div className="dial-center"><b>{eadUsedPct}%</b><span>of EAD used</span></div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{fmt(profile.eadStartDate)} to {fmt(profile.eadEndDate)}</span>
        </Link>

        <Link href="/jobs" className="tile glass">
          <span className="tile-label">{best ? "Strongest option" : "No job clears the rules yet"}</span>
          {best ? (
            <div className="pick">
              <b>{best.company}</b>
              <span>{best.role}</span>
              <div className="chips"><span className="chip solid">Sponsor {best.sponsorScore}</span><span className="chip">Fit {best.resumeFit}</span></div>
            </div>
          ) : (
            <p className="notice">Widen the search rather than lowering every threshold at once.</p>
          )}
          <div className="rows">
            {failing.map((job) => (
              <div key={job.id}><span>{job.company}</span><span className="bad">{shortReason(jobFailures(job, profile)[0])}</span></div>
            ))}
          </div>
        </Link>

        <Link href="/visa" className="tile light">
          <span className="tile-label">Unemployment days</span>
          <div className="bars" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < barsOn ? "on" : ""} style={i < barsOn ? { animationDelay: `${1 + i * 0.08}s` } : undefined} />)}
          </div>
          <div><div className="big">{allowance.remaining} left</div><div className="sub">{profile.unemploymentDaysUsed} of {allowance.cap} used</div></div>
        </Link>

        <Link href="/ask" className="tile glass">
          <span className="tile-label">Ask FocusBoth</span>
          <div className="bubble me">How many days can I be unemployed on STEM OPT?</div>
          <div className="bubble bot">Every answer cites the official rule it came from, or tells you to ask your DSO.</div>
          <div className="fake-input">Ask about OPT, an employer, or your jobs</div>
        </Link>
      </div>

      <div className="ticker" aria-hidden="true">
        <div>
          {[0, 1].map((k) => (
            <span key={k} style={{ display: "contents" }}>
              <span>539,975 H-1B filings analysed</span><span>20,841 employers scored</span><span>109 official rule passages</span>
              <span>{jobs.length} roles tracked, {activeJobs.length} active</span><span>{qualifyingJobs.length} clear all three visa rules</span><span>Answers cited to 8 CFR 214.2(f)</span>
            </span>
          ))}
        </div>
      </div>

      <div className="alert" style={{ marginBottom: 18 }}>
        <strong>Clock check</strong>
        <span>Your next STEM OPT reporting date is {profile.nextReportingDate}. Confirm this prototype date with your DSO before relying on it.</span>
      </div>

      <div className="grid grid-3">
        <section className="card dark span-2">
          <div className="card-head">
            <div>
              <div className="eyebrow" style={{ color: "#fff" }}>Coordinator briefing</div>
              <h2 style={{ marginTop: 4 }}>What deserves attention now</h2>
            </div>
            <Status>Evidence linked</Status>
          </div>
          <p className="brief">{coordinatorBrief(profile, jobs)}</p>
          <div className="source">Generated from your saved dates, application records and deterministic rules. The language layer only summarizes those outputs.</div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Next actions</h2><span className="status">{actions.length} items</span></div>
          <div className="list">
            {actions.map((item, i) => (
              <div className="list-row" key={item.title}>
                <div className="list-icon">{i + 1}</div>
                <div><strong>{item.title}</strong><small>{item.note}</small></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card span-2">
          <div className="card-head"><h2>Application momentum</h2><Link href="/jobs" className="btn secondary">Open tracker</Link></div>
          <div className="grid grid-2">
            {jobs.slice(0, 2).map((job) => (
              <div key={job.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div><h3>{job.company}</h3><p className="notice" style={{ margin: "4px 0 11px" }}>{job.role}</p></div>
                  <Status tone={job.status === "Interview" ? "good" : "neutral"}>{job.status}</Status>
                </div>
                <Progress value={(job.sponsorScore + job.resumeFit) / 2} />
                <p className="notice">Combined signal {Math.round((job.sponsorScore + job.resumeFit) / 2)}/100</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Visa health</h2><Status tone="warn">Watch</Status></div>
          <div className="metric-value" style={{ fontSize: 26 }}>{profile.visaStatus}</div>
          <p className="notice">Dates you entered. FocusBoth flags conflicts; it does not determine immigration status.</p>
          <Link href="/visa" className="btn secondary" style={{ marginTop: 10 }}>Review dates</Link>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h2>Wellbeing is part of the plan</h2>
            <Link href="/growth" className="btn secondary">Open Wellbeing</Link>
          </div>
          <p className="lead" style={{ fontSize: 14 }}>
            Managing OPT, applications, and family time is stressful. Hobbies and personal growth are included on purpose —
            not as therapy, but as a weekly quota so job hunting does not erase rest, music, or learning.
          </p>
        </section>
      </div>
    </div>
  );
}
