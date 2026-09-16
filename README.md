# Auto Job Application Assistant

A single-user tool that surfaces remote marketing/sales roles matching Jacob's
background, drafts a tailored resume + cover letter per role via Claude, and
gets every application to a one-click human-review-and-submit step. Full
product spec: [`docs/PRD.md`](docs/PRD.md).

This is a human-in-the-loop assistant, not an auto-submit bot: it never
submits an application on its own (see PRD section 10).

## Stack

- **Frontend**: React + Vite + Tailwind (`client/`)
- **Backend**: Node.js + Express + TypeScript (`server/`)
- **Database**: Postgres via Drizzle ORM
- **AI**: Anthropic API (Claude) for resume/cover-letter tailoring
- **Rendering**: pdf-lib + `docx` for ATS-safe PDF/DOCX export

## Prerequisites

- Node.js 20+
- A Postgres database (either `docker compose up -d`, or a local/managed instance)
- An Anthropic API key (only needed to generate drafts — everything else works without it)

## Setup

```bash
npm install

# Configure env vars (needed in BOTH the repo root and server/, since the
# server process loads .env relative to its own working directory)
cp .env.example .env
cp .env.example server/.env
# edit .env / server/.env: set DATABASE_URL and ANTHROPIC_API_KEY

# Start Postgres (skip if pointing at an existing instance)
docker compose up -d

# Create tables and seed Jacob's base resume
npm run db:generate   # only needed after changing server/src/db/schema.ts
npm run db:migrate
npm run db:seed
```

**Before relying on generated drafts**, edit the seeded `base_resume` row
(`PATCH /api/base-resume` or directly in Postgres) so the experience bullets
reflect Jacob's real, specific accomplishments and metrics — the seed data in
`server/src/db/seed.ts` is a structural placeholder. The tailoring engine only
reorders/lightly rewords what's already there; it never invents content, so
what you put in is what can come out.

## Running locally

```bash
npm run dev
```

This runs the Express API on `:8787` (with Vite's dev proxy forwarding
`/api` and `/generated`) and the React app on `:5173`. Open
http://localhost:5173.

To pull job listings on demand instead of waiting for the scheduled cron,
click "Fetch new matches" in the Review Queue, or:

```bash
npm run ingest
```

## Configuration

See `.env.example` for all variables. Notable ones:

- `GREENHOUSE_BOARD_TOKENS` — comma-separated list of Greenhouse board tokens
  (from `boards.greenhouse.io/<token>`) to pull from. Empty by default —
  RemoteOK and We Work Remotely need no config.
- `SALARY_MIN` — hard salary floor per PRD section 4 (default 60000).
- `INGEST_INTERVAL_MINUTES` — how often the built-in scheduler re-fetches.
- `APP_PASSWORD` — optional single-user password gate. Leave blank for local dev.

## How the pieces fit together

- `server/src/services/connectors/*` — one module per job source (Greenhouse
  JSON API, RemoteOK API, We Work Remotely RSS). Only official, documented
  feeds are used — no scraping (PRD section 9).
- `server/src/services/fitScoring.ts` — tiers jobs (`strong`/`stretch`/
  `excluded`) against the PRD section 4 keyword sets and scores fit 0-100.
- `server/src/services/ingestion.ts` — orchestrates the connectors + scoring
  + salary/remote filters, upserts into `jobs`.
- `server/src/services/claudeTailoring.ts` — calls Claude with the job +
  base resume, validates the response can't have fabricated a role/employer/
  bullet that wasn't already in the base resume (PRD section 6 guardrail —
  note this is a structural check, not a full fact-check; always review a
  draft before approving it).
- `server/src/services/pdfRenderer.ts` / `docxRenderer.ts` — render
  ATS-safe (single column, standard headings, no tables/text boxes) PDF and
  DOCX output.
- `client/src/pages/ReviewQueue.tsx` — approve/skip queue with a daily
  reviewed-applications counter.
- `client/src/pages/ApplicationDetail.tsx` — generate/edit the draft, then
  hand off to the source site's own apply flow (manual submit, per PRD
  section 10 — no auto-submission).
- `client/src/pages/Tracker.tsx` — status board (Saved → Drafted → Submitted
  → Response → Interview → Closed).

## Not yet built (Phase 2/3 per PRD)

Daily email/Slack digest, follow-up reminders, ATS-native submission APIs,
additional job sources, response-rate analytics.
