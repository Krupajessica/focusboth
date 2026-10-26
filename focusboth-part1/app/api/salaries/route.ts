import { NextResponse } from "next/server";
import { parseSalary } from "@/lib/job-feed";
import type { SalaryRange } from "@/lib/types";

/** Pay lives in the posting body, so it is fetched only for rows the student is looking at. */
const MAX_LOOKUPS = 60;

type LookupRequest = { jobs?: Array<{ board: string; boardJobId: string }> };

async function lookup(board: string, boardJobId: string): Promise<SalaryRange | null> {
  try {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${boardJobId}`,
      { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { content?: string };
    return payload.content ? parseSalary(payload.content) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as LookupRequest;
  const requested = (body.jobs ?? []).slice(0, MAX_LOOKUPS);

  const entries = await Promise.all(
    requested.map(async ({ board, boardJobId }) => {
      const range = await lookup(board, boardJobId);
      return [`${board}:${boardJobId}`, range] as const;
    }),
  );

  return NextResponse.json({ salaries: Object.fromEntries(entries) });
}
