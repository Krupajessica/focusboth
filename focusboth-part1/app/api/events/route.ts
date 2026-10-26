import { NextRequest, NextResponse } from "next/server";
import { fetchConferences } from "@/lib/conference-feed";
import type { DiscoveryEvent } from "@/lib/event-types";
import { resolvePlace } from "@/lib/us-locations";

export const revalidate = 1800;

type DevpostHackathon = {
  id: number;
  title: string;
  url: string;
  open_state: string;
  displayed_location?: { icon?: string; location?: string };
  submission_period_dates?: string;
  themes?: Array<{ name: string }>;
  prize_amount?: string;
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
  _embedded?: { venues?: Array<{ name?: string; city?: { name?: string }; state?: { stateCode?: string } }> };
};

function prizeText(value = "") {
  const match = value.match(/data-currency-value>([\d,.]+)/);
  const amount = match ? Number(match[1].replace(/,/g, "")) : 0;
  return amount > 0 ? `$${amount.toLocaleString()} prizes` : undefined;
}

async function fetchDevpostPage(status: "open" | "upcoming", page: number): Promise<DiscoveryEvent[]> {
  try {
    const params = new URLSearchParams({
      "status[]": status,
      order_by: "recently-added",
      page: String(page),
    });
    const response = await fetch(`https://devpost.com/api/hackathons?${params}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { hackathons?: DevpostHackathon[] };
    return (payload.hackathons ?? []).map((event) => {
      const rawLocation = event.displayed_location?.location || "Online";
      const online =
        event.displayed_location?.icon === "globe" || /online/i.test(rawLocation);
      const resolved = resolvePlace(rawLocation, online);
      return {
        id: `devpost:${event.id}`,
        title: event.title,
        kind: "Hackathon",
        source: "Devpost",
        location: rawLocation,
        online: resolved.online,
        place: resolved.label,
        state: resolved.state,
        isUs: resolved.isUs,
        dateLabel: event.submission_period_dates || status,
        url: event.url,
        themes: (event.themes ?? []).map((theme) => theme.name),
        prizeLabel: prizeText(event.prize_amount),
      } satisfies DiscoveryEvent;
    });
  } catch {
    return [];
  }
}

async function fetchTicketmaster(city: string, keyword: string, kind: "Tech event" | "Hobby") {
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
  if (!apiKey) return [] as DiscoveryEvent[];
  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      countryCode: "US",
      size: "50",
      sort: "date,asc",
      keyword,
    });
    if (city) params.set("city", city);
    const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { _embedded?: { events?: TicketmasterEvent[] } };
    return (payload._embedded?.events ?? []).map((event) => {
      const venue = event._embedded?.venues?.[0];
      const venueLabel = [venue?.name, venue?.city?.name, venue?.state?.stateCode]
        .filter(Boolean)
        .join(" · ");
      const cityState = [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", ");
      const resolved = resolvePlace(cityState || city, false);
      const classification = event.classifications?.[0];
      return {
        id: `ticketmaster:${event.id}`,
        title: event.name,
        kind,
        source: "Ticketmaster",
        location: venueLabel || city || "United States",
        online: false,
        place: resolved.label,
        state: resolved.state,
        isUs: true,
        dateLabel: [event.dates?.start?.localDate, event.dates?.start?.localTime].filter(Boolean).join(" · "),
        url: event.url,
        themes: [classification?.segment?.name, classification?.genre?.name].filter(Boolean) as string[],
      } satisfies DiscoveryEvent;
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const hobby = request.nextUrl.searchParams.get("hobby")?.trim() || "workshop";
  const devpostRequests = (["open", "upcoming"] as const).flatMap((status) =>
    [1, 2, 3, 4, 5].map((page) => fetchDevpostPage(status, page)),
  );
  const [devpostPages, conferences, tech, hobbies] = await Promise.all([
    Promise.all(devpostRequests),
    fetchConferences(revalidate),
    fetchTicketmaster(city, "technology conference", "Tech event"),
    fetchTicketmaster(city, hobby, "Hobby"),
  ]);
  const events = [...devpostPages.flat(), ...conferences, ...tech, ...hobbies];
  const unique = Array.from(new Map(events.map((event) => [event.url, event])).values());
  return NextResponse.json({
    events: unique,
    fetchedAt: new Date().toISOString(),
    sources: {
      devpost: true,
      confsTech: true,
      ticketmaster: Boolean(process.env.TICKETMASTER_API_KEY?.trim()),
      googleSearch: false,
      instagram: false,
    },
  });
}
