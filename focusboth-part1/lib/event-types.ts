export type EventKind = "Hackathon" | "Tech event" | "Hobby";

export type DiscoveryEvent = {
  id: string;
  title: string;
  kind: EventKind;
  source: "Devpost" | "Ticketmaster" | "confs.tech";
  location: string;
  online: boolean;
  /** Normalised US place: "Online", "Austin, TX", or "" when not in the US. */
  place: string;
  /** Two-letter state code when known. */
  state: string;
  isUs: boolean;
  dateLabel: string;
  url: string;
  themes: string[];
  prizeLabel?: string;
};
