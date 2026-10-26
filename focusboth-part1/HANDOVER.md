# FocusBoth — handover for Claude (continue on another computer)

**Student:** Jessica  
**Product name:** FocusBoth (older name in some files: Compass)  
**Course:** Individual Applied Research Capstone, Fall 2026  
**This snapshot:** 26 October 2026  
**Folder on the original machine:** `C:\Users\ja49116\OneDrive - NetApp Inc\Desktop\Agent AI`  
**npm package name (internal, do not rename casually):** `compass-mvp`  
**Git:** this folder is **not** a git repository. There is no remote. Copy the folder or the zip.

---

## Paste this into Claude on the new computer

> You are continuing Jessica’s capstone, **FocusBoth**. Read `HANDOVER.md` in this folder before changing anything. Then read `README.md`, `FocusBoth_Architecture.md`, and `FocusBoth_Cloud_Agent_Architecture.md`.
>
> FocusBoth is a Next.js 16 + React 19 + TypeScript website for an international student on F-1 OPT / STEM OPT. It keeps a visa clock, a live job feed, a path checker, weekly wellbeing hours, and event discovery in one place.
>
> **Hard product rules — do not break these:**
> 1. The TypeScript rules engine decides feasibility. A language model may only phrase what the engine already computed. Never let an LLM invent visa status, sponsorship, or legal advice.
> 2. Do not scrape LinkedIn, Indeed, Google Search, or Instagram. Use only the public APIs already wired in.
> 3. The app never submits a job application. Apply only opens the employer’s posting URL.
> 4. It is not a lawyer and not a therapist. Visa screens tell the student to confirm with their DSO. Wellbeing is hour planning, not counseling. Crisis line in the US is 988.
> 5. Student name in the demo is **Jessica**.
> 6. This Next.js version differs from older training data. Before changing framework APIs, read `node_modules/next/dist/docs/` and `AGENTS.md`.
>
> What is already built and working locally is listed in this handover. Do not rebuild it. Continue from the planned cloud work unless Jessica asks for a UI fix.

---

## 1. What the product is

One question, one app:

*Is this job or career path actually feasible before my work authorization ends, and does this week still leave room for rest, hobbies, and family?*

Four pieces:

1. **Visa clock** from dates the student types in.
2. **Live US job openings** from public Greenhouse boards (15 employers).
3. **Deterministic rules** that pass or fail a job or a path. No score invented by a model.
4. **Wellbeing budget** — weekly hours for hobbies, learning, and rest.

Tagline in the UI: **Guide and monitor — not a therapist, not a lawyer.**  
Sidebar brand line: **Work and life, same week.**

---

## 2. How to run it on the new computer

Needs **Node.js 20 or newer** (the original machine used Node **v24.21.0**). Install from https://nodejs.org and check **Add to PATH**.

```powershell
cd "<folder you copied>\Agent AI"
npm install
npm run dev
```

Open http://localhost:3000

