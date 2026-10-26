/**
 * Real H-1B sponsorship signal from U.S. DOL OFLC LCA disclosure data.
 * Built offline by analytics/etl.py + analytics/models.py + analytics/export.py.
 *
 * Server-only: the full employer table is large, so routes attach the few records
 * the browser needs instead of shipping the whole file to the client.
 */
import data from "./data/employer-sponsorship.json";

export type EmployerRecord = {
  name: string;
  filings: number;
  newHireFilings: number;
  certRate: number;
  medianWage: number | null;
  pNextQuarter: number | null;
  lastQuarter: string;
};

/** What the UI shows. `score` is the model probability x 100, never a made-up number. */
export type SponsorSignal = {
  employerKey: string;
  legalName: string;
  score: number | null;
  filings: number;
  newHireFilings: number;
  certRate: number;
  medianWage: number | null;
  quarters: string;
};

type Payload = { source: string; quarters: string[]; employers: Record<string, EmployerRecord> };
const payload = data as Payload;

const SUFFIX =
  /\b(INCORPORATED|INC|LLC|L L C|LLP|LP|LTD|LIMITED|CORPORATION|CORP|CO|COMPANY|PLLC|PC|PBC|HOLDINGS|GROUP|USA|US|AMERICA|NA)\b/g;

/** Same rules as normalize_employer() in analytics/etl.py. Keep the two in sync. */
export function normalizeEmployer(name: string): string {
  let s = name.toUpperCase();
  s = s.replace(/[(,]?\s*\bD\s*\/?\s*B\s*\/?\s*A\b.*$/, "");
  s = s.replace(/&/g, " AND ");
  s = s.replace(/[^A-Z0-9 ]/g, " ");
  s = s.replace(SUFFIX, " ");
  return s.replace(/\s+/g, " ").trim();
}

export const dataQuarters = `${payload.quarters[0]}–${payload.quarters[payload.quarters.length - 1]}`;

export function signalForKey(employerKey: string): SponsorSignal | null {
  const record = payload.employers[employerKey];
  if (!record) return null;
  return {
    employerKey,
    legalName: record.name,
    score: record.pNextQuarter === null ? null : Math.round(record.pNextQuarter * 100),
    filings: record.filings,
    newHireFilings: record.newHireFilings,
    certRate: record.certRate,
    medianWage: record.medianWage,
    quarters: dataQuarters,
  };
}

/** Look up any employer name a student types. Exact normalised match only: no fuzzy guessing. */
export function signalForName(name: string): SponsorSignal | null {
  const key = normalizeEmployer(name);
  return key ? signalForKey(key) : null;
}

/**
 * Same lookup served from the cloud warehouse (Neon Postgres, table employer_signal) when
 * DATABASE_URL is set; falls back to the bundled JSON if the database is unset or unreachable.
 */
export async function signalForNameDb(name: string): Promise<{ signal: SponsorSignal | null; servedBy: "neon" | "bundled" }> {
  const key = normalizeEmployer(name);
  const url = process.env.DATABASE_URL;
  if (key && url) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(url);
      const rows = (await sql.query(
        "SELECT name, filings, new_hire_filings, cert_rate, median_wage, p_next_quarter, quarters FROM employer_signal WHERE employer_key = $1",
        [key],
      )) as Array<{ name: string; filings: number; new_hire_filings: number; cert_rate: number; median_wage: number | null; p_next_quarter: number | null; quarters: string }>;
      const r = rows[0];
      return {
        servedBy: "neon",
        signal: r ? { employerKey: key, legalName: r.name, score: r.p_next_quarter === null ? null : Math.round(r.p_next_quarter * 100),
          filings: r.filings, newHireFilings: r.new_hire_filings, certRate: r.cert_rate, medianWage: r.median_wage, quarters: r.quarters } : null,
      };
    } catch (err) {
      console.error("Neon lookup failed, using bundled data", err);
    }
  }
  return { signal: key ? signalForKey(key) : null, servedBy: "bundled" };
}
