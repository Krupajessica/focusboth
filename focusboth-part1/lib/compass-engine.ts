import type { Job, PathEvaluation, PathScenario, VisaProfile } from "./types";

const MS_PER_DAY = 86_400_000;

export function daysBetween(from: string | Date, to: string | Date) {
  const start = new Date(from);
  const end = new Date(to);
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function daysUntil(date: string) {
  return Math.max(0, daysBetween(new Date(), date));
}

export function unemploymentAllowance(profile: VisaProfile) {
  const cap = profile.visaStatus === "F-1 STEM OPT" ? 150 : 90;
  return { cap, remaining: Math.max(0, cap - profile.unemploymentDaysUsed) };
}

export function jobPassesConstraints(job: Job, profile: VisaProfile) {
  return (
    job.sponsorScore >= 60 &&
    job.resumeFit >= 65 &&
    new Date(job.startDate) <= new Date(profile.eadEndDate)
  );
}

export function evaluatePath(path: PathScenario, profile: VisaProfile): PathEvaluation {
  const startsBeforeEad = new Date(path.startDate) <= new Date(profile.eadEndDate);
  const enoughHours = path.weeklyHours >= 20;
  const checks = [
    {
      label: "Starts before EAD end",
      detail: `${path.startDate} compared with ${profile.eadEndDate}`,
      pass: startsBeforeEad,
    },
    {
      label: "At least 20 hours each week",
      detail: `${path.weeklyHours} planned hours`,
      pass: enoughHours,
    },
    {
      label: "Employer participates in E-Verify",
      detail: path.employerEnrolledEVerify ? "Recorded as enrolled" : "Not recorded",
      pass: path.employerEnrolledEVerify,
    },
    {
      label: "Bona fide employer relationship",
      detail: path.hasEmployerRelationship ? "Employer relationship present" : "No qualifying relationship entered",
      pass: path.hasEmployerRelationship,
    },
  ];
  const feasible = checks.every((check) => check.pass);
  const failures = checks.filter((check) => !check.pass).map((check) => check.label.toLowerCase());
  return {
    feasible,
    checks,
    recommendation: feasible
      ? `${path.name} clears all four rules entered in this prototype and provides ${path.runwayMonths.toFixed(1)} months of runway. Verify the assumptions with your DSO before acting.`
      : `${path.name} is blocked by ${failures.join(" and ")}. Change the underlying assumptions before comparing this path on career upside.`,
  };
}

export function applyDestination(job: Pick<Job, "applyUrl" | "openingsUrl">) {
  if (job.applyUrl.trim()) {
    return { url: job.applyUrl.trim(), kind: "posting" as const };
  }
  return { url: job.openingsUrl.trim(), kind: "openings" as const };
}

export function coordinatorBrief(profile: VisaProfile, jobs: Job[]) {
  const allowance = unemploymentAllowance(profile);
  const passing = jobs.filter((job) => jobPassesConstraints(job, profile));
  const next = [...passing].sort((a, b) => b.resumeFit + b.sponsorScore - (a.resumeFit + a.sponsorScore))[0];
  if (!next) {
    return `No tracked role currently clears the sponsor, résumé-fit, and EAD-date rules. Protect the remaining ${allowance.remaining} unemployment days by widening the search rather than lowering every threshold at once.`;
  }
  return `${next.company}'s ${next.role} is the strongest current option: sponsor signal ${next.sponsorScore}, résumé fit ${next.resumeFit}, and a start date before the EAD end. ${allowance.remaining} unemployment days remain; confirm every date with your DSO before making a decision.`;
}

/** Names each rule a tracked job fails. Empty array = job passes. */
export function jobFailures(job: Job, profile: VisaProfile): string[] {
  const out: string[] = [];
  if (job.sponsorScore < 60) {
    out.push(job.lcaFilings === 0 ? "no H-1B filings on record (DOL)" : `sponsor signal ${job.sponsorScore} is below 60`);
  }
  if (job.resumeFit < 65) out.push(`résumé fit ${job.resumeFit} is below 65`);
  if (job.startDate && new Date(job.startDate) > new Date(profile.eadEndDate)) {
    out.push(`starts ${job.startDate}, after your EAD ends ${profile.eadEndDate}`);
  }
  return out;
}

export type NextAction = { title: string; note: string };

/** Deterministic "Next actions" for the Today screen, ranked by urgency. */
export function nextActions(profile: VisaProfile, jobs: Job[], paths: PathScenario[], today = new Date()): NextAction[] {
  const actions: NextAction[] = [];
  const reportIn = daysBetween(today, profile.nextReportingDate);
  if (reportIn >= 0 && reportIn <= 30) {
    actions.push({ title: `Validation report due in ${reportIn} days`, note: `${profile.nextReportingDate}. Confirm the date with your DSO` });
  }
  const live = jobs.filter((j) => j.status !== "Rejected");
  const best = [...live.filter((j) => jobPassesConstraints(j, profile))]
    .sort((a, b) => b.resumeFit + b.sponsorScore - (a.resumeFit + a.sponsorScore))[0];
  if (best) {
    const verb = best.status === "Interview" ? "Prepare" : best.status === "Saved" ? "Apply to" : "Follow up with";
    actions.push({ title: `${verb} ${best.company}`, note: `${best.role}: passes all rules (sponsor ${best.sponsorScore}, fit ${best.resumeFit})` });
  }
  for (const j of live) {
    const f = jobFailures(j, profile);
    if (f.length && actions.length < 4) actions.push({ title: `Rethink ${j.company}`, note: f[0] });
  }
  const blocked = paths.filter((p) => !evaluatePath(p, profile).feasible).length;
  if (blocked && actions.length < 4) {
    actions.push({ title: "Compare career paths", note: `${blocked} scenario${blocked > 1 ? "s" : ""} currently fail${blocked > 1 ? "" : "s"} a visa rule` });
  }
  if (!actions.length) actions.push({ title: "Track a live opening", note: "Add roles from Job Hunt to start the rules check" });
  return actions.slice(0, 4);
}
