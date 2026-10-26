import type { SponsorSignal } from "./sponsorship";

export type VisaProfile = {
  studentName: string;
  visaStatus: "F-1 OPT" | "F-1 STEM OPT";
  programEndDate: string;
  eadStartDate: string;
  eadEndDate: string;
  unemploymentDaysUsed: number;
  nextReportingDate: string;
};

export type JobStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected";
export type WorkType = "Full-time" | "Internship";

export type Job = {
  id: string;
  company: string;
  role: string;
  location: string;
  workType: WorkType;
  status: JobStatus;
  appliedDate: string;
  startDate: string;
  sponsorScore: number;
  resumeFit: number;
  lcaFilings: number;
  /** "dol" when sponsorScore came from the DOL model, "manual" when the student typed it. */
  sponsorSource?: "dol" | "manual";
  /** Direct job posting / application form, if known. */
  applyUrl: string;
  /** Company careers or openings list. Used when no posting URL exists. */
  openingsUrl: string;
};

/** A live posting from a public company job board. */
export type Opening = {
  id: string;
  board: string;
  boardJobId: string;
  company: string;
  role: string;
  location: string;
  workType: WorkType;
  postedAt: string;
  applyUrl: string;
  openingsUrl: string;
  /** Employer-level DOL LCA record + model probability. null = no H-1B filings found. */
  sponsor: SponsorSignal | null;
  /** M2 model: predicted SOC occupation for the title + DOL Level I median H-1B wage for it. */
  occupation: {
    soc: string;
    title: string;
    probability: number;
    entryWageP50: number | null;
    entryWageN: number;
  } | null;
};

export type SalaryRange = { min: number; max: number };

export type PathScenario = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  weeklyHours: number;
  employerEnrolledEVerify: boolean;
  hasEmployerRelationship: boolean;
  runwayMonths: number;
};

export type CompassData = {
  profile: VisaProfile;
  jobs: Job[];
  paths: PathScenario[];
};

export type PathEvaluation = {
  feasible: boolean;
  checks: Array<{ label: string; detail: string; pass: boolean }>;
  recommendation: string;
};
