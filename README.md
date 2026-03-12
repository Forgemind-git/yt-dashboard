# YouTube Analytics Dashboard

Production-grade YouTube Analytics Dashboard with automated data collection, real-time monitoring, and interactive visualizations.

## Stack

- **Backend:** Node.js + Express + PostgreSQL + YouTube Analytics API
- **Frontend:** React + Vite + TailwindCSS + Recharts + React Query
- **Infrastructure:** Docker Compose + Traefik (SSL/routing) + nginx

## Prerequisites

- Docker & Docker Compose
- Traefik reverse proxy running on `root_default` network
- Existing PostgreSQL container (`nocobase-db`) on `root_default` network
- Google Cloud project with YouTube Analytics API and YouTube Data API v3 enabled

## Setup

### 1. Google OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth2 credentials (Web application type)
3. Set authorized redirect URI: `https://yt.srv879786.hstgr.cloud/api/auth/callback`
4. Enable **YouTube Analytics API** and **YouTube Data API v3**

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Google OAuth2 credentials
```

### 3. Start Services

```bash
docker compose up -d --build
```

### 4. Authenticate YouTube Account

Authentication is fully automated:

1. Visit `https://yt.srv879786.hstgr.cloud/api/auth/init` in your browser
2. Authorize with your YouTube/Google account
3. You will be redirected back to the dashboard automatically
4. The refresh token is saved to the database — no manual copying needed

To check auth status: `curl https://yt.srv879786.hstgr.cloud/api/auth/status`

### 5. Trigger First Collection

```bash
curl -X POST https://yt.srv879786.hstgr.cloud/api/collect/trigger
```

## Access

- **Dashboard:** https://yt.srv879786.hstgr.cloud
- **API:** https://yt.srv879786.hstgr.cloud/api

## Data Collection Schedule

| Collector | Schedule | Description |
|-----------|----------|-------------|
| Full collection | Daily at 06:00 UTC | Channel stats, videos, traffic, geo, devices, demographics |
| Realtime stats | Every 30 minutes | View counts and concurrent viewers |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/overview` | KPI summary with % change |
| `GET /api/channel/timeseries` | Daily views & subscribers |
| `GET /api/videos/top` | Top 10 videos by views |
| `GET /api/videos/list` | Paginated video list |
| `GET /api/videos/:id` | Single video timeseries |
| `GET /api/traffic-sources` | Traffic source breakdown |
| `GET /api/geography` | Country-level data |
| `GET /api/devices` | Device & OS breakdown |
| `GET /api/demographics` | Age & gender demographics |
| `GET /api/realtime` | Latest realtime snapshot |
| `GET /api/collection/logs` | Collection run history |
| `POST /api/collect/trigger` | Manual collection trigger |

### Insights Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/insights/growth` | Subscriber/view velocity, milestone projections, acceleration |
| `GET /api/insights/content-score` | Per-video weighted scores (S/A/B/C/D grades) |
| `GET /api/insights/upload-timing` | Best day/hour to publish based on view history |
| `GET /api/insights/outliers` | Z-score breakout and underperforming videos |
| `GET /api/insights/summary` | Auto-generated text insights |
| `GET /api/insights/retention` | Watch time per view, estimated retention curves |
| `GET /api/insights/traffic-roi` | Value per traffic source (views/effort) |
| `GET /api/insights/channel-health` | Composite score 0-100 across 6 dimensions |
| `GET /api/insights/recommendations` | Prioritized action list with effort/impact |
| `GET /api/insights/lifecycle` | Video lifecycle stage classification |
| `GET /api/insights/content-patterns` | Title keywords, format comparison, title length |
| `GET /api/insights/upload-gaps` | Gap detection, cost-per-gap-day in views/subs |
| `GET /api/insights/subscriber-quality` | Churn rate, quality score, weekly cohort |
| `GET /api/insights/growth-benchmark` | 30/60/90-day window comparisons |
| `GET /api/insights/subscriber-engagement` | Subscriber vs non-subscriber traffic, Pearson correlation |

All endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: last 28 days).

## Standalone Database Setup

For deploying to new clients without the Node.js backend:

```bash
psql -h <host> -U <user> -d postgres -c "CREATE DATABASE yt_analytics;"
psql -h <host> -U <user> -d yt_analytics -f db/init.sql
```

## Logs & Monitoring

```bash
# View backend logs
docker compose logs -f yt-backend

# View frontend logs
docker compose logs -f yt-frontend

# Check collection health via API
curl https://yt.srv879786.hstgr.cloud/api/collection/logs
```
