# CLAUDE.md — YouTube Analytics Dashboard

## Project Overview

Production YouTube Analytics Dashboard for **Forgemind AI** channel (`UC0aAiWPfJxqMx7ZE7PBvllw`). Collects data from YouTube Analytics & Data APIs, stores in PostgreSQL, serves via Express API, renders with React.

- **Live URL:** `https://yt.srv879786.hstgr.cloud`
- **API Base:** `https://yt.srv879786.hstgr.cloud/api`
- **Host Server:** `srv879786.hstgr.cloud` (Hostinger VPS)

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + Express 4 |
| Frontend | React 18 + Vite 5 + TailwindCSS 3 + Recharts 2 |
| Database | PostgreSQL 16 (reuses existing `nocobase-db` container) |
| Data Fetching | @tanstack/react-query 5 |
| Routing | react-router-dom 6 |
| Auth | Google OAuth2 (googleapis + google-auth-library) |
| Scheduling | node-cron |
| Reverse Proxy | Traefik (SSL via Let's Encrypt) |
| Containers | Docker Compose (2 services, no host ports) |

## Common Commands

```bash
# Full rebuild and deploy
docker compose build && docker compose up -d --force-recreate

# Backend only rebuild (faster)
docker compose build yt-backend && docker compose up -d --force-recreate yt-backend

# Frontend only rebuild
docker compose build yt-frontend && docker compose up -d --force-recreate yt-frontend

# View logs
docker compose logs -f yt-backend
docker compose logs -f yt-frontend

# Trigger data collection manually
curl -X POST https://yt.srv879786.hstgr.cloud/api/collect/trigger

# Check collection status
curl https://yt.srv879786.hstgr.cloud/api/collection/logs

# Test API
curl https://yt.srv879786.hstgr.cloud/api/overview
curl https://yt.srv879786.hstgr.cloud/api/insights/growth
curl https://yt.srv879786.hstgr.cloud/api/insights/content-score

# Check container status
docker compose ps
```

## CRITICAL: Things That Will Bite You

### 1. Traefik cert resolver is `mytlschallenge`
The root Traefik config uses `mytlschallenge`, NOT `letsencrypt`. Using the wrong name = self-signed cert = browser "insecure" warning. Always match labels in `docker-compose.yml`:
```yaml
- "traefik.http.routers.yt-backend.tls.certresolver=mytlschallenge"
```

### 2. `.env` changes require `--force-recreate`
`docker compose restart` reuses the old container config. To pick up `.env` changes:
```bash
docker compose up -d --force-recreate yt-backend
```

### 3. YouTube API metric restrictions
This channel is NOT in the YouTube Partner Program. These metrics will ERROR:
- `impressions` — "Unknown identifier"
- `impressionClickThroughRate` — "Unknown identifier"
- `estimatedRevenue` — returns 0 (not an error, just no data)
- `dislikes` — removed from API entirely

### 4. YouTube Analytics dimension restrictions
These dimension combos are NOT supported reports:
- `day,video` — use `video` only, set snapshot_date manually from endDate
- `day,country` — use `country` only, set snapshot_date manually from endDate
- `day,deviceType,operatingSystem` — this one DOES work (exception)

### 5. Auth functions are async
`getYouTubeAnalytics()` and `getYouTubeData()` are async (they query DB for refresh token). Every collector MUST `await` them:
```js
const analytics = await getYouTubeAnalytics();  // NOT getYouTubeAnalytics()
```

### 6. No host port bindings
Both services connect via `root_default` Docker network. Traefik routes by hostname. No `ports:` in docker-compose.yml.

### 7. `weekOverWeek` is an object, not an array
`GET /insights/growth` returns `weekOverWeek: { thisWeek, lastWeek, twoWeeksAgo }`. Frontend must NOT call `.slice()` or `.map()` directly — destructure the object instead.

### 8. AreaChartCard uses `height={number}` directly on ResponsiveContainer
Do NOT wrap ResponsiveContainer in a div with a percentage height. Pass the pixel height directly: `<ResponsiveContainer width="100%" height={height}>`. Using a wrapper div + `height="100%"` on ResponsiveContainer causes clipping/sizing bugs.

### 9. Date range preset labels are full text
DateRangePicker buttons use "7 days", "28 days", "90 days", "1 year" — NOT "7d", "28d", etc. Use full text in any selectors/tests.

### 10. AI Strategy page is at `/ai`, not `/ai-insights`
The route is `<Route path="ai" element={<AiInsights />} />`. The URL is `https://yt.srv879786.hstgr.cloud/ai`.

## Architecture

### Network Topology
```
Browser → Traefik (443) → yt-frontend (nginx:80)     [priority 1, catch-all]
                        → yt-backend  (express:3001)  [priority 10, /api prefix]

yt-backend → nocobase-db:5432  [internal Docker network, no host exposure]
```

### Database: `yt_analytics` on `nocobase-db`
Credentials: `nocobase` / `nocobasepass123` (same as NocoBase app)

**Tables (9 total):**

| Table | Type | Key Constraint |
|-------|------|---------------|
| `channel_snapshots` | Upsert | UNIQUE(snapshot_date) |
| `video_stats` | Upsert | UNIQUE(video_id, snapshot_date) |
| `traffic_sources` | Upsert | UNIQUE(snapshot_date, source_type) |
| `geography_stats` | Upsert | UNIQUE(snapshot_date, country_code) |
| `device_stats` | Upsert | UNIQUE(snapshot_date, device_type, operating_system) |
| `audience_demographics` | Upsert | UNIQUE(snapshot_date, age_group, gender) |
| `realtime_stats` | Append-only | No upsert, auto-increment |
| `collection_logs` | Append-only | Indexed on run_id |
| `app_settings` | Key-value | PRIMARY KEY(key) — stores refresh token |

### Backend File Map

```
backend/src/
├── server.js                    # Entry: initDB → migrate → startScheduler → listen(:3001)
├── auth/youtube.js              # OAuth2 client, async token from DB/env, consent URL, code exchange
├── db/
│   ├── pool.js                  # pg Pool singleton (max 10, from DATABASE_URL)
│   ├── init-db.js               # CREATE DATABASE yt_analytics (connects to postgres db first)
│   ├── migrate.js               # Reads migrations/*.sql in sorted order
│   └── migrations/
│       ├── 001_init.sql          # 8 tables + indexes
│       └── 002_settings.sql      # app_settings table
├── collectors/
│   ├── channelStats.js           # Analytics API: day dimension, Data API: channel totals
│   ├── videoStats.js             # Analytics API: video dimension, Data API: playlistItems for discovery
│   ├── trafficSources.js         # Analytics API: day,insightTrafficSourceType
│   ├── geography.js              # Analytics API: country dimension only
│   ├── deviceStats.js            # Analytics API: day,deviceType,operatingSystem
│   ├── demographics.js           # Analytics API: ageGroup,gender (returns 0 for small channels)
│   └── realtimeStats.js          # Analytics API: today's views as proxy for real-time
├── jobs/
│   ├── masterCollector.js        # Runs all 7 collectors sequentially, logs each to collection_logs
│   └── scheduler.js              # Cron: full daily@06:00UTC, realtime every 30min
└── api/
    ├── index.js                  # Route aggregator
    ├── helpers.js                # parseDateRange(query) → {from, to, prevFrom, prevTo}
    ├── auth.js                   # GET /auth/init (redirect), GET /auth/callback (save+redirect), GET /auth/status
    ├── overview.js               # GET /overview — KPIs with % change vs previous period
    ├── channel.js                # GET /channel/timeseries — daily views, subs, watch_time, revenue
    ├── videos.js                 # GET /videos/top, /videos/list (paginated), /videos/:videoId
    ├── trafficSources.js         # GET /traffic-sources — grouped by source_type
    ├── geography.js              # GET /geography — grouped by country_code
    ├── devices.js                # GET /devices — separate device and OS breakdowns
    ├── demographics.js           # GET /demographics — age_group × gender
    ├── realtime.js               # GET /realtime — latest + 48h history
    ├── collection.js             # GET /collection/logs, POST /collect/trigger
    ├── insights.js               # GET /insights/* (15 endpoints — see Insights Engine table)
    └── ai-insights.js            # GET /ai-insights/types, GET /ai-insights/:type, POST /ai-insights/chat, POST /ai-insights/generate-titles, POST /ai-insights/generate-all, POST /ai-insights/refresh, GET /ai-insights/notifications
```

### AI Module

```
backend/src/ai/
└── analyzer.js    # gatherChannelData(), 12 ANALYSES, runAnalysis(), chatWithData(), generateVideoTitles(), getSmartNotifications()
                   # Uses openai npm package, model: gpt-4o-mini, in-memory cache (30min analyses, 15min notifications)
```

### Frontend File Map

```
frontend/src/
├── main.jsx                     # ReactDOM.createRoot, QueryClient, BrowserRouter
├── App.jsx                      # Routes: /, /videos, /audience, /insights, /ai, /realtime, /health
├── index.css                    # Tailwind directives, scrollbar, focus ring, reduced-motion
├── api/client.js                # apiFetch() wrapper (VITE_API_URL || /api)
├── context/DateRangeContext.jsx  # Global date range state (presets: 7d/28d/90d/365d + custom)
├── hooks/
│   ├── useOverview.js            # useOverview(), useChannelTimeseries()
│   ├── useVideos.js              # useVideoList(page, limit, sort), useVideoDetail(videoId)
│   ├── useAudience.js            # useTrafficSources(), useGeography(), useDevices(), useDemographics()
│   ├── useRealtime.js            # useRealtime() — refetchInterval: 2min
│   ├── useHealth.js              # useCollectionLogs(), useTriggerCollection()
│   ├── useInsights.js            # 15 hooks for all insight endpoints
│   └── useAiInsights.js          # useAiAnalysisTypes, useAiAnalysis(type), useSmartNotifications, useGenerateAllAnalyses, useRefreshAnalysis, useAiChat, useGenerateTitles
├── components/
│   ├── Layout.jsx                # Sidebar nav + top bar + DateRangePicker + Outlet
│   ├── KpiCard.jsx               # Value + delta% badge (green/red) + format (number/percent/currency/duration)
│   ├── AreaChartCard.jsx         # Recharts AreaChart — uses height={number} directly on ResponsiveContainer (no wrapper div)
│   ├── BarChartCard.jsx          # Recharts BarChart (vertical/horizontal), custom tooltip
│   ├── DonutChartCard.jsx        # Recharts PieChart (donut) with inline legend
│   ├── DateRangePicker.jsx       # Preset buttons ("7 days", "28 days", "90 days", "1 year") + custom date inputs
│   └── Skeleton.jsx              # SkeletonCard, SkeletonChart, SkeletonRow loading states
└── pages/
    ├── Overview.jsx              # KPI grid + views/subs charts + realtime strip
    ├── Videos.jsx                # Sortable table + click-to-expand detail chart + pagination
    ├── Audience.jsx              # Traffic sources bar, geography bars, device donut, demographics grouped bar
    ├── Insights.jsx              # 15 insight sections — growth, content score, lifecycle, upload gaps, subscriber quality, etc.
    ├── AiInsights.jsx            # Route: /ai — AI Strategy Center: 12 analysis cards, Ask Data chat, Title Generator
    ├── Realtime.jsx              # Big numbers + 48h history area chart (auto-refresh 2min)
    └── Health.jsx                # Collection logs table + manual trigger button
```

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| `surface-0` | `#000000` | Page background (OLED black) |
| `surface-1` | `#0a0a0a` | Sidebar, header |
| `surface-2` | `#111111` | Cards (`.card` class) |
| `surface-3` | `#1a1a1a` | Hover states, nested elements |
| `surface-4` | `#222222` | Skeleton loaders, progress bars |
| `surface-5` | `#2a2a2a` | Active states |
| `border` | `#1f1f1f` | Card/element borders |
| `accent` | `#3B82F6` | Primary blue (buttons, charts, active nav) |
| `yt` | `#FF0000` | YouTube red (logo ONLY, not for UI elements) |
| `success` | `#10B981` | Positive changes, success badges |
| `warning` | `#F59E0B` | Warnings, running status |
| `danger` | `#EF4444` | Errors, negative changes |
| Font | Fira Sans | 300-700 weights |

### OAuth Flow (Automated)
1. User visits `/api/auth/init` → redirected to Google consent screen
2. User authorizes → Google redirects to `/api/auth/callback?code=...`
3. Backend exchanges code for tokens → saves refresh_token to `app_settings` DB table
4. Backend redirects user to `/` (dashboard)
5. On subsequent requests, `getRefreshToken()` checks DB first, falls back to `YOUTUBE_REFRESH_TOKEN` env var
6. In-memory cache avoids DB hit on every API call

### Data Collection Schedule
| Job | Schedule | What it does |
|-----|----------|-------------|
| Full collection | Daily 06:00 UTC | All 7 collectors sequentially, each logged to `collection_logs` |
| Realtime | Every 30 min | Appends to `realtime_stats` (views proxy, no concurrent viewers) |

### Insights Engine (unique value over YouTube Studio)
**Original 9 endpoints:**
| Endpoint | What it computes |
|----------|-----------------|
| `/insights/growth` | Daily sub/view rates (7d/28d/90d), milestone projections, acceleration detection. `weekOverWeek` is an **object** `{thisWeek, lastWeek, twoWeeksAgo}` not an array |
| `/insights/content-score` | Weighted score per video vs channel average (S/A/B/C/D grades), engagement rate, like-to-view ratio |
| `/insights/upload-timing` | Best day of week and hour (UTC) based on avg views per upload slot |
| `/insights/outliers` | Z-score analysis: breakout (>1.5σ) and underperforming (<-1σ) videos |
| `/insights/summary` | Auto-generated text insights: view trends, sub rate, top video, top traffic source, top country |
| `/insights/retention` | Watch time per view, estimated retention curves, drop-off analysis |
| `/insights/traffic-roi` | Value score per traffic source: views/effort, sub conversion rates |
| `/insights/channel-health` | Composite health score 0-100 with dimension breakdown |
| `/insights/recommendations` | Prioritized action list with effort/impact scoring |

**New 6 endpoints (Phase 2):**
| Endpoint | What it computes |
|----------|-----------------|
| `/insights/lifecycle` | Video lifecycle stage classification: viral_spike / evergreen / slow_burn / steady_grower; views bucketed into launch/momentum/settling/longTail/evergreen stages |
| `/insights/content-patterns` | Top-performing keywords from titles, format comparison (Shorts vs long-form), title length analysis |
| `/insights/upload-gaps` | Gap detection (>=3 day breaks), cost-per-gap-day in views/subs, upload frequency trend |
| `/insights/subscriber-quality` | Quality score 0-100 = 100 − avgChurnRate, churn spike detection (>2σ), weekly cohort analysis |
| `/insights/growth-benchmark` | 30d window comparisons (current vs 30/60/90d ago), acceleration via linear slope |
| `/insights/subscriber-engagement` | Subscriber vs non-subscriber traffic, Pearson correlation, loyalty trend |

### AI Strategy Engine (`/api/ai-insights/*`)
12 GPT-4o-mini analysis types:
- `channel-health-diagnosis`, `growth-strategy`, `content-gap-analysis`, `audience-deep-dive`
- `thumbnail-title-strategy`, `monetization-readiness`, `algorithm-optimization`, `competitive-positioning`
- `retention-improvement`, `upload-schedule-optimizer`, `seo-keyword-strategy`, `weekly-performance-digest`

**IMPORTANT**: AI type names use **hyphens** (e.g., `channel-health-diagnosis`), NOT underscores.

POST `/ai-insights/chat` — `{ question, history }` → `{ answer, tokensUsed }`
POST `/ai-insights/generate-titles` — `{ topic }` → `{ titles, topic, tokensUsed }`
POST `/ai-insights/generate-all` — triggers all 12 analyses
POST `/ai-insights/refresh` — `{ type }` → refreshes one or all analyses
GET `/ai-insights/notifications` — smart alerts based on recent data

### Testing Infrastructure (`/root/Yt-dashboard/tests/`)
```bash
# Run all Playwright frontend E2E tests (14 tests, ~25s)
cd /root/Yt-dashboard/tests && npx playwright test --config=playwright.config.js

# Run backend API verification (34 endpoints)
cd /root/Yt-dashboard && bash tests/api-verify.sh

# Run with a different base URL
bash tests/api-verify.sh https://localhost:3001
```

**What's tested:**
- All 7 pages load without crashes (including Insights and AI Strategy)
- Charts render with correct dimensions and are not clipped
- Sidebar navigation works
- Date range preset buttons work ("7 days", "28 days", etc.)
- AI Strategy tabs (Analyses, Ask Data, Title Generator) are interactive
- 34 backend API endpoints return valid JSON without errors

## Credentials (in `.env`)
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Redirect: `https://yt.srv879786.hstgr.cloud/api/auth/callback`
- Channel: `UC0aAiWPfJxqMx7ZE7PBvllw`
- DB: `postgresql://nocobase:nocobasepass123@nocobase-db:5432/yt_analytics`

## Adding New Features

### New Collector
1. Create `backend/src/collectors/newCollector.js` (follow existing pattern: await API → transform → upsert)
2. Add migration in `backend/src/db/migrations/003_new_table.sql`
3. Register in `backend/src/jobs/masterCollector.js` COLLECTORS array
4. Add API route in `backend/src/api/newRoute.js`, register in `backend/src/api/index.js`
5. Add hook in `frontend/src/hooks/useNewData.js`
6. Build component/page, add to `App.jsx` routes and `Layout.jsx` nav

### New Insight
1. Add route handler in `backend/src/api/insights.js`
2. Add hook in `frontend/src/hooks/useInsights.js`
3. Add section in `frontend/src/pages/Insights.jsx`

### Deployment
Always rebuild + force-recreate, never just restart:
```bash
docker compose build && docker compose up -d --force-recreate
```
