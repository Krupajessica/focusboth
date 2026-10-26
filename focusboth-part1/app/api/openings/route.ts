import { NextResponse } from "next/server";
import { classifyWorkType } from "@/lib/job-feed";
import { JOB_BOARDS, type JobBoard } from "@/lib/job-boards";
import { signalForKey } from "@/lib/sponsorship";
import { wageBand } from "@/lib/soc-wages";
import { predictSoc } from "@/lib/title-model";
import type { Opening } from "@/lib/types";

export const revalidate = 1800;

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  first_published?: string;
  updated_at?: string;
};

async function fetchBoard(board: JobBoard): Promise<Opening[]> {
  try {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=false`,
      { next: { revalidate }, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) return [];

    const payload = (await response.json()) as { jobs?: GreenhouseJob[] };
    const sponsor = signalForKey(board.dolEmployerKey);
    return (payload.jobs ?? []).map((job) => {
      const [top] = predictSoc(job.title, 1);
      const band = top ? wageBand(top.soc, "I") : null;
      return {
      id: `${board.token}:${job.id}`,
      board: board.token,
      boardJobId: String(job.id),
      company: board.company,
      role: job.title,
      location: job.location?.name?.trim() || "Not specified",
      workType: classifyWorkType(job.title),
      postedAt: job.first_published ?? job.updated_at ?? "",
      applyUrl: job.absolute_url,
      openingsUrl: board.openingsUrl,
      sponsor,
      occupation: top
        ? { soc: top.soc, title: top.title, probability: Math.round(top.probability * 100) / 100,
            entryWageP50: band?.p50 ?? null, entryWageN: band?.n ?? 0 }
        : null,
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(JOB_BOARDS.map(fetchBoard));
  const openings = results
    .flat()
    .filter((opening) => opening.postedAt)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  return NextResponse.json({
    openings,
    fetchedAt: new Date().toISOString(),
    employers: new Set(openings.map((opening) => opening.company)).size,
  });
}
