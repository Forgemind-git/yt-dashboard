# Development Guide

Local development setup for the YouTube Analytics Dashboard.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for production deploy)
- A Google Cloud project with **YouTube Analytics API** and **YouTube Data API v3** enabled
- OAuth2 credentials (Web application type) with redirect URI: `https://yt.srv879786.hstgr.cloud/api/auth/callback`
- An existing PostgreSQL instance reachable from your local machine (or run one via Docker)

## Environment Setup

```bash
cp .env.example .env
# Fill in the required values — see comments in .env.example
```

Key variables to set:
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth2 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `YOUTUBE_CHANNEL_ID` | Your channel ID (e.g. `UC0aAiWPfJxqMx7ZE7PBvllw`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DASHBOARD_API_KEY` | Optional Bearer token gating all `/api` routes (leave blank to disable) |
| `OPENAI_API_KEY` | Required for AI Strategy page (`/ai`) |

## Running Locally (without Docker)

### Backend

```bash
cd backend
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/yt_analytics node src/server.js
```

The backend starts on port **3001**. It auto-runs DB migrations on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts on port **5173**. It proxies `/api` to `http://localhost:3001` via Vite's proxy config.

## Running Tests

### Backend unit tests

```bash
cd backend
npm install
npm test
```

Runs Jest on `src/**/*.test.js` — tests pure utility functions from `insights.js` and `helpers.js`.

### Frontend E2E tests (Playwright)

```bash
cd tests
npx playwright install chromium  # first time only
npx playwright test --config=playwright.config.js
```

Runs 14 tests against the live production URL by default. To test locally:

```bash
BASE_URL=http://localhost:5173 npx playwright test --config=playwright.config.js
```

### Backend API verification

```bash
bash tests/api-verify.sh
# or against a different base URL:
bash tests/api-verify.sh http://localhost:3001
```

Checks all 34 API endpoints return valid JSON.

## Port Conflicts

If port 3001 or 5173 is already in use:

```bash
# Override backend port
PORT=3002 node src/server.js

# Override frontend port
cd frontend && npx vite --port 3000
```

Update `VITE_API_URL` in `.env` to match if changing the backend port.

## Mock Data

There is no built-in mock data mode. To develop without a real YouTube channel:

1. Seed the database manually with sample rows in `channel_snapshots`, `video_stats`, etc.
2. The schema is defined in `backend/src/db/migrations/001_init.sql`.
3. All API endpoints gracefully return empty arrays/objects when the DB has no data.

## Deploying

Always use `--force-recreate` to pick up `.env` changes:

```bash
docker compose build && docker compose up -d --force-recreate
```
