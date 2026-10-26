import { describe, expect, it } from "vitest";
import {
  applyDestination,
  evaluatePath,
  jobPassesConstraints,
  unemploymentAllowance,
} from "../lib/compass-engine";
import type { Job, PathScenario, VisaProfile } from "../lib/types";

const profile: VisaProfile = {
  studentName: "Jessica",
  visaStatus: "F-1 STEM OPT",
  programEndDate: "2025-05-15",
  eadStartDate: "2025-06-01",
  eadEndDate: "2027-05-31",
  unemploymentDaysUsed: 40,
  nextReportingDate: "2026-12-01",
};

const job = (over: Partial<Job> = {}): Job => ({
  id: "j", company: "Stripe", role: "Data Analyst", location: "SF", workType: "Full-time",
  status: "Saved", appliedDate: "", startDate: "2027-01-10", sponsorScore: 80, resumeFit: 70,
  lcaFilings: 300, applyUrl: "https://example.com/job/1", openingsUrl: "https://example.com/jobs",
  ...over,
});

const path = (over: Partial<PathScenario> = {}): PathScenario => ({
  id: "p", name: "Sponsored role", description: "", startDate: "2027-01-01", weeklyHours: 40,
  employerEnrolledEVerify: true, hasEmployerRelationship: true, runwayMonths: 5, ...over,
});

describe("unemployment allowance", () => {
  it("STEM OPT cap is 150 days", () => {
    expect(unemploymentAllowance(profile)).toEqual({ cap: 150, remaining: 110 });
  });
  it("OPT cap is 90 days and never negative", () => {
    expect(unemploymentAllowance({ ...profile, visaStatus: "F-1 OPT", unemploymentDaysUsed: 120 }))
      .toEqual({ cap: 90, remaining: 0 });
  });
});

describe("job constraints", () => {
  it("passes when all three rules hold", () => expect(jobPassesConstraints(job(), profile)).toBe(true));
  it("fails below sponsor threshold 60", () => expect(jobPassesConstraints(job({ sponsorScore: 59 }), profile)).toBe(false));
  it("passes exactly at thresholds", () =>
    expect(jobPassesConstraints(job({ sponsorScore: 60, resumeFit: 65 }), profile)).toBe(true));
  it("fails below résumé fit 65", () => expect(jobPassesConstraints(job({ resumeFit: 64 }), profile)).toBe(false));
  it("fails when start is after EAD end", () =>
    expect(jobPassesConstraints(job({ startDate: "2027-06-01" }), profile)).toBe(false));
});

describe("path evaluation", () => {
  it("feasible path passes all four checks", () => {
    const r = evaluatePath(path(), profile);
    expect(r.feasible).toBe(true);
    expect(r.recommendation).toMatch(/DSO/);
  });
  it("full-time founder without employer relationship is blocked", () => {
    const r = evaluatePath(path({ hasEmployerRelationship: false, employerEnrolledEVerify: false }), profile);
    expect(r.feasible).toBe(false);
    expect(r.checks.filter((c) => !c.pass)).toHaveLength(2);
    expect(r.recommendation).toMatch(/e-verify/);
  });
  it("under 20 hours fails", () => expect(evaluatePath(path({ weeklyHours: 19 }), profile).feasible).toBe(false));
});

describe("apply destination", () => {
  it("prefers the exact posting", () => expect(applyDestination(job()).kind).toBe("posting"));
  it("falls back to openings page", () =>
    expect(applyDestination(job({ applyUrl: "  " }))).toEqual({ url: "https://example.com/jobs", kind: "openings" }));
});

import { jobFailures, nextActions } from "../lib/compass-engine";

describe("job failures and next actions", () => {
  it("names the DOL reason when an employer has no filings", () => {
    expect(jobFailures(job({ sponsorScore: 0, lcaFilings: 0 }), profile)).toEqual(["no H-1B filings on record (DOL)"]);
  });
  it("names the EAD conflict", () => {
    expect(jobFailures(job({ startDate: "2027-07-01" }), profile)[0]).toMatch(/after your EAD ends/);
  });
  it("puts the reporting deadline first when within 30 days", () => {
    const a = nextActions({ ...profile, nextReportingDate: "2026-11-02" }, [job()], [path()], new Date("2026-10-26"));
    expect(a[0].title).toMatch(/Validation report due in 7 days/);
    expect(a[1].title).toBe("Apply to Stripe");
  });
  it("never returns more than four actions", () => {
    const many = Array.from({ length: 6 }, (_, i) => job({ id: String(i), company: `C${i}`, sponsorScore: 0, lcaFilings: 0 }));
    expect(nextActions(profile, many, [path({ weeklyHours: 5 })]).length).toBeLessThanOrEqual(4);
  });
});