If PowerShell says `node` or `npm` is not recognized:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
node -v
```

If PowerShell blocks `npm` with `running scripts is disabled` / `PSSecurityException`, do **not** change the machine policy. Call the cmd file:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Leave that terminal open. Closing it stops the site.

Checks:

```powershell
npm run lint
npm run build
```

**Do not copy `node_modules` or `.next`.** Run `npm install` on the new machine. A stale `.next` folder after a rename previously made `/api/openings` and `/api/events` return 404 while the pages still loaded. If APIs 404, delete `.next` and start `npm run dev` again.

---

## 3. Copy this whole project

Take **everything in the Agent AI folder except**:

| Skip | Why |
|---|---|
| `node_modules/` | Reinstall with `npm install` |
| `.next/` | Dev cache. Regenerated on `npm run dev` |
| `.env.local` | Optional Ticketmaster key. Recreate from `.env.example`. Do not commit a real key. |

A zip without those folders should sit next to this file or on the Desktop: `FocusBoth_Handover.zip`.

### Documents to give Claude (already in the folder)

| File | What it is |
|---|---|
| `HANDOVER.md` | This file. Start here. |
| `README.md` | How to run, sources, prototype limits |
| `FocusBoth_Architecture.md` | Layered architecture + 25-step build plan |
| `FocusBoth_Cloud_Agent_Architecture.md` | Target cloud + agent design. Vendor is **AWS or GCP or Azure**, not locked. |
| `FocusBoth_System_Architecture.png` | Diagram for slides / professor |
| `FocusBoth_Data_Flow.png` | Job-search runtime sequence diagram |
| `FocusBoth_System_Architecture.docx` | Written architecture with both figures embedded |
| `FocusBoth_Capstone_Proposal.docx` | Proposal to send (current name: FocusBoth, author Jessica) |
| `Compass_Capstone_Proposal.md` | Markdown source of the proposal. Filename still says Compass. Content was renamed to FocusBoth. |
| `Capstone Project.pptx` | Original course brief |
| `AGENTS.md` / `CLAUDE.md` | Next.js agent warning: this Next version is not the one in training data |

Older Compass-named docx files (`Capstone_Proposal_Compass.docx`, `Compass_Capstone_Proposal.docx`) are previous drafts. Prefer **FocusBoth_** files.

Python scripts that rebuild the Word and PNG files (PNG scripts need Pillow):

- `scripts/build_architecture_png.py` → `FocusBoth_System_Architecture.png`
- `scripts/build_sequence_png.py` → `FocusBoth_Data_Flow.png`
- `scripts/build_docx.py` reads `Compass_Capstone_Proposal.md` and writes `FocusBoth_Capstone_Proposal.docx`
- `scripts/write_proposal_docx.py` and `scripts/validate_docx.py` are helpers for the Word files

The architecture Word file (`FocusBoth_System_Architecture.docx`) is already generated and is in the folder. The script that built it is not in `scripts/` anymore; regenerate from the markdown and the two PNGs if you need a new copy.

---

## 4. Stack

| Piece | Choice |
|---|---|
| Framework | Next.js **16.3.4** App Router, Turbopack in dev |
| UI | React **19.2.8**, client components |
| Language | TypeScript 5 |
| CSS | Tailwind 4 **plus** a custom design system in `app/globals.css` (the screens use the custom classes: `.app-shell`, `.card`, `.btn`, not a component library) |
| Persistence today | Browser `localStorage` only |
| Auth / database | Not built |
| LLM | Not called anywhere yet. Coordinator text is plain TypeScript. |

`next.config.ts` is empty defaults.

---

## 5. Screens

| Route | File | What it does |
|---|---|---|
| `/` | `app/page.tsx` | Today: days left, unemployment, coordinator brief, wellbeing link |
| `/visa` | `app/visa/page.tsx` | Edit visa dates. Source of every later calculation. |
| `/jobs` | `app/jobs/page.tsx` | Live openings + personal tracker. Apply opens the posting. |
| `/paths` | `app/paths/page.tsx` | Three demo paths, four hard checks, runway months |
| `/growth` | `app/growth/page.tsx` | Wellbeing hour goals. Label in nav is **Wellbeing**, URL is `/growth`. |
| `/discover` | `app/discover/page.tsx` | Hackathons, tech conferences, optional hobby events |

Shell and nav: `components/app-shell.tsx`.  
Shared bits: `components/ui.tsx` (`PageHead`, `MetricCard`, `Status`, `Progress`).  
Root layout wraps the store + shell: `app/layout.tsx`.

---

## 6. Rules engine (source of truth)

File: `lib/compass-engine.ts`. Pure functions. No network. No LLM.

**Unemployment**

- F-1 OPT: 90 days
- F-1 STEM OPT: 150 days
- Remaining = cap − `unemploymentDaysUsed`, never below 0

**A tracked job passes** (`jobPassesConstraints`) only if all three are true:

- `sponsorScore` ≥ 60
- `resumeFit` ≥ 65
- `startDate` ≤ `eadEndDate`

Sponsor score and résumé fit on demo jobs are **placeholder numbers**, not DOL data.

**A path passes** (`evaluatePath`) only if all four are true:

1. Starts on or before EAD end
2. At least 20 hours per week
3. Employer is recorded as E-Verify
4. A bona fide employer relationship is recorded

Failure text names the failed rules. Success text includes runway months and “verify with your DSO”.

**Apply**

`applyDestination`: if `applyUrl` is non-empty, open that exact posting. Otherwise open `openingsUrl`. New tab. The app does not fill or submit the form.

`coordinatorBrief` picks the tracked job with the highest sponsor+fit among those that pass, and writes one paragraph. If none pass, it tells the student to widen the search and protect remaining unemployment days.

---

## 7. Data the student owns (browser only)

`components/compass-store.tsx`

| localStorage key | Contents |
|---|---|
| `focusboth-data-v1` | Profile, tracked jobs, paths |
| `focusboth-growth-goals-v1` | Wellbeing goals (`app/growth/page.tsx`) |
| `focusboth-saved-events-v1` | Saved Discover events |

Load path normalizes old records so new fields do not crash. **Reset demo** in the sidebar restores `lib/demo-data.ts`. Demo student name is Jessica. Demo jobs and paths are fabricated.

Nothing personal is sent to a database. It never leaves the browser except when the student clicks Apply or View event (those open a third-party site).

---

## 8. Server APIs

All three run only on the server. Keys never go to the browser. A board or feed that fails is skipped; the route still returns JSON.

### `GET /api/openings` — `app/api/openings/route.ts`

- Calls 15 Greenhouse boards in parallel:  
  `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=false`
- Boards and display names: `lib/job-boards.ts`  
  databricks, stripe, anthropic, figma, reddit, coinbase, brex, gitlab, samsara, instacart, robinhood, discord, duolingo, asana, airtable
- Maps to type `Opening`, drops rows with no `postedAt`, sorts newest first
- Cache: `revalidate = 1800` (30 minutes). Timeout 15s per board.
- Last verified count on the original machine: about **3,844** openings, 15 employers. That number changes daily.

### `POST /api/salaries` — `app/api/salaries/route.ts`

- Body: `{ jobs: [{ board, boardJobId }] }`, max **60**
- Fetches the posting body and `parseSalary` in `lib/job-feed.ts` looks for a published annual range
- Cache 24 hours (`revalidate: 86400`). Timeout 12s.
- If no range is published, the UI says the pay is not listed. It does **not** estimate pay.

### `GET /api/events?city=&hobby=` — `app/api/events/route.ts`

Three sources merged, deduped by URL:

| Source | What | Key |
|---|---|---|
| Devpost | Open + upcoming hackathons, 5 pages each status. `https://devpost.com/api/hackathons` | None |
| confs.tech | Upcoming conferences from GitHub raw JSON. `lib/conference-feed.ts`. Topics: javascript, typescript, python, data, devops, general, java, security, product, ux, api, opensource, android, ios, rust. Current year and next year. | None |
| Ticketmaster Discovery | Hobby keyword + “technology conference”, US, size 50. Only if `TICKETMASTER_API_KEY` is set. | Free consumer key |

