# FocusBoth: Work and Life on the Same Clock

**Applied Research Project Proposal — Fall 2026 Capstone**  
Submitted by: Jessica  |  Individual Applied Research Project  |  September 3, 2026

---

## 1. Introduction

International students on F-1 OPT and STEM OPT must make high-stakes career decisions against a legal clock that does not pause for interviews, family time, or a hobby. Unemployment days are capped. An EAD end date is a hard stop. Many employers never sponsor. The same week, a call home lands on a live lecture, and rest hours disappear into extra applications. Generic job boards ignore the visa clock. Generic chatbots invent immigration rules. Wellbeing apps ignore OPT. University portals track dates but not whether a role starts after the EAD ends.

**Problem statement.** An international student cannot tell, in one place, whether a job or a career path is *feasible under their visa dates*, and whether this week still leaves room for rest, hobbies, and family — using live openings and public data rather than guesswork.

**Why it matters.** Student mental health and wellbeing are not a side quest. Constant deadline pressure without a weekly budget for hobbies and personal growth is how people burn out before an offer arrives. FocusBoth is a production-quality web application that treats the EAD date as a first-class constraint, ranks live employer postings, explains path trade-offs, *and* monitors hobby, learning, and rest hours so Jessica can focus on **both work and life**. It is a guide and a monitor. It is not a therapist and not a lawyer.

A working individual prototype already exists (Next.js): dashboard, visa clock, live job feed, path navigator, wellbeing/growth goals, and a hackathon/hobby event discover tab. The research contribution is the **constraint layer plus grounded generation**, not another chatbot wrapper.

---

## 2. Related Work

Existing tools each cover one slice of the problem:

- **Visa / OPT trackers** (university DSO portals, Sprintax, Boundless): dates and filing reminders; no job-market or start-date feasibility.
- **Sponsorship lookup sites** (MyVisaJobs, H-1B grader tools): historical LCA counts as a static search; they do not re-rank *today’s* postings against *this student’s* EAD.
- **Job portals** (LinkedIn, Indeed, Greenhouse career sites): volume without visa constraints. Scraping those portals for a capstone would violate terms of use; FocusBoth instead uses **employers’ own public board APIs**.
- **Generic LLM career chat**: fluent advice with no personal dates, no citations to USCIS text, and no unemployment-day arithmetic.
- **Wellbeing / journaling apps**: address mood in isolation, with no connection to the visa and job-search hours that actually steal rest and hobbies.

**Gap.** Integration, not a new visa statute. Techniques (LCA aggregation, semantic job matching, RAG over public policy, event feeds) are established. What is missing is a single student-facing system that **refuses infeasible paths** (for example full-time self-employment on STEM OPT) instead of ranking them as merely “risky.”

---

## 3. Research Objectives

This individual applied research project will:

1. Treat **EAD end date, unemployment allowance, and start date** as hard constraints on jobs and career scenarios, with transparent pass/fail checks a student (and a grader) can audit.
2. Ingest **live U.S. job postings** from public Greenhouse employer boards (not Kaggle, not LinkedIn scrape), with recency, location, role type, and advertised pay where published.
3. Build a **sponsorship-likelihood signal** from public DOL LCA disclosure files (past filings, explicitly *not* a promise of future sponsorship).
4. Provide **retrieval-augmented Q&A** over official USCIS / SEVP public guidance, with citations, and a guarded LLM that only phrases tool outputs.
5. Include **personal growth, hobbies, and rest quotas** because student mental health depends on protecting those hours, not only on landing an interview.
6. Ship a **cloud-hosted web app** with authentication and a database, plus LinkedIn/Medium documentation of Gen AI use as required by the course.

Success is a working public demo plus a limitations section that is honest about coverage (configured employers, not every U.S. job) and about legal scope (informational only).

---

## 4. Data

### 4.1 Data sources (four or more)

