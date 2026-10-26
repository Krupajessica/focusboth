/** DOL certified H-1B wage percentiles by SOC and prevailing-wage level (analytics/export.py). */
import data from "./data/soc-wages.json";

export type WageBand = { n: number; p25: number; p50: number; p75: number };
type SocWages = Record<string, { title: string; levels: Partial<Record<"I" | "II" | "III" | "IV", WageBand>> }>;
const wages = data as SocWages;

/** Wage band for an occupation at a level. Level I is the entry level most OPT graduates are hired at. */
export function wageBand(soc: string, level: "I" | "II" | "III" | "IV" = "I"): WageBand | null {
  return wages[soc]?.levels[level] ?? null;
}