`city` is forwarded only to Ticketmaster. Conference and hackathon **place filtering happens in the browser** after `lib/us-locations.ts` normalizes each event.

Cache 30 minutes.

Last verified shape (changes daily): on the order of **~246 events**, of which **~116** resolved as US (many online) and **~25** in-person US across ~20 cities. **~130** were non-US or had no usable city.

---

## 9. Discover location filter (important — already fixed once)

File: `app/discover/page.tsx` + `lib/us-locations.ts`.

The old free-text “San Francisco” box did **not** filter Devpost. Hackathons in Jeddah and Bengaluru still appeared. That was wrong.

Current behavior:

- Dropdown, not a text box.
- Options come from places actually in the feed, sorted A→Z.
- Order: `All United States` (default), `Online`, then cities like `Austin, TX`, then `Outside the US or not specified`.
- `All United States` shows only events with `isUs === true` (includes Online).
- A city option shows only events whose normalized `place` equals that option.
- Card location line uses `event.place` (for example `Boston, MA`), not the raw venue string.
- Header count is `filtered of total`.
- Hobby box still exists. It is sent as `hobby` and only affects Ticketmaster. Without a key, hobby concerts stay empty. Do not put the Ticketmaster warning banner back unless Jessica asks. She asked to remove it.

**Known limit, do not “fix” by guessing:** Devpost often returns only a venue (“Fordham University School of Law”, “Microsoft Building 122”) with no city or country. `resolvePlace` cannot invent a city. Those events go to **Outside the US or not specified** even when the venue is American. A real fix needs a better source field from Devpost or a maintained venue→city table Jessica approves. Do not silently assign San Francisco.

