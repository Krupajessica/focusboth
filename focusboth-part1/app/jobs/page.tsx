"use client";

import { FormEvent, useMemo, useState } from "react";
import { SuggestedOpeningsTable } from "@/components/suggested-openings";
import { useCompassStore } from "@/components/compass-store";
import { PageHead, Progress, Status } from "@/components/ui";
import { applyDestination, jobPassesConstraints } from "@/lib/compass-engine";
import type { SponsorSignal } from "@/lib/sponsorship";
import type { Job, JobStatus, Opening } from "@/lib/types";

const blankJob = (): Job => ({
  id: "",
  company: "",
  role: "",
  location: "",
  workType: "Full-time",
  status: "Saved",
  appliedDate: "",
  startDate: "",
  sponsorScore: 50,
  resumeFit: 50,
  lcaFilings: 0,
  applyUrl: "",
  openingsUrl: "",
});

const filters: Array<JobStatus | "All"> = ["All", "Saved", "Applied", "Interview", "Offer", "Rejected"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function JobsPage() {
  const { data, addJob, updateJob, removeJob } = useCompassStore();
  const [filter, setFilter] = useState<JobStatus | "All">("All");
  const [editing, setEditing] = useState<Job | null>(null);
  const [toast, setToast] = useState("");
  const visibleJobs = useMemo(
    () => data.jobs.filter((job) => filter === "All" || job.status === filter),
    [data.jobs, filter],
  );
  const trackedKeys = useMemo(
    () => new Set(data.jobs.map((job) => job.applyUrl).filter(Boolean)),
    [data.jobs],
  );

  /** Sponsor signal comes from the DOL LCA model when the employer has filings; otherwise 0. */
  function openingToJob(opening: Opening): Job {
    return {
      id: crypto.randomUUID(),
      company: opening.company,
      role: opening.role,
      location: opening.location,
      workType: opening.workType,
      status: "Saved",
      appliedDate: "",
      startDate: "",
      sponsorScore: opening.sponsor?.score ?? 0,
      sponsorSource: "dol",
      resumeFit: 50,
      lcaFilings: opening.sponsor?.filings ?? 0,
      applyUrl: opening.applyUrl,
      openingsUrl: opening.openingsUrl,
    };
  }

  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState("");

  /** Fills the sponsor signal from the DOL LCA model. Exact legal-name match only. */
  async function lookupSponsor() {
    if (!editing) return;
    setLookupBusy(true);
    setLookupNote("");
    try {
      const response = await fetch(`/api/sponsorship?company=${encodeURIComponent(editing.company)}`);
      const payload = (await response.json()) as { signal: SponsorSignal | null; source: string };
      if (!payload.signal) {
        setEditing({ ...editing, sponsorScore: 0, lcaFilings: 0, sponsorSource: "dol" });
        setLookupNote("No H-1B filings under this legal name. Try the name on the offer letter (e.g. Maplebear for Instacart).");
      } else {
        const s = payload.signal;
        setEditing({ ...editing, sponsorScore: s.score ?? 0, lcaFilings: s.filings, sponsorSource: "dol" });
        setLookupNote(`${s.legalName}: ${s.filings.toLocaleString()} LCAs, ${s.newHireFilings.toLocaleString()} new-hire (${s.quarters}).`);
      }
    } catch {
      setLookupNote("Lookup failed. Your current values are unchanged.");
    } finally {
      setLookupBusy(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4200);
  }

  function openApply(job: Job, options?: { trackFirst?: boolean }) {
    const destination = applyDestination(job);
    if (!destination.url) {
      showToast("Add a posting URL or company openings page before applying.");
      setEditing(job.id ? { ...job } : { ...job, id: "" });
      return;
    }

    window.open(destination.url, "_blank", "noopener,noreferrer");

    const tracked = data.jobs.find((item) => item.id === job.id)
      ?? (options?.trackFirst ? job : undefined);

    if (options?.trackFirst && !data.jobs.some((item) => item.id === job.id)) {
      addJob({
        ...job,
        id: job.id || crypto.randomUUID(),
        status: "Applied",
        appliedDate: todayIso(),
      });
    } else if (tracked && (tracked.status === "Saved" || tracked.status === "Rejected")) {
      updateJob({ ...tracked, status: "Applied", appliedDate: tracked.appliedDate || todayIso() });
    }

    showToast(
      destination.kind === "posting"
        ? `Opened the ${job.company} application page. Submit there, then return to FocusBoth.`
        : `No specific posting URL yet, so the ${job.company} openings page was opened instead.`,
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const job = { ...editing, id: editing.id || crypto.randomUUID() };
    if (editing.id && data.jobs.some((item) => item.id === editing.id)) updateJob(job);
    else addJob(job);
    setEditing(null);
  }

  return (
    <div className="content">
      <PageHead
        eyebrow="Job hunt"
        title="Rank opportunities, not job boards."
        description="Live postings from public company job boards. Apply opens that exact posting; FocusBoth never submits the form for you."
        action={<button className="btn primary" onClick={() => setEditing(blankJob())}>Add application</button>}
      />

      <SuggestedOpeningsTable
        trackedKeys={trackedKeys}
        onApply={(opening) => openApply(openingToJob(opening), { trackFirst: true })}
        onTrack={(opening) => addJob(openingToJob(opening))}
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div className="filter-row">
            {filters.map((item) => (
              <button className={`filter ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <span className="notice">{visibleJobs.length} shown</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company / role</th>
                <th>Status</th>
                <th>Sponsor signal</th>
                <th>Résumé fit</th>
                <th>Start constraint</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job) => {
                const safe = jobPassesConstraints(job, data.profile);
                const startsBeforeEad = new Date(job.startDate) <= new Date(data.profile.eadEndDate);
                const destination = applyDestination(job);
                return (
                  <tr key={job.id}>
                    <td><strong>{job.company}</strong><small>{job.role} · {job.location}</small></td>
                    <td><Status tone={job.status === "Interview" || job.status === "Offer" ? "good" : "neutral"}>{job.status}</Status></td>
                    <td style={{ minWidth: 150 }}>
                      <strong>{job.sponsorScore}/100</strong>
                      <Progress value={job.sponsorScore} warning={job.sponsorScore < 60} />
                      <small>{job.lcaFilings.toLocaleString()} H-1B LCAs {job.sponsorSource === "dol" ? "(DOL)" : "(entered)"}</small>
                    </td>
                    <td style={{ minWidth: 130 }}><strong>{job.resumeFit}/100</strong><Progress value={job.resumeFit} /></td>
                    <td><Status tone={startsBeforeEad ? "good" : "bad"}>{startsBeforeEad ? "Before EAD" : "After EAD"}</Status></td>
                    <td>
                      <div className="actions">
                        <button className="btn primary" onClick={() => openApply(job)} disabled={!destination.url}>
                          Apply
                        </button>
                        <button className="btn secondary" onClick={() => setEditing({ ...job })}>Edit</button>
                        <button className="btn danger" onClick={() => window.confirm(`Delete ${job.company}?`) && removeJob(job.id)}>Delete</button>
                      </div>
                      <small style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>
                        {destination.kind === "posting" ? "Opens posting page" : "Opens openings page"}
                        {safe ? " · Passes all 3 filters" : ""}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert">
        <strong>You submit. FocusBoth redirects.</strong>
        <span>
          Apply never logs into LinkedIn or auto-fills a form. If a posting URL is saved, that application page opens.
          If only a careers URL is saved, the openings list opens instead.
        </span>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(16,43,36,.62)", zIndex: 30, display: "grid", placeItems: "center", padding: 18 }}
          onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <form className="card" onSubmit={submit} style={{ width: "min(680px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <div className="card-head"><h2>{editing.id && data.jobs.some((item) => item.id === editing.id) ? "Edit application" : "Add application"}</h2><button className="btn secondary" type="button" onClick={() => setEditing(null)}>Close</button></div>
            <div className="form-grid">
              {[
                ["company", "Company", "text"],
                ["role", "Role", "text"],
                ["location", "Location", "text"],
                ["appliedDate", "Applied date", "date"],
                ["startDate", "Expected start date", "date"],
                ["lcaFilings", "H-1B LCA filings (DOL)", "number"],
                ["applyUrl", "Application / posting URL", "url"],
                ["openingsUrl", "Company openings URL", "url"],
              ].map(([key, label, type]) => (
                <div className={`field ${key.endsWith("Url") ? "span-2" : ""}`} key={key}>
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    className="input"
                    type={type}
                    value={editing[key as keyof Job] as string | number}
                    onChange={(e) => setEditing({ ...editing, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                    required={key !== "appliedDate" && key !== "applyUrl" && key !== "openingsUrl"}
                  />
                </div>
              ))}
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as JobStatus })}>
                  {filters.slice(1).map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label htmlFor="sponsorScore">
                  Sponsor signal: {editing.sponsorScore}/100 {editing.sponsorSource === "dol" ? "(from DOL model)" : "(entered by you)"}
                </label>
                <input id="sponsorScore" type="range" min="0" max="100" value={editing.sponsorScore} onChange={(e) => setEditing({ ...editing, sponsorScore: Number(e.target.value), sponsorSource: "manual" })} />
                <div className="actions">
                  <button className="btn secondary" type="button" disabled={!editing.company.trim() || lookupBusy} onClick={() => void lookupSponsor()}>
                    {lookupBusy ? "Checking DOL…" : "Look up DOL record"}
                  </button>
                  {lookupNote && <span className="notice">{lookupNote}</span>}
                </div>
              </div>
              <div className="field">
                <label htmlFor="resumeFit">Résumé fit (your own rating): {editing.resumeFit}</label>
                <input id="resumeFit" type="range" min="0" max="100" value={editing.resumeFit} onChange={(e) => setEditing({ ...editing, resumeFit: Number(e.target.value) })} />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn primary" type="submit">Save application</button>
              <button className="btn secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
