"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useCompassStore } from "@/components/compass-store";
import { MetricCard, PageHead, Progress, Status } from "@/components/ui";
import { coordinatorBrief, daysUntil, jobPassesConstraints, nextActions, unemploymentAllowance } from "@/lib/compass-engine";

const noopSubscribe = () => () => {};
/** Stable string snapshot ("Monday · October 26|15") so React does not re-render in a loop. */
function clientClock() {
  const d = new Date();
  return `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).replace(",", " ·")}|${d.getHours()}`;
}

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

  return (
    <div className="content">
      <PageHead
        eyebrow={dateLine}
        title={`${greeting}, ${profile.studentName.split(" ")[0]}.`}
        description="Visa clock, job hunt, and wellbeing in one place — so you can focus on work and life."
        action={<Link href="/jobs" className="btn primary">Add application</Link>}
      />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <MetricCard label="EAD runway" value={`${daysUntil(profile.eadEndDate)}d`} note={`Ends ${profile.eadEndDate}`} />
        <MetricCard
          label="Unemployment allowance"
          value={`${allowance.remaining}d`}
          note={`${profile.unemploymentDaysUsed} of ${allowance.cap} days used`}
          tone={allowance.remaining < 45 ? "warn" : "good"}
        />
        <MetricCard label="Active applications" value={activeJobs.length} note={`${jobs.length} roles tracked`} />
        <MetricCard
          label="Constraint-safe roles"
          value={qualifyingJobs.length}
          note="Sponsor, fit and start-date rules"
          tone={qualifyingJobs.length ? "good" : "bad"}
        />
      </div>

      <div className="alert" style={{ marginBottom: 18 }}>
        <strong>Clock check</strong>
        <span>Your next STEM OPT reporting date is {profile.nextReportingDate}. Confirm this prototype date with your DSO before relying on it.</span>
      </div>

      <div className="grid grid-3">
        <section className="card dark span-2">
          <div className="card-head">
            <div>
              <div className="eyebrow" style={{ color: "var(--lime)" }}>Coordinator briefing</div>
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
