# FocusBoth

**Predicting H-1B sponsorship for OPT job seekers with U.S. DOL data.**
BAN 693 Business Analytics Capstone, CSU East Bay, Fall 2026. Author: Jessica Anguluri.

FocusBoth is a web app for F-1 students on OPT / STEM OPT. It keeps a visa clock, live job openings,
a rules engine for visa feasibility, weekly wellbeing hours, events, and an AI assistant in one place.
Its sponsorship signal is built from **539,975 H-1B Labor Condition Applications** (DOL OFLC, FY2025 Q4 to FY2026 Q3).

**Design rule: the rules engine decides; models and the language model only inform and explain.**

## What is in this repository

| Folder | Contents |
|---|---|
| `analytics/` | Python ETL, star schema, models M1-M3, robustness checks, charts, exports |
| `app/`, `components/`, `lib/` | Next.js 16 app (7 screens, API routes, rules engine, TypeScript model inference) |
| `lib/data/` | Exported model outputs used by the app (employer signal, title model, wages, policy corpus) |
| `eval/` | Question set and live evaluation for the Ask FocusBoth assistant |
| `scripts/load-neon.mjs` | Loads the star schema into Neon (cloud Postgres) |
| `report/` | Script that builds the capstone report (.docx/.pdf) from the metrics |
| `tests/`, `analytics/tests/` | TypeScript (vitest) and Python (pytest) tests |

## Models

| Model | Task | Held-out result |
|---|---|---|
| M1 | Will an employer file a new-hire H-1B LCA next quarter? (XGBoost vs logistic regression vs baselines) | ROC-AUC 0.773 vs 0.703 baseline |
| M2 | Job title to SOC occupation (TF-IDF + logistic regression) | 70.4% top-1, 87.0% top-3 |
| M3 | Sponsored wage regression (XGBoost) | MAE $20.6k vs $33.8k baseline |
| Assistant | Gemini tool-calling agent with BM25 retrieval over 8 CFR 214.2 and USCIS pages | see `outputs/assistant_eval.json` |

## Reproduce the analytics

1. Download the LCA disclosure files from https://www.dol.gov/agencies/eta/foreign-labor/performance into `data/raw/`.
2. `pip install -r analytics/requirements.txt`
3. Run in order: `etl.py`, `models.py`, `robustness.py`, `export.py`, `export_title_model.py`, `charts.py`, `report_facts.py`
4. Policy corpus: `parse_ecfr.py`, then `build_policy_corpus.py`

## Run the app

```bash
npm install
cp .env.example .env.local   # optional keys: GEMINI_API_KEY, DATABASE_URL, TICKETMASTER_API_KEY
npm run dev
```

Checks: `npm run lint && npm run typecheck && npm test && npm run build`

## Boundaries

FocusBoth is informational decision support. It does not provide legal advice, determine immigration
status, predict visa outcomes, submit job applications, or offer clinical care. LinkedIn, Indeed, Google
and Instagram are not scraped. In a U.S. crisis, call or text 988.

## Use of generative AI

Built with Cursor (prototype app) and Claude (analytics, models, assistant, tests, report drafting).
All outputs were reviewed and verified by the author; see Section 7 of the report.
