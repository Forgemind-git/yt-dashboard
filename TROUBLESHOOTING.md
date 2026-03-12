# Troubleshooting

Common issues and how to fix them.

## "401 Unauthorized" on API calls

**Cause:** `DASHBOARD_API_KEY` is set in `.env` and the request is missing the auth header.

**Fix:**
- For curl: add `-H "Authorization: Bearer <your-key>"` or `-H "x-api-key: <your-key>"`
- For development: leave `DASHBOARD_API_KEY` blank in `.env` to disable auth entirely
- After changing `.env`: `docker compose up -d --force-recreate yt-backend`

## "UNIQUE constraint violated" in collection logs

**Cause:** Data for today has already been collected. This is normal — the collector runs once per day.

**Fix:** Safe to ignore. Each collector uses `ON CONFLICT DO UPDATE` (upsert), so re-running simply overwrites today's data with the latest values.

## AI Strategy page shows errors or empty content

**Cause:** `OPENAI_API_KEY` is not set or is invalid.

**Fix:**
1. Add `OPENAI_API_KEY=sk-...` to your `.env`
2. `docker compose up -d --force-recreate yt-backend`
3. Verify: `curl https://yt.srv879786.hstgr.cloud/api/ai-insights/types`

## Chrome shows "Your connection is not secure"

**Cause:** Traefik is using the wrong cert resolver name, so it falls back to a self-signed certificate.

**Fix:** In `docker-compose.yml`, the cert resolver label MUST be `mytlschallenge` (not `letsencrypt`):
```yaml
- "traefik.http.routers.yt-backend.tls.certresolver=mytlschallenge"
```
After fixing: `docker compose up -d --force-recreate`

## "Cannot connect to database" / backend fails to start

**Cause:** The `nocobase-db` PostgreSQL container is not running, or `DATABASE_URL` is wrong.

**Fix:**
```bash
# Check if the container is running
docker ps | grep nocobase-db

# If not running, start it from the root docker-compose
cd /root && docker compose up -d nocobase-db

# Verify the connection string in .env
cat /root/Yt-dashboard/.env | grep DATABASE_URL
```

## Blank white screen in dashboard

**Cause:** An unhandled JavaScript error crashed the React component tree.

**Fix:**
1. Open browser DevTools → Console and look for the error message
2. Since v2, all pages are wrapped in `<ErrorBoundary>` — a "Something went wrong / Retry" card will appear instead of a blank screen
3. For persistent errors, check `docker compose logs -f yt-backend` for API failures

## `docker compose restart` didn't pick up my `.env` changes

**Cause:** `restart` reuses the existing container config — it does NOT re-read `.env`.

**Fix:** Always use:
```bash
docker compose up -d --force-recreate yt-backend
# or for both services:
docker compose up -d --force-recreate
```

## YouTube API returns "Unknown identifier" errors

**Cause:** The channel is not in the YouTube Partner Program, so certain metrics are unavailable.

**Unavailable metrics:** `impressions`, `impressionClickThroughRate`, `dislikes`

These are already excluded from all collectors. If you see this error after a code change, check that the new collector does not request these metrics.

## Collection never runs / data is stale

**Cause:** The cron scheduler may not have fired, or the backend restarted mid-collection.

**Fix:**
```bash
# Trigger a manual full collection
curl -X POST https://yt.srv879786.hstgr.cloud/api/collect/trigger

# Check collection status
curl https://yt.srv879786.hstgr.cloud/api/collection/logs
```
