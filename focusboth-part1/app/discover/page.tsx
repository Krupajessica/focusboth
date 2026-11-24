"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
      <div className="visa-head">
        <div>
          <div className="eyebrow">Discover</div>
          <h1>Find the room where your next step happens.</h1>
        </div>
        <span className="notice" style={{ fontSize: 15, whiteSpace: "nowrap" }}>{filtered.length} of {events.length} events</span>
      </div>

      <form className="filter-row discover-filters" onSubmit={searchNearby}>
        {(["All", "Hackathon", "Tech event", "Hobby"] as const).map((item) => (
          <button type="button" className={`filter ${kind === item ? "active" : ""}`} key={item} onClick={() => setKind(item)}>
            {item}
          </button>
        ))}
        <select id="eventPlace" aria-label="Location in the United States" className="filter" value={place} onChange={(event) => setPlace(event.target.value)}>
          {placeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <input id="eventHobby" aria-label="Hobby or interest" className="filter" placeholder="Interest: photography, running…" value={hobby} onChange={(event) => setHobby(event.target.value)} />
        <button className="filter" type="submit">Refresh</button>
        <input aria-label="Search events" className="filter grow" placeholder="Search title, theme or location" value={query} onChange={(event) => setQuery(event.target.value)} />
      </form>

      {loading && <p className="lead">Loading current event feeds…</p>}
      {error && <div className="alert"><strong>Could not load</strong><span>{error}</span></div>}

      {!loading && !error && (
        <div className="grid event-grid">
          {filtered.map((event, index) => {
            const saved = savedIds.includes(event.id);
            const featured = index === 0;
            return (
              <article className={`card event-card ${featured ? "featured" : ""}`} key={event.id}>
                <div className="card-head">
                  <span className="event-date">{event.dateLabel}</span>
                  {featured ? <span className="chip">Next up</span> : <span className="notice">{event.kind}</span>}
                </div>
                {featured && <span className="event-kind">{event.kind}, {event.online ? "online" : event.place || event.location}</span>}
                <h3>{event.title}</h3>
                {!featured && <p className="notice" style={{ margin: 0 }}>{event.online ? "Online" : event.place || event.location}</p>}
                {event.prizeLabel && <p className="notice" style={{ color: "var(--lime)", fontWeight: 700, margin: 0 }}>{event.prizeLabel}</p>}
                <div className="event-tags">
                  {event.themes.slice(0, 3).map((theme) => <span key={theme}>{theme}</span>)}
                  <span className="src">Source: {event.source}</span>
                </div>
                <div className="actions" style={{ marginTop: "auto", paddingTop: 14 }}>
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
