"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatRelativeTime, isUnitedStates } from "@/lib/job-feed";
import type { Opening, SalaryRange, WorkType } from "@/lib/types";
import { Status } from "./ui";

const PAGE_SIZES = [10, 25, 50, 100, 0] as const;
const POSTED_WINDOWS = [
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 3 days", hours: 72 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
  { label: "Any time", hours: 0 },
];

type WorkFilter = "All" | WorkType;
type SalaryMap = Record<string, SalaryRange | null>;

function formatSalary(range: SalaryRange | null | undefined) {
  if (range === undefined) return "Loading";
  if (range === null) return "Not published";
  const short = (value: number) => `$${Math.round(value / 1000)}k`;
  return `${short(range.min)} – ${short(range.max)}`;
}

function sponsorCell(opening: Opening) {
  const s = opening.sponsor;
  if (!s) {
    return (
      <>
        <Status tone="bad">No filings found</Status>
        <small>0 H-1B LCAs on record</small>
      </>
    );
  }
  const tone = s.score === null ? "warn" : s.score >= 60 ? "good" : "warn";
  return (
    <>
      <Status tone={tone}>{s.score === null ? "n/a" : `${s.score}/100`}</Status>
      <small>
        {s.filings.toLocaleString()} LCAs · {s.newHireFilings.toLocaleString()} new-hire · {s.quarters}
      </small>
    </>
  );
}

