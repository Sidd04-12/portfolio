# Portfolio — Ops Console

My portfolio, built as a systems monitoring console. Each project is a "service" with a status,
a sparkline driven by its real commit history, and a drill-down panel showing its architecture.

It isn't a static page. There's a React frontend, a Fastify API, and Postgres behind it — and
the dashboard monitors **itself**: the traffic chart plots real visits to the page you're
looking at, and the per-project charts come from live GitHub data synced on a schedule.

```
React + TS (Vercel) ──▶ Fastify + TS (Render) ──▶ Postgres (Neon)
                              │
                              ├─ cron: GitHub stats sync, every 6h
                              └─ cron: nightly visit rollup
```

## Why there's a backend at all

A database holding three project rows that never change would be architecture theatre. The
backend earns its place by doing things a static page can't:

- **Analytics on itself.** Every visit and every project-card open is recorded, so the dashboard
  is monitoring live traffic instead of animating invented numbers. It also answers a question
  worth knowing: *which project do recruiters actually click?*
- **GitHub sync.** A scheduled job pulls stars, language, last-push and 52 weeks of commit
  activity into Postgres. Serving from there means the page never burns GitHub's 60-requests/hour
  unauthenticated rate limit, no matter how many people visit at once.
- **Admin CRUD.** Projects are rows, so content changes are a login and an edit rather than a
  redeploy.

## Privacy: analytics without a tracking database

This collects analytics without being able to identify anyone, by construction rather than by
policy.

**No IP address is stored.** There is no column for one. What's stored is:

```
sha256(ip | user-agent | today's date | server secret)   truncated to 128 bits
```

Two properties follow from that shape:

1. **Not reversible in practice.** Someone who obtained the database still couldn't confirm
   whether a given person visited, because recomputing the hash needs a server-side secret that
   isn't in the database.
2. **Not linkable across days.** The date is an input, so the same visitor hashes differently
   tomorrow. "Unique visitors today" is answerable; "follow this person over time" is not.

Referrers are reduced to their origin before storage — `https://linkedin.com/feed?token=abc`
becomes `https://linkedin.com` — because full URLs carry search terms and tokens that are none
of this application's business.

The cost is a cross-day unique count, which isn't worth building a tracking profile to get.
Nine tests lock these properties in (`src/lib/hash.test.ts`, `src/lib/visitor.test.ts`).

## Design decisions worth explaining

**Daily rollups.** Charting from the raw `visits` table would mean scanning every row ever
recorded on every page load. A nightly job collapses each day into one row, so the 30-day chart
is a 30-row read. Today is the exception — it's read live from `visits`, because otherwise a
freshly deployed site would report "no traffic" for up to 24 hours *while receiving visitors*,
which is wrong exactly when someone is most likely to be looking.

**Free-tier cold starts.** Render sleeps an idle service, so the first request after a quiet
spell can take close to a minute. The page renders immediately regardless and the live figures
fill in when the API wakes; if it never does, the layout still holds and an explanatory note
replaces the numbers. Analytics failures are swallowed entirely — a reader should never see an
error because a metrics write failed.

**Token in memory, not localStorage.** The admin JWT lives in React state, so it doesn't survive
a refresh and can't be read by any script that manages to run on the page. For a single-admin
tool, re-entering a password occasionally is a fair trade.

**Login responses are deliberately identical** whether the email is unknown or the password is
wrong, and an unknown email is still compared against a dummy hash so the two paths take
similar time. Otherwise the endpoint becomes an account-enumeration oracle.

## Running it

```bash
# Postgres
docker compose -f infra/docker-compose.yml up -d

# API
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, VISITOR_HASH_SECRET
npm install
npm run db:migrate
npm run db:seed             # set ADMIN_EMAIL / ADMIN_PASSWORD first to create a login
npm run dev                 # :4000

# Frontend
cd ../frontend
npm install
npm run dev                 # :5173
```

Tests: `cd backend && npm test`

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/projects` | — | Projects plus their synced GitHub metrics |
| GET | `/api/projects/:slug` | — | One project |
| POST | `/api/telemetry/visit` | — | Record a page view (rate limited) |
| POST | `/api/telemetry/event` | — | Record a card open or link click |
| GET | `/api/stats/overview` | — | Summary tile figures |
| GET | `/api/stats/timeseries?days=30` | — | Daily views and uniques |
| POST | `/api/admin/login` | — | Exchange credentials for a JWT (5 attempts / 15 min) |
| GET/POST/PUT/DELETE | `/api/admin/projects` | JWT | Project CRUD |
| POST | `/api/admin/sync` | JWT | Trigger a GitHub sync now |
| GET | `/api/admin/engagement` | JWT | Opens per project |
| GET | `/health` | — | Checks Postgres, not just process liveness |

## Deploying

- **Database** — Neon free tier. Put the connection string in `DATABASE_URL`.
- **Backend** — Render: root `backend`, build `npm install && npm run build`, start
  `npm start`. Set `DATABASE_URL`, `JWT_SECRET`, `VISITOR_HASH_SECRET`, `CORS_ORIGINS`,
  `NODE_ENV=production`, and optionally `GITHUB_TOKEN`.
- **Frontend** — Vercel: root `frontend`, preset Vite. Set `VITE_API_URL` to the Render URL.

Run migrations once against the production database before first use:
`DATABASE_URL=<neon url> npm run db:migrate && npm run db:seed`

## Stack

React 18 · TypeScript · Vite · TanStack Query · Fastify 5 · Drizzle ORM · PostgreSQL 16 ·
Zod · Vitest
