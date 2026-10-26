"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHead, Status } from "@/components/ui";
import type { DiscoveryEvent, EventKind } from "@/lib/event-types";

const SAVED_KEY = "focusboth-saved-events-v1";
const ALL_US = "All United States";
const ONLINE = "Online";
const UNRESOLVED = "Outside the US or not specified";

export default function DiscoverPage() {
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [kind, setKind] = useState<EventKind | "All">("All");
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState(ALL_US);
  const [hobby, setHobby] = useState("photography");
  const [request, setRequest] = useState({ city: "", hobby: "photography", key: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setSavedIds(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[]);
      } catch {
        localStorage.removeItem(SAVED_KEY);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ city: request.city, hobby: request.hobby });
        const response = await fetch(`/api/events?${params}`);
        if (!response.ok) throw new Error("feed failed");
        const payload = (await response.json()) as {
          events: DiscoveryEvent[];
        };
        if (cancelled) return;
        setEvents(payload.events);
        setError("");
      } catch {
        if (!cancelled) setError("Event feeds are temporarily unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  /** Every US place present in the feed, in-person first, sorted A to Z. */
  const placeOptions = useMemo(() => {
    const inPerson = new Set<string>();
    for (const event of events) {
      if (event.isUs && !event.online && event.place) inPerson.add(event.place);
    }
    const sorted = [...inPerson].sort((a, b) => a.localeCompare(b));
    const hasOnline = events.some((event) => event.online);
    const hasUnresolved = events.some((event) => !event.isUs && !event.online);
    return [
      ALL_US,
      ...(hasOnline ? [ONLINE] : []),
      ...sorted,
      ...(hasUnresolved ? [UNRESOLVED] : []),
    ];
  }, [events]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return events.filter((event) => {
      if (kind !== "All" && event.kind !== kind) return false;

      if (place === ALL_US) {
        if (!event.isUs) return false;
      } else if (place === ONLINE) {
        if (!event.online) return false;
      } else if (place === UNRESOLVED) {
        if (event.isUs || event.online) return false;
      } else if (event.place !== place) {
        return false;
      }

      if (!text) return true;
      return `${event.title} ${event.location} ${event.place} ${event.themes.join(" ")}`
        .toLowerCase()
        .includes(text);
    });
  }, [events, kind, place, query]);

  function saveEvent(event: DiscoveryEvent) {
    const next = savedIds.includes(event.id)
      ? savedIds.filter((id) => id !== event.id)
      : [...savedIds, event.id];
    setSavedIds(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  function searchNearby(event: FormEvent) {
    event.preventDefault();
    const city = place === ALL_US || place === ONLINE ? "" : place.split(",")[0].trim();
    setRequest({ city, hobby: hobby.trim() || "workshop", key: request.key + 1 });
  }

  return (
    <div className="content">
      <PageHead
        eyebrow="Discover"
        title="Find the room where your next step happens."
        description="Hackathons, tech events, and hobby meetups — so FocusBoth is not only the job hunt."
        action={<Status>{filtered.length} of {events.length} events</Status>}
      />

      <section className="card" style={{ marginBottom: 18 }}>
        <form onSubmit={searchNearby}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="eventPlace">Location in the United States</label>
              <select
                id="eventPlace"
                className="input"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
              >
                {placeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="eventHobby">Hobby or interest</label>
              <input
                id="eventHobby"
                className="input"
                placeholder="Photography, running, music…"
                value={hobby}
                onChange={(event) => setHobby(event.target.value)}
              />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn primary" type="submit">Refresh nearby events</button>
            <span className="notice">
              Locations are listed A to Z from the live feeds. Events outside the United States are hidden.
            </span>
          </div>
        </form>
      </section>

      <div className="card-head">
        <div className="filter-row">
          {(["All", "Hackathon", "Tech event", "Hobby"] as const).map((item) => (
            <button className={`filter ${kind === item ? "active" : ""}`} key={item} onClick={() => setKind(item)}>
              {item}
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ width: "min(300px, 100%)" }}
          placeholder="Search title, theme or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading && <p className="lead">Loading current event feeds…</p>}
      {error && <div className="alert"><strong>Could not load</strong><span>{error}</span></div>}

      {!loading && !error && (
        <div className="grid grid-3">
          {filtered.map((event) => {
            const saved = savedIds.includes(event.id);
            return (
              <article className="card event-card" key={event.id}>
                <div className="card-head">
                  <Status tone={event.kind === "Hackathon" ? "good" : event.kind === "Tech event" ? "warn" : "neutral"}>
                    {event.kind}
                  </Status>
                  <span className="notice">{event.source}</span>
                </div>
                <h3 style={{ fontSize: 17 }}>{event.title}</h3>
                <p className="lead" style={{ fontSize: 12, marginTop: 8 }}>
                  {event.online ? "Online" : event.place || event.location}
                </p>
                <p className="notice">{event.dateLabel}</p>
                {event.prizeLabel && <p className="notice" style={{ color: "var(--green)", fontWeight: 800 }}>{event.prizeLabel}</p>}
                <div className="event-tags">
                  {event.themes.slice(0, 3).map((theme) => <span key={theme}>{theme}</span>)}
                </div>
                <div className="actions" style={{ marginTop: "auto", paddingTop: 16 }}>
                  <a className="btn primary" href={event.url} target="_blank" rel="noreferrer">View event</a>
                  <button className="btn secondary" onClick={() => saveEvent(event)}>{saved ? "Saved" : "Save"}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="notice">No events match these filters. Clear the search or select another category.</p>
      )}
    </div>
  );
}
