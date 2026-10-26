import { describe, expect, it } from "vitest";
import { JOB_BOARDS } from "../lib/job-boards";
import { normalizeEmployer, signalForKey, signalForName } from "../lib/sponsorship";

describe("normalizeEmployer matches analytics/etl.py", () => {
  // Same cases as analytics/tests/test_etl.py
  it.each([
    ["Stripe, Inc.", "STRIPE"],
    ["STRIPE INC", "STRIPE"],
    ["Robinhood Markets, Inc.", "ROBINHOOD MARKETS"],
    ["Anthropic, PBC", "ANTHROPIC"],
    ["Formagrid, Inc. (d/b/a Airtable)", "FORMAGRID"],
    ["Formagrid, Inc. ", "FORMAGRID"],
    ["Acme LLC DBA Widgets", "ACME"],
  ])("%s -> %s", (raw, key) => expect(normalizeEmployer(raw)).toBe(key));
});

describe("sponsorship lookup", () => {
  it("every board key is either found or deliberately absent", () => {
    for (const board of JOB_BOARDS) {
      const s = signalForKey(board.dolEmployerKey);
      if (s) {
        expect(s.filings).toBeGreaterThan(0);
        if (s.score !== null) expect(s.score).toBeGreaterThanOrEqual(0);
        if (s.score !== null) expect(s.score).toBeLessThanOrEqual(100);
      }
    }
  });
  it("legal-name lookup works for a typed name", () => {
    expect(signalForName("Stripe, Inc.")?.employerKey).toBe("STRIPE");
  });
  it("unknown employer returns null, never a guess", () => {
    expect(signalForName("Definitely Not A Real Employer Zzzq")).toBeNull();
  });
});
