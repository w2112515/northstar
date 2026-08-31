#!/usr/bin/env bash
# NorthStar liveness monitor - fired by northstar-monitor.timer every 5 min.
#
# Checks that both judged instances are not just up but *driving*: a healthy
# autopilot writes journal events every pass (<=15 min apart), so we alert on
# "process answers but the scheduler froze" as well as plain downtime.
# Alerts go to Telegram (same env vars as the API) with a 1h per-key cooldown;
# without Telegram config they still land in data/monitor/alerts.log.
set -u

ENV_FILE=/opt/northstar/.env
STATE_DIR=/opt/northstar/data/monitor
mkdir -p "$STATE_DIR"
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

MAX_AGE=${MONITOR_MAX_PASS_AGE:-1800}
COOLDOWN=3600

alert() { # $1 = dedup key, $2 = message
  local key="$1" msg="$2" now last stamp
  stamp="$STATE_DIR/alert-$key.ts"
  now=$(date +%s)
  last=$(cat "$stamp" 2>/dev/null || echo 0)
  [ $((now - last)) -lt "$COOLDOWN" ] && return 0
  echo "$now" > "$stamp"
  echo "$(date -Is) ALERT [$key] $msg" >> "$STATE_DIR/alerts.log"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=NorthStar monitor: $msg" >/dev/null || true
  fi
}

check_health() { # $1 = key, $2 = healthz url, $3 = journal url (fallback for older builds)
  local key="$1" url="$2" jurl="$3" body ok age ts
  body=$(curl -s -m 15 "$url" || true)
  ok=$(printf '%s' "$body" | jq -r '.ok // empty' 2>/dev/null)
  if [ "$ok" = "true" ]; then
    age=$(printf '%s' "$body" | jq -r '.last_pass_age_seconds // empty' 2>/dev/null)
  else
    # Build without the /api/healthz alias yet: age from the newest journal event.
    ts=$(curl -s -m 15 "$jurl" | jq -r '.events[0].ts // empty' 2>/dev/null)
    if [ -z "$ts" ]; then
      alert "$key-down" "$key unreachable ($url)"
      return
    fi
    age=$(( $(date +%s) - $(date -d "$ts" +%s 2>/dev/null || echo 0) ))
  fi
  if [ -n "$age" ] && [ "$age" -gt "$MAX_AGE" ] 2>/dev/null; then
    alert "$key-stale" "$key: last journal event ${age}s ago (limit ${MAX_AGE}s)"
  fi
}

check_web() { # $1 = key, $2 = url
  local code
  code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$2" || echo 000)
  [ "$code" = "200" ] || alert "$1-down" "$1 returned HTTP $code ($2)"
}

check_health "vps-api" "http://127.0.0.1:8800/healthz" "http://127.0.0.1:8800/api/journal?limit=1"
check_web "vps-web" "http://127.0.0.1:3000/"
check_health "cloud-api" \
  "https://northstar-web-251608445238.us-central1.run.app/api/healthz" \
  "https://northstar-web-251608445238.us-central1.run.app/api/journal?limit=1"
exit 0