`resolvePlace` understands:

- `City, ST` and `City ST`
- Full state names
- Country tokens `U.S.A.`, `USA`, `US`, `United States` (confs.tech uses `U.S.A.`)
- A short built-in map of common US cities in `US_CITY_TO_STATE`
- Online / virtual / remote → place `Online`, `isUs: true`

Event type (`lib/event-types.ts`):

```ts
place: string;   // "Online" | "Austin, TX" | ""
state: string;   // "TX" or ""
isUs: boolean;
source: "Devpost" | "Ticketmaster" | "confs.tech";
kind: "Hackathon" | "Tech event" | "Hobby";
```

---

## 10. Job Hunt UI

`components/suggested-openings.tsx` loads `/api/openings` once, filters **in the browser**:

- Work type: All / Full-time / Internship (`classifyWorkType` on the title)
- United States only (`isUnitedStates` in `lib/job-feed.ts`)
- Posted within 24h / 3d / 7d / 30d / any
- Employer, location text, role text
- Minimum advertised pay (only hides rows whose parsed range is below the bar; unpublished pay is not invented)
- Page size 10, 25, 50, 100, or all. Sticky header. Scroll.

Visible rows then `POST /api/salaries`.

Tracked applications live in the store. Apply can track first, then open the URL. Toast text says FocusBoth never submits the form.

---

## 11. Environment

`.env.example` and `.env.local` (local is gitignored-style; this folder has no git):

```
TICKETMASTER_API_KEY=
```

Empty on purpose. Hackathons and tech conferences work with no key. To add concerts:

1. https://developer.ticketmaster.com/ — free app, copy **Consumer Key**
2. Put it in `.env.local`
3. Restart `npm run dev` (Next reads env only at startup)

Do not scrape Google or Instagram. There is no supported public search for arbitrary events. That decision is intentional and is written in the README and the proposal.

---

## 12. What is built vs what is not

### Built and demonstrated

- Six screens, responsive shell, custom CSS
- Visa math, path checks, coordinator paragraph
- localStorage + reset demo
- Live Greenhouse openings, salary parse, filters, Apply redirect
- Devpost hackathons + confs.tech conferences
- US location dropdown on Discover
- Architecture diagrams, proposal docx, this handover

### Not built (this is the remaining capstone)

From `FocusBoth_Architecture.md` and `FocusBoth_Cloud_Agent_Architecture.md`. Order matters. Each phase should still demo.

1. **Auth + Postgres** (weeks-style phase 1). Clerk or Auth.js. Supabase or Neon, or RDS / Cloud SQL / Azure Postgres. Replace localStorage behind the existing store so screens stay put. Row-level isolation. Two users must not see each other’s rows.
2. **DOL OFLC LCA pipeline.** Quarterly public disclosure files, offline load, aggregate by employer. Replace mock `sponsorScore`. Show the filing count. Hold out one quarter and check that known sponsors rank higher. This is the quantitative evaluation.
3. **USCIS / SEVP RAG.** Chunk public guidance with source URLs. pgvector. The model may answer only from retrieved chunks and must cite them. Empty retrieval → say so and point to the DSO. The model stays **outside** `evaluatePath` and `jobPassesConstraints`.
4. **Deploy one cloud.** AWS **or** Google Cloud **or** Azure. Not all three. Vercel for the Next app plus that vendor’s Postgres is allowed. Secrets in the platform store. GitHub Actions: lint, typecheck, build.
5. Tests: unit tests for every engine rule; route tests with mocked upstream HTTP.
6. Small usability notes with international students, then the report and slides.

