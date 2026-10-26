import { NextResponse } from "next/server";
import { dataQuarters, normalizeEmployer, signalForNameDb } from "@/lib/sponsorship";

/** GET /api/sponsorship?company=Stripe, Inc.  ->  DOL LCA record + model probability, or null. */
export async function GET(request: Request) {
  const company = new URL(request.url).searchParams.get("company")?.slice(0, 200) ?? "";
  if (!company.trim()) {
    return NextResponse.json({ error: "company is required" }, { status: 400 });
  }
  const { signal, servedBy } = await signalForNameDb(company);
  return NextResponse.json({
    query: company,
    employerKey: normalizeEmployer(company),
    signal,
    servedBy,
    source: `U.S. DOL OFLC LCA disclosure data, ${dataQuarters}`,
  });
}
