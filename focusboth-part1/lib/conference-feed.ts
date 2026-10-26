import type { DiscoveryEvent } from "./event-types";
import { resolvePlace } from "./us-locations";

type Conference = {
  name: string;
  url: string;
  startDate: string;
  endDate?: string;
  city?: string;
  country?: string;
  online?: boolean;
  topic: string;
};

const TOPICS = [
  "javascript",
  "typescript",
  "python",
  "data",
  "devops",
  "general",
  "java",
  "security",
  "product",
  "ux",
  "api",
  "opensource",
  "android",
  "ios",
  "rust",
];

function isUpcoming(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start >= today;
}

async function fetchTopic(year: number, topic: string, revalidate: number): Promise<Conference[]> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year}/${topic}.json`,
      { next: { revalidate }, signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as Omit<Conference, "topic">[];
    return payload
      .filter((conference) => conference.url && conference.name && isUpcoming(conference.startDate))
      .map((conference) => ({ ...conference, topic }));
  } catch {
    return [];
  }
}

export async function fetchConferences(revalidate: number): Promise<DiscoveryEvent[]> {
  const year = new Date().getFullYear();
  const pages = await Promise.all(
    [year, year + 1].flatMap((currentYear) =>
      TOPICS.map((topic) => fetchTopic(currentYear, topic, revalidate)),
    ),
  );
  const unique = Array.from(
    new Map(pages.flat().map((conference) => [conference.url, conference])).values(),
  );
  unique.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return unique.map((conference) => {
    const online = conference.online === true || /online/i.test(conference.city ?? "");
    const rawLocation = [conference.city, conference.country].filter(Boolean).join(", ");
    const resolved = resolvePlace(rawLocation, online);
    return {
      id: `confstech:${conference.topic}:${conference.url}`,
      title: conference.name,
      kind: "Tech event" as const,
      source: "confs.tech" as const,
      location: online ? "Online" : rawLocation || "Location to be announced",
      online: resolved.online,
      place: resolved.label,
      state: resolved.state,
      isUs: resolved.isUs,
      dateLabel:
        conference.endDate && conference.endDate !== conference.startDate
          ? `${conference.startDate} – ${conference.endDate}`
          : conference.startDate,
      url: conference.url,
      themes: [conference.topic],
    };
  });
}