Cloud vendor is **not chosen yet**. Keep diagrams written as OR until Jessica picks one.

---

## 13. Design constraints Claude must keep

- Rules decide. The LLM only explains.
- No LinkedIn, Indeed, Google, or Instagram scraping, even if asked to “just get more jobs/events”.
- No estimated salaries.
- No legal determination of status. Copy on visa screens stays “does not determine status”.
- Wellbeing is quotas and planning. No diagnosis, no therapy chat. 988 stays on that page.
- Apply redirects only.
- Demo data stays obviously demo until a real database exists.
- Adding a Greenhouse employer is one object in `JOB_BOARDS`. A dead token must be skipped, not fail the whole feed.
- Prefer editing the existing files over introducing a new framework, UI kit, or state library.

---

## 14. File map (source)

```
app/layout.tsx                 root layout, metadata, store + shell
app/page.tsx                   Today
app/visa/page.tsx
app/jobs/page.tsx
app/paths/page.tsx
app/growth/page.tsx            Wellbeing
app/discover/page.tsx
app/globals.css                design system
app/api/openings/route.ts
app/api/salaries/route.ts
app/api/events/route.ts
components/app-shell.tsx
components/compass-store.tsx   localStorage focusboth-data-v1
components/suggested-openings.tsx
components/ui.tsx
lib/types.ts
lib/demo-data.ts
lib/compass-engine.ts          rules
lib/job-boards.ts              15 Greenhouse tokens
lib/job-feed.ts                salary, work type, US check, relative time
lib/event-types.ts
lib/conference-feed.ts         confs.tech
lib/us-locations.ts            place normalizer + US city/state tables
```

---

## 15. Trouble already hit (so the next session does not repeat it)

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_CONNECTION_REFUSED` on localhost:3000 | Dev server not running | `npm run dev` and leave the terminal open |
| `node` / `npm` not recognized in PowerShell | Node not on PATH | Prepend `C:\Program Files\nodejs` or reinstall Node with Add to PATH, then open a new terminal |
| `npm.ps1 cannot be loaded` / execution policy | Corporate PowerShell policy | Use `npm.cmd`, not `npm` |
| Pasting `cd "..."` into a window that says `Welcome to Node.js` | That window is the Node REPL, not PowerShell | `.exit` then use PowerShell |
| Port 3000 in use / “another next dev server” | A previous `next dev` is still alive | Use the URL it prints, or stop that PID and start once |
| Pages load but openings/events say unavailable, and `/api/...` is 404 | Stale `.next` after the folder was renamed from `Capstone` to `Agent AI` | Delete `.next`, restart dev |
| Discover shows Jeddah while the city says San Francisco | Old bug. Free-text city did not filter Devpost | Fixed. Use the place dropdown. Do not revert to a text box that only filters conferences. |
| Banner “Nearby events need one free key” | Removed on purpose | Do not restore it |

Folder history: the project lived in `Desktop\Capstone`, then the folder was renamed to `Desktop\Agent AI`. All paths in new work should use **Agent AI**.

---

## 16. Suggested first tasks on the new machine

1. Unzip or copy the folder. `npm install`. `npm run dev`. Open `/`, `/jobs`, `/discover`.
2. Confirm Job Hunt shows live rows and Discover defaults to United States.
3. Read `FocusBoth_Cloud_Agent_Architecture.md` with Jessica and pick **one** cloud.
4. Do not start the LLM until auth + Postgres exist and the engine is still the thing that returns pass/fail.

---

*FocusBoth is informational decision support. It does not provide legal advice, determine immigration status, submit applications, or offer clinical care.*
