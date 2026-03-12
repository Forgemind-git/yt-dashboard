#!/bin/bash
# Backend API Verification Script
# Tests all API endpoints: existence, JSON validity, response shape, edge cases
# Usage: ./tests/api-verify.sh [BASE_URL]

BASE="${1:-https://yt.srv879786.hstgr.cloud/api}"
PASS=0
FAIL=0
ERRORS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

check() {
  local name="$1" url="$2" method="${3:-GET}" body="${4:-}" expect_keys="${5:-}"
  local resp status

  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    resp=$(curl -s -X POST "$url" -H "Content-Type: application/json" -d "$body" --max-time 30)
  else
    resp=$(curl -s "$url" --max-time 30)
  fi
  status=$?

  if [ $status -ne 0 ]; then
    echo -e "  ${RED}✗${NC} $name — curl error $status"
    FAIL=$((FAIL+1)); ERRORS+=("$name: curl error $status"); return
  fi

  if ! echo "$resp" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    echo -e "  ${RED}✗${NC} $name — invalid JSON"
    FAIL=$((FAIL+1)); ERRORS+=("$name: invalid JSON"); return
  fi

  local err
  err=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','') if isinstance(d,dict) else '')" 2>/dev/null)
  if [ -n "$err" ] && [ "$err" != "" ]; then
    echo -e "  ${YELLOW}⚠${NC} $name — error: $err"
    FAIL=$((FAIL+1)); ERRORS+=("$name: error=$err"); return
  fi

  if [ -n "$expect_keys" ]; then
    for key in $expect_keys; do
      local has
      has=$(echo "$resp" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d,dict): print('yes' if '$key' in d else 'no')
elif isinstance(d,list): print('yes' if len(d)>0 else 'empty')
else: print('no')
" 2>/dev/null)
      if [ "$has" = "no" ]; then
        echo -e "  ${YELLOW}⚠${NC} $name — missing key '$key'"
        FAIL=$((FAIL+1)); ERRORS+=("$name: missing key '$key'"); return
      fi
    done
  fi

  echo -e "  ${GREEN}✓${NC} $name"
  PASS=$((PASS+1))
}

check_status() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 15)
  if [ "$code" = "$expect" ]; then
    echo -e "  ${GREEN}✓${NC} $name — HTTP $code"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}✗${NC} $name — expected HTTP $expect, got $code"
    FAIL=$((FAIL+1)); ERRORS+=("$name: HTTP $code (expected $expect)")
  fi
}

check_header() {
  local name="$1" url="$2" header="$3" expect="$4"
  local val
  val=$(curl -sI "$url" --max-time 10 | grep -i "^${header}:" | head -1 | cut -d: -f2- | tr -d ' \r\n')
  if echo "$val" | grep -qi "$expect"; then
    echo -e "  ${GREEN}✓${NC} $name — $header: $val"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}✗${NC} $name — $header not matching '$expect' (got: $val)"
    FAIL=$((FAIL+1)); ERRORS+=("$name: $header='$val' missing '$expect'")
  fi
}

section() { echo -e "\n${YELLOW}${BOLD}$1${NC}"; }

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  YouTube Analytics Dashboard — API Verification${NC}"
echo -e "${CYAN}  Base URL: $BASE${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── HTTP Status & Headers ─────────────────────────────────────────────────────
section "HTTP Status Codes"
check_status "Overview — 200 OK"         "$BASE/overview"
check_status "Auth status — 200 OK"      "$BASE/auth/status"
check_status "Unknown route — 404"       "$BASE/this-does-not-exist" "404"

section "Response Headers"
check_header "Overview Content-Type"     "$BASE/overview"      "content-type" "application/json"
check_header "Realtime Content-Type"     "$BASE/realtime"      "content-type" "application/json"
check_header "Auth status Content-Type"  "$BASE/auth/status"   "content-type" "application/json"

# ── Core Endpoints with Shape Validation ──────────────────────────────────────
section "Core Endpoints"
check "Overview KPIs — has views/subscribers"     "$BASE/overview"            "GET" "" "views subscribers"
check "Channel Timeseries"                         "$BASE/channel/timeseries"
check "Realtime — has latest/history"              "$BASE/realtime"            "GET" "" "latest history"
check "Auth Status — has authenticated"            "$BASE/auth/status"         "GET" "" "authenticated"
check "Collection Logs"                            "$BASE/collection/logs"

# ── Date Range Params ─────────────────────────────────────────────────────────
section "Date Range Parameters"
check "Overview — 7d range"          "$BASE/overview?from=2026-03-05&to=2026-03-12"
check "Overview — 90d range"         "$BASE/overview?from=2025-12-12&to=2026-03-12"
check "Channel Timeseries — 7d"      "$BASE/channel/timeseries?from=2026-03-05&to=2026-03-12"
check "Traffic sources — with range" "$BASE/traffic-sources?from=2026-01-01&to=2026-03-12"

# ── Video Endpoints ───────────────────────────────────────────────────────────
section "Video Endpoints"
check "Top Videos"                  "$BASE/videos/top"
check "Video List — page 1"         "$BASE/videos/list?page=1&limit=10"    "GET" "" "data total page"
check "Video List — page 2"         "$BASE/videos/list?page=2&limit=5"     "GET" "" "data"
check "Video List — sort by views"  "$BASE/videos/list?page=1&sort=views"
check "Video List — sort by likes"  "$BASE/videos/list?page=1&sort=likes"
check "Video Detail — known ID"     "$BASE/videos/Lo_Vit176Sc"

