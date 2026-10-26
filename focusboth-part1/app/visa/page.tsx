"use client";

import { FormEvent, useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { MetricCard, PageHead, Progress, Status } from "@/components/ui";
import { daysUntil, unemploymentAllowance } from "@/lib/compass-engine";
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

  const milestones = [
    ["Program end", data.profile.programEndDate, "Your academic program completion date"],
    ["EAD begins", data.profile.eadStartDate, "Employment authorization starts"],
    ["Next report", data.profile.nextReportingDate, "Confirm requirement with your DSO"],
    ["EAD ends", data.profile.eadEndDate, "Hard boundary used by path checks"],
  ];

  return (
    <div className="content">
      <PageHead
        eyebrow="Visa clock"
        title="Know the dates. Protect the runway."
        description="A single place to record dates and expose conflicts before they become urgent."
        action={<Status tone="warn">Informational only</Status>}
      />

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <MetricCard label="EAD runway" value={`${daysUntil(data.profile.eadEndDate)} days`} note={`Until ${data.profile.eadEndDate}`} />
        <MetricCard
          label="Unemployment remaining"
          value={`${allowance.remaining} days`}
          note={`${data.profile.unemploymentDaysUsed} used out of ${allowance.cap}`}
          tone={allowance.remaining < 45 ? "warn" : "good"}
        />
        <MetricCard label="Next reporting event" value={`${daysUntil(data.profile.nextReportingDate)} days`} note={data.profile.nextReportingDate} />
      </div>

      <div className="alert" style={{ marginBottom: 18 }}>
        <strong>Boundary</strong>
        <span>FocusBoth does not determine status, eligibility or compliance. Use this planner to prepare questions, then verify them with your DSO or qualified attorney.</span>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Your timeline</h2><span className="status">4 milestones</span></div>
          <div className="timeline">
            {milestones.map(([label, date, note]) => (
              <div className="timeline-item" key={label}>
                <strong>{label} · {date}</strong>
                <p>{note}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="notice">Unemployment allowance used</span>
              <strong style={{ fontSize: 12 }}>{Math.round((data.profile.unemploymentDaysUsed / allowance.cap) * 100)}%</strong>
            </div>
            <Progress value={(data.profile.unemploymentDaysUsed / allowance.cap) * 100} warning />
          </div>
        </section>

        <form className="card" onSubmit={submit}>
          <div className="card-head"><h2>Edit student record</h2>{saved && <Status>Saved locally</Status>}</div>
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
