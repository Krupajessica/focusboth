"use client";

import { FormEvent, useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { Status } from "@/components/ui";
import { daysBetween, daysUntil, unemploymentAllowance } from "@/lib/compass-engine";
import type { VisaProfile } from "@/lib/types";

export default function VisaPage() {
  const { data, updateProfile } = useCompassStore();
  const [draft, setDraft] = useState<VisaProfile>(data.profile);
  const [saved, setSaved] = useState(false);
  const allowance = unemploymentAllowance(data.profile);

  function submit(event: FormEvent) {
    event.preventDefault();
    updateProfile(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  const p = data.profile;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const span = Math.max(1, daysBetween(p.programEndDate, p.eadEndDate));
  const at = (iso: string) => {
    const n = daysBetween(p.programEndDate, iso);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, (n / span) * 100)) : null;
  };
  const todayPct = at(new Date().toISOString().slice(0, 10)) ?? 0;
  const reportPct = at(p.nextReportingDate);
  const runway = daysUntil(p.eadEndDate);
  const eadTotal = Math.max(1, daysBetween(p.eadStartDate, p.eadEndDate));
  const eadUsedPct = Math.max(0, Math.min(100, Math.round(((eadTotal - runway) / eadTotal) * 100)));
  const reportIn = daysBetween(new Date(), p.nextReportingDate);
  const reportSet = Number.isFinite(reportIn);
  const reportDue = reportSet && reportIn <= 0;
  const usedPct = Math.min(100, (p.unemploymentDaysUsed / allowance.cap) * 100);

  return (
    <div className="content">
      <div className="visa-head">
        <div>
          <div className="eyebrow">Visa clock</div>
          <h1>Know the dates.<br />Protect the runway.</h1>
        </div>
        <div className="visa-count">
          <b>{runway}</b>
          <span>days of work permit left</span>
        </div>
      </div>

      <section className="card journey">
        <div className="jbar">
          <div className="jfill" style={{ width: `${todayPct}%` }} />
          <i className="jdot" style={{ left: 0 }} />
          <i className="jdot white" style={{ left: `${at(p.eadStartDate) ?? 0}%` }} />
          {reportPct !== null && <i className="jdot amber" style={{ left: `${reportPct}%` }} />}
          <i className="jdot end" style={{ left: "100%" }} />
          <div className="jtoday" style={{ left: `${todayPct}%` }}><span>Today</span><i /></div>
        </div>
        <div className="jlabels">
          <div><b>Program end</b>{fmt(p.programEndDate)}</div>
          <div><b>EAD begins</b>{fmt(p.eadStartDate)}</div>
          <div className={reportDue ? "amber" : ""}><b>Report to DSO</b>{fmt(p.nextReportingDate)}</div>
          <div><b>EAD ends</b>{fmt(p.eadEndDate)}</div>
        </div>
      </section>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="tile vivid stat">
          <span className="tile-label">Work permit used</span>
          <div className="huge">{eadUsedPct}%</div>
          <span className="tile-foot">{fmt(p.eadStartDate)} to {fmt(p.eadEndDate)}</span>
        </div>
        <div className="tile glass stat">
          <span className="tile-label">Unemployment days left</span>
          <div className="huge">{allowance.remaining}</div>
          <div>
            <div className={`progress ${allowance.remaining < 45 ? "warn" : ""}`}><span style={{ width: `${usedPct}%` }} /></div>
            <span className="tile-foot" style={{ display: "block", marginTop: 8 }}>{p.unemploymentDaysUsed} of {allowance.cap} used</span>
          </div>
        </div>
        <div className={`tile stat ${reportDue || !reportSet ? "warnbox" : "glass"}`}>
          <span className="tile-label">Next report to your DSO</span>
          <div className="huge">{!reportSet ? "Not set" : reportDue ? "Due" : `${reportIn} days`}</div>
          <span className="tile-foot">
            {!reportSet
              ? "Add your next reporting date below."
              : reportDue
                ? `Reporting date was ${fmt(p.nextReportingDate)}. Confirm with your DSO, then enter the next date.`
                : `On ${fmt(p.nextReportingDate)}`}
          </span>
        </div>
      </div>

      <div className="alert" style={{ marginBottom: 20 }}>
        <strong>Boundary</strong>
        <span>FocusBoth does not determine status, eligibility or compliance. Use this planner to prepare questions, then verify them with your DSO or qualified attorney.</span>
      </div>

      <div>
        <form className="card" onSubmit={submit}>
          <div className="card-head"><h2>Edit my dates</h2>{saved && <Status>Saved locally</Status>}</div>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="studentName">Student name</label>
              <input id="studentName" className="input" value={draft.studentName} onChange={(e) => setDraft({ ...draft, studentName: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="visaStatus">Visa stage</label>
              <select id="visaStatus" className="input" value={draft.visaStatus} onChange={(e) => setDraft({ ...draft, visaStatus: e.target.value as VisaProfile["visaStatus"] })}>
                <option>F-1 OPT</option>
                <option>F-1 STEM OPT</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="usedDays">Unemployment days used</label>
              <input id="usedDays" type="number" min="0" max="150" className="input" value={draft.unemploymentDaysUsed} onChange={(e) => setDraft({ ...draft, unemploymentDaysUsed: Number(e.target.value) })} />
            </div>
            {[
              ["programEndDate", "Program end date"],
              ["eadStartDate", "EAD start date"],
              ["eadEndDate", "EAD end date"],
              ["nextReportingDate", "Next reporting date"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input id={key} type="date" className="input" value={draft[key as keyof VisaProfile] as string} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} required />
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 18 }}>
            <button className="btn primary" type="submit">Save dates</button>
            <button className="btn secondary" type="button" onClick={() => setDraft(data.profile)}>Undo edits</button>
          </div>
          <p className="notice">Saved to this browser only. The dashboard and path engine update immediately.</p>
        </form>
      </div>
    </div>
  );
}