export function SuggestedOpeningsTable({
  trackedKeys,
  onApply,
  onTrack,
}: {
  trackedKeys: Set<string>;
  onApply: (opening: Opening) => void;
  onTrack: (opening: Opening) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [salaries, setSalaries] = useState<SalaryMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");

  const [workType, setWorkType] = useState<WorkFilter>("All");
  const [usOnly, setUsOnly] = useState(true);
  const [postedHours, setPostedHours] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [company, setCompany] = useState("All employers");
  const [minSalary, setMinSalary] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/openings");
        if (!response.ok) throw new Error(`Feed responded ${response.status}`);
        const payload = (await response.json()) as { openings: Opening[]; fetchedAt: string };
        if (cancelled) return;
        setOpenings(payload.openings);
        setFetchedAt(payload.fetchedAt);
        setError("");
      } catch {
        if (!cancelled) setError("Could not reach the job boards. Check your connection and retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const locationText = locationQuery.trim().toLowerCase();
    const roleText = roleQuery.trim().toLowerCase();
    const feedTime = fetchedAt ? new Date(fetchedAt).getTime() : 0;
    const cutoff = postedHours && feedTime ? feedTime - postedHours * 3_600_000 : 0;

    return openings
      .filter((opening) => !trackedKeys.has(opening.applyUrl))
      .filter((opening) => workType === "All" || opening.workType === workType)
      .filter((opening) => !usOnly || isUnitedStates(opening.location))
      .filter((opening) => !cutoff || new Date(opening.postedAt).getTime() >= cutoff)
      .filter((opening) => company === "All employers" || opening.company === company)
      .filter((opening) => !locationText || opening.location.toLowerCase().includes(locationText))
      .filter((opening) => !roleText || opening.role.toLowerCase().includes(roleText))
      .filter((opening) => {
        if (!minSalary) return true;
        const range = salaries[opening.id];
        return range ? range.max >= minSalary : false;
      });
  }, [company, fetchedAt, locationQuery, minSalary, openings, postedHours, roleQuery, salaries, trackedKeys, usOnly, workType]);

  const size = pageSize === 0 ? Math.max(filtered.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(safePage * size, safePage * size + size),
    [filtered, safePage, size],
  );

  useEffect(() => {
    const missing = visible.filter((opening) => !(opening.id in salaries)).slice(0, 60);
    if (missing.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/salaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobs: missing.map(({ board, boardJobId }) => ({ board, boardJobId })),
          }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { salaries: SalaryMap };
        if (!cancelled) setSalaries((current) => ({ ...current, ...payload.salaries }));
      } catch {
        // Pay stays "Not published" if the lookup fails; the row is still usable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [salaries, visible]);

  const companies = useMemo(
    () => ["All employers", ...Array.from(new Set(openings.map((opening) => opening.company))).sort()],
    [openings],
  );

  function changeFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(0);
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Live openings</div>
          <h2 style={{ marginTop: 4 }}>Search every posting, newest first</h2>
        </div>
        <span className="notice">
          {loading
            ? "Loading public job boards…"
            : `${filtered.length.toLocaleString()} matching · ${openings.length.toLocaleString()} live${fetchedAt ? ` · refreshed ${formatRelativeTime(fetchedAt)}` : ""}`}
        </span>
      </div>

      {error && (
        <div className="alert" style={{ marginBottom: 14 }}>
          <strong>Feed unavailable</strong>
          <span>{error}</span>
          <button className="btn secondary" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
        </div>
      )}

      <div className="filter-row" style={{ marginBottom: 12 }}>
        {(["All", "Full-time", "Internship"] as const).map((item) => (
          <button className={`filter ${workType === item ? "active" : ""}`} key={item} onClick={() => changeFilter(setWorkType, item)}>
            {item}
          </button>
        ))}
        <button className={`filter ${usOnly ? "active" : ""}`} onClick={() => changeFilter(setUsOnly, !usOnly)}>
          United States only
        </button>
      </div>

      <div className="form-grid" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="postedWindow">Posted within</label>
          <select id="postedWindow" className="input" value={postedHours} onChange={(e) => changeFilter(setPostedHours, Number(e.target.value))}>
            {POSTED_WINDOWS.map((item) => <option key={item.hours} value={item.hours}>{item.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="companyTab">Employer</label>
          <select id="companyTab" className="input" value={company} onChange={(e) => changeFilter(setCompany, e.target.value)}>
            {companies.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="locationSearch">Location</label>
          <input id="locationSearch" className="input" placeholder="Seattle, remote, TX…" value={locationQuery} onChange={(e) => changeFilter(setLocationQuery, e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="roleSearch">Role</label>
          <input id="roleSearch" className="input" placeholder="Data engineer, intern…" value={roleQuery} onChange={(e) => changeFilter(setRoleQuery, e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor="minSalary">Minimum advertised pay: {minSalary ? `$${minSalary.toLocaleString()}/yr` : "no minimum"}</label>
          <input id="minSalary" type="range" min={0} max={300000} step={10000} value={minSalary} onChange={(e) => changeFilter(setMinSalary, Number(e.target.value))} />
          <span className="notice">Employers are not required to publish pay. Setting a minimum hides roles with no published range.</span>
        </div>
      </div>

      <div className="card-head" style={{ marginBottom: 10 }}>
        <div className="actions">
          <label className="notice" htmlFor="pageSize">Rows per page</label>
          <select
            id="pageSize"
            className="input"
            style={{ width: "auto" }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((item) => (
              <option key={item} value={item}>{item === 0 ? "All results" : `${item} rows`}</option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={() => scrollRef.current?.scrollBy({ top: -280, behavior: "smooth" })}>Scroll up</button>
          <button className="btn secondary" type="button" onClick={() => scrollRef.current?.scrollBy({ top: 280, behavior: "smooth" })}>Scroll down</button>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
          <span className="notice">Page {safePage + 1} of {pageCount}</span>
          <button className="btn secondary" type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
        </div>
      </div>

      <div className="table-wrap table-scroll" ref={scrollRef}>
        <table>
          <thead>
            <tr>
              <th>Employer / role</th>
              <th>Location</th>
              <th>Type</th>
              <th>Posted</th>
              <th>Advertised pay</th>
              <th title="U.S. DOL LCA filings and model probability of a new-hire H-1B filing next quarter">H-1B record (DOL)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((opening) => {
              return (
                <tr key={opening.id}>
                  <td>
                    <strong>{opening.company}</strong>
                    <small>{opening.role}</small>
                    {opening.occupation && (
                      <small title={`Model confidence ${Math.round(opening.occupation.probability * 100)}%`}>
                        {opening.occupation.soc} {opening.occupation.title}
                        {opening.occupation.entryWageP50
                          ? ` · H-1B entry-level median $${Math.round(opening.occupation.entryWageP50 / 1000)}k`
                          : ""}
                      </small>
                    )}
                  </td>
                  <td>{opening.location}</td>
                  <td><Status tone={opening.workType === "Internship" ? "warn" : "good"}>{opening.workType}</Status></td>
                  <td>{formatRelativeTime(opening.postedAt)}</td>
                  <td>{formatSalary(salaries[opening.id])}</td>
                  <td>{sponsorCell(opening)}</td>
                  <td>
                    <div className="actions">
                      <button className="btn primary" onClick={() => onApply(opening)}>Apply</button>
                      <button className="btn secondary" onClick={() => onTrack(opening)}>Track</button>
                    </div>
                    <small>Opens this exact posting</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !error && visible.length === 0 && (
          <p className="notice" style={{ padding: 16 }}>No openings match these filters. Widen the posted window or clear the pay minimum.</p>
        )}
      </div>
    </section>
  );
}