| Source | Live? | Role in FocusBoth |
|---|---|---|
| **Greenhouse Job Board API** (`boards-api.greenhouse.io`) | Yes. Cached ~30 minutes. | Current openings, exact apply URLs, first-published timestamps. Prototype currently covers 15 employer boards (~3,800 postings). |
| **Devpost public hackathon JSON** (`devpost.com/api/hackathons`) | Yes. | Discover tab: open/upcoming hackathons, themes, dates, organizer URLs. |
| **DOL OFLC LCA disclosure files** | Public bulk files (quarterly). Pipeline in scope; prototype still uses placeholder sponsor scores on *tracked* applications. | Employer-level filing counts for a sponsorship *signal*. |
| **USCIS / SEVP public web guidance** (OPT, STEM OPT) | Public HTML/PDF corpus. RAG in scope. | Cited answers; not case-specific determinations. |
| **User-entered profile** | Local now; cloud DB after auth. | Program end, EAD dates, unemployment days used, résumé, goals, weekly hours. |
| **Optional: Ticketmaster Discovery API** | Live, free developer key. | Nearby tech/hobby events when `TICKETMASTER_API_KEY` is set. |

**Not used:** Kaggle dumps as the primary job corpus. **Not scraped:** LinkedIn, Indeed, Google Events, or arbitrary Instagram pages (no supported public events API for those use cases).

### 4.2 Features and characteristics

- Job records: employer, title, location, work type (full-time vs internship), posted time, apply URL, advertised annual pay range when parsed from pay-transparency text.
- LCA aggregates: employer name (normalized), filing volume over a lookback window, optional wage/SOC fields.
- Policy chunks: URL, retrieved passage, retrieval score.
- Constraints derived in code: days to EAD, remaining unemployment days, start-before-EAD, weekly-hour and E-Verify flags on path scenarios.

### 4.3 Limitations

- Greenhouse coverage is **limited to boards we register**, not the entire U.S. labor market. Expanding boards or adding USAJOBS/Adzuna (keyed APIs) is the honest scale path.
- LCA is **historical behavior**, not a hiring guarantee.
- USCIS text **changes**; RAG must re-index and always disclaim “not legal advice / confirm with a DSO.”
- Salary appears only when the employer publishes a range.
- Prototype student data currently lives in **browser storage**, not yet in the cloud.

---

## 5. Proposed Methods

**Application.** Next.js (TypeScript) web app: Today, Visa Clock, Job Hunt, Path Navigator, Growth & Balance, Discover. Constraint engine is deterministic TypeScript (`lib/compass-engine.ts`). Gen AI is used for implementation speed and, later, for phrasing retrieved facts—never as the visa rule source.

**Job feed.** Server routes pull Greenhouse list endpoints; Apply opens `absolute_url` for that job id. Salary lookup fetches posting HTML and parses published ranges.

**Sponsorship model (to complete).** Baseline: employer filing count / recency heuristics from LCA. Comparison model: gradient-boosted classifier (e.g. XGBoost or scikit-learn GBM) on engineered employer features vs. a simple frequency baseline. Output is a 0–100 **signal** shown next to résumé-fit.

**RAG (to complete).** Chunk USCIS STEM OPT pages; embeddings + vector store; answers must include source URL. Empty retrieval → “ask your DSO,” not a hallucinated rule.

**Guarded LLM (to complete).** System prompt: only summarize tool JSON (dates, scores, retrieved chunks). No immigration determinations.

**Events.** Devpost for hackathons; optional Ticketmaster for city + interest search. The Wellbeing tab logs hobby, learning, and rest hours against weekly quotas so job hunting does not erase personal development. Discover includes hobby-related events, not only career fairs.

**Cloud (to complete).** Auth (Clerk or Auth.js) + Postgres (Supabase/Neon) replacing `localStorage`. Host on Vercel or GCP Cloud Run / AWS with student credits. Same UI contract as the current prototype.

