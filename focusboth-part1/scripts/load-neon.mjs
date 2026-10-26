// Loads the FocusBoth star schema (data/postgres/*.csv from analytics/export.py) into Neon Postgres
// over HTTPS, then builds the employer_signal table the web app queries.
// Usage: DATABASE_URL=postgresql://... node scripts/load-neon.mjs
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL");
const sql = neon(url, { fullResults: false });
const DIR = new URL("../data/postgres/", import.meta.url);

const TYPES = {
  dim_employer: { employer_id: "int", h1b_dependent: "bool", willful_violator: "bool" },
  dim_occupation: { occupation_id: "int" },
  dim_location: { location_id: "int" },
  dim_date: { date_id: "int", year: "int", month: "int", date: "date" },
  fact_lca: { employer_id: "int", occupation_id: "int", location_id: "int", date_id: "int", full_time: "bool",
    certified: "bool", withdrawn: "bool", denied: "bool", total_positions: "real", new_hire_positions: "real",
    continued_positions: "real", wage_annual: "real", pw_annual: "real", received_date: "ts", begin_date: "ts" },
};

function cast(v, t) {
  if (v === "" || v === undefined || v === null) return null;
  if (t === "int") return Number.parseInt(v, 10);
  if (t === "real") return Number.parseFloat(v);
  if (t === "bool") return v === "true" || v === "True";
  return v;
}

async function load(table, batchRows) {
  const rows = parse(fs.readFileSync(new URL(`${table}.csv`, DIR)), { columns: true, skip_empty_lines: true });
  const cols = Object.keys(rows[0]);
  const types = TYPES[table] ?? {};
  for (let i = 0; i < rows.length; i += batchRows) {
    const batch = rows.slice(i, i + batchRows);
    const params = [];
    const tuples = batch.map((r) => `(${cols.map((c) => { params.push(cast(r[c], types[c])); return `$${params.length}`; }).join(",")})`);
    await sql.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`, params);
    if ((i / batchRows) % 20 === 0) console.log(`${table}: ${Math.min(i + batchRows, rows.length)} / ${rows.length}`);
  }
  console.log(`${table}: ${rows.length} rows`);
}

const ddl = fs.readFileSync(new URL("star_schema.sql", DIR), "utf8").split(";").map((s) => s.trim()).filter(Boolean);
for (const stmt of ddl) await sql.query(stmt);
console.log("schema created");
await load("dim_employer", 3000);
await load("dim_occupation", 1000);
await load("dim_location", 100);
await load("dim_date", 500);
await load("fact_lca", 3000);

// Serving table for the app: one row per employer with DOL facts + model M1 probability.
const sig = JSON.parse(fs.readFileSync(new URL("../lib/data/employer-sponsorship.json", import.meta.url)));
await sql.query(`DROP TABLE IF EXISTS employer_signal`);
await sql.query(`CREATE TABLE employer_signal (employer_key TEXT PRIMARY KEY, name TEXT, filings INT, new_hire_filings INT,
  cert_rate REAL, median_wage REAL, p_next_quarter REAL, last_quarter TEXT, quarters TEXT)`);
const entries = Object.entries(sig.employers);
const quarters = `${sig.quarters[0]}–${sig.quarters.at(-1)}`;
for (let i = 0; i < entries.length; i += 2000) {
  const params = [];
  const tuples = entries.slice(i, i + 2000).map(([k, e]) => {
    params.push(k, e.name, e.filings, e.newHireFilings, e.certRate, e.medianWage, e.pNextQuarter, e.lastQuarter, quarters);
    const n = params.length;
    return `($${n - 8},$${n - 7},$${n - 6},$${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n})`;
  });
  await sql.query(`INSERT INTO employer_signal VALUES ${tuples.join(",")}`, params);
}
const [{ n }] = await sql.query(`SELECT COUNT(*)::int n FROM fact_lca`);
console.log(`employer_signal: ${entries.length} rows; fact_lca in Neon: ${n}`);