# ── Audience Endpoints ────────────────────────────────────────────────────────
section "Audience Endpoints"
check "Traffic Sources"   "$BASE/traffic-sources"
check "Geography"         "$BASE/geography"
check "Devices — has devices/operatingSystems" "$BASE/devices" "GET" "" "devices operatingSystems"
check "Demographics"      "$BASE/demographics"

# ── Original Insights ─────────────────────────────────────────────────────────
section "Original Insight Endpoints"
check "Growth — has projections/weekOverWeek"  "$BASE/insights/growth"        "GET" "" "projections weekOverWeek"
check "Content Score — has videos/channelAvg"  "$BASE/insights/content-score" "GET" "" "videos channelAvg"
check "Upload Timing — has byDay/byHour"       "$BASE/insights/upload-timing" "GET" "" "byDay byHour"
check "Outliers"                               "$BASE/insights/outliers"
check "Summary — has insights"                 "$BASE/insights/summary"       "GET" "" "insights"
check "Channel Health — has overallScore"      "$BASE/insights/channel-health" "GET" "" "overallScore"
check "Retention Analysis"                     "$BASE/insights/retention"
check "Traffic ROI"                            "$BASE/insights/traffic-roi"
check "Recommendations"                        "$BASE/insights/recommendations"

# ── Phase 2 Insight Endpoints ─────────────────────────────────────────────────
section "Phase 2 Insight Endpoints"
check "Lifecycle — has videos/channelProfile"     "$BASE/insights/lifecycle"           "GET" "" "videos channelProfile"
check "Content Patterns"                          "$BASE/insights/content-patterns"
check "Upload Gaps — has costPerGapDay"           "$BASE/insights/upload-gaps"
check "Subscriber Quality — has qualityScore"     "$BASE/insights/subscriber-quality"  "GET" "" "qualityScore"
check "Growth Benchmark"                          "$BASE/insights/growth-benchmark"
check "Subscriber Engagement"                     "$BASE/insights/subscriber-engagement"

# ── AI Insights — All 12 Types ────────────────────────────────────────────────
section "AI Insight Endpoints — All 12 Types"
check "AI Types list — has types array"              "$BASE/ai-insights/types"                   "GET" "" "types"
check "AI Notifications"                             "$BASE/ai-insights/notifications"
check "AI: channel-health-diagnosis"                 "$BASE/ai-insights/channel-health-diagnosis"
check "AI: growth-strategy"                          "$BASE/ai-insights/growth-strategy"
check "AI: content-gap-analysis"                     "$BASE/ai-insights/content-gap-analysis"
check "AI: audience-deep-dive"                       "$BASE/ai-insights/audience-deep-dive"
check "AI: thumbnail-title-strategy"                 "$BASE/ai-insights/thumbnail-title-strategy"
check "AI: monetization-readiness"                   "$BASE/ai-insights/monetization-readiness"
check "AI: algorithm-optimization"                   "$BASE/ai-insights/algorithm-optimization"
check "AI: competitive-positioning"                  "$BASE/ai-insights/competitive-positioning"
check "AI: retention-improvement"                    "$BASE/ai-insights/retention-improvement"
check "AI: upload-schedule-optimizer"                "$BASE/ai-insights/upload-schedule-optimizer"
check "AI: seo-keyword-strategy"                     "$BASE/ai-insights/seo-keyword-strategy"
check "AI: weekly-performance-digest"                "$BASE/ai-insights/weekly-performance-digest"

# ── AI POST Endpoints ─────────────────────────────────────────────────────────
section "AI POST Endpoints"
check "AI Chat — has answer"             "$BASE/ai-insights/chat"           "POST" '{"question":"What are my top videos?","history":[]}' "answer"
check "AI Chat — with history"           "$BASE/ai-insights/chat"           "POST" '{"question":"Tell me more","history":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}' "answer"
check "Generate Titles — with topic"     "$BASE/ai-insights/generate-titles" "POST" '{"topic":"AI productivity tools"}' "titles"
check "Generate Titles — empty topic"    "$BASE/ai-insights/generate-titles" "POST" '{"topic":""}' "titles"

# ── Edge Cases ────────────────────────────────────────────────────────────────
section "Edge Cases"
check "Video List — large page"          "$BASE/videos/list?page=99&limit=10"   # should return empty data, not error
check "Video List — limit=1"             "$BASE/videos/list?page=1&limit=1"
check "Video List — limit=50"            "$BASE/videos/list?page=1&limit=50"
check "Overview — future date range"     "$BASE/overview?from=2030-01-01&to=2030-12-31"  # should return 0s, not error
check "Channel Timeseries — tiny range"  "$BASE/channel/timeseries?from=2026-03-11&to=2026-03-12"

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS+FAIL))
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✓ All $TOTAL checks passed${NC}"
else
  echo -e "  Results: ${GREEN}${PASS} passed${NC} / ${RED}${FAIL} failed${NC} / ${TOTAL} total"
  echo -e "\n${RED}  Failed checks:${NC}"
  for e in "${ERRORS[@]}"; do echo -e "    • $e"; done
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

[ $FAIL -eq 0 ] && exit 0 || exit 1