**Evaluation.** (1) Constraint tests: known blocked path (full-time founder) must fail. (2) RAG: citation present on a held-out USCIS question set. (3) Feed: non-zero last-24-hour postings from live boards. (4) Honest coverage metrics: employers in feed vs. U.S. total.

**Sequencing (individual, 2 months).** Working UI first (done). Then auth + DB + deploy. Then LCA pipeline. Then RAG + guarded briefing. Then tests, report, LinkedIn post, public presentation.

---

## 6. References

1. U.S. Department of Labor, Office of Foreign Labor Certification. *LCA Disclosure Data*. https://www.dol.gov/agencies/eta/foreign-labor/performance  
2. U.S. Citizenship and Immigration Services. *Optional Practical Training (OPT) for F-1 Students*. https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students  
3. Greenhouse. *Job Board API*. https://developers.greenhouse.io/job-board.html  
4. Devpost. Public hackathon listing endpoint used by the Devpost website (`/api/hackathons`).  
5. Ticketmaster. *Discovery API*. https://developer.ticketmaster.com/  
6. Lewis, P., et al. “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.” *NeurIPS*, 2020.  
7. Chen, T., & Guestrin, C. “XGBoost: A Scalable Tree Boosting System.” *KDD*, 2016.

---

## 7. Roles and Contributions

This is an **individual** applied research project (course maximum group size is four, not a minimum). Jessica owns data engineering, constraint/ML logic, frontend, APIs, deployment, report, LinkedIn/Medium post, and presentation.

**Gen AI use (course requirement).** Cursor and similar assistants are used for scaffolding and coding. Architectural choices, visa-disclaimer language, data-source decisions, validation of live APIs, and all numbers shown to users are checked by the student. Live immigration answers will be retrieval-grounded, not model memory.

---

## 8. Weekly Timeline

| Week | Milestone | Details |
|---|---|---|
| 0 (done) | Working website MVP | Next.js app: dashboard, visa clock, live Greenhouse jobs, path rules, growth, Devpost discover. Local only. |
| 1–2 | Auth, database, public URL | Clerk/Auth.js + Postgres; deploy Vercel or Cloud Run. Replace `localStorage`. |
| 2–3 | DOL LCA pipeline | Download disclosure files; employer name match; replace placeholder sponsor scores. Baseline vs. boosted model. |
| 3–4 | Visa RAG + guarded briefing | USCIS corpus, citations, “not legal advice.” LLM phrases tool output only. |
| 4 | Broader jobs (optional stretch) | More Greenhouse/Lever tokens and/or USAJOBS key. No LinkedIn scrape. |
| 5 | Ticketmaster key + tests | Nearby events if key approved; unit tests for constraints and salary parser; security pass. |
| 6 | Report, repo, LinkedIn/Medium | Applied research write-up; document Gen AI use; public repository. |
| 7 | Presentation + buffer | Slides, Presentation Coach, on-camera Zoom; no new features. |

---

## 9. Budget

| Item | Estimated cost | Notes |
|---|---|---|
| Compute + Postgres hosting | $0–30 | Student credits / Vercel hobby / Supabase free. |
| Vector store | $0 | pgvector or local Chroma. |
| LLM API (dev + demo) | $0–40 | Groq/Gemini free tier first; hard cap if paid. |
| Ticketmaster Discovery | $0 | Free developer quota (5,000 calls/day typical). |
| Greenhouse + Devpost + DOL + USCIS | $0 | Public. |
| Domain (optional) | $0–15 | |
| **Total** | **$0–85** | Tracked weekly; stay on free tiers so the course budget rule is not triggered. |

**Permissions.** No USCIS/DOL special access. No LinkedIn partnership. Ticketmaster and optional USAJOBS require **free API keys** only. User research on classmates would need simple consent; this MVP does not collect others’ immigration documents.

---

*FocusBoth is informational decision support. It does not provide legal advice, determine immigration status, submit job applications, or offer clinical mental-health treatment. In a U.S. crisis, call or text 988.*
