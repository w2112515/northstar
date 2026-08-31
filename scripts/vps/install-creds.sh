#!/usr/bin/env bash
# One-time secret migration on the VPS: move real values OUT of
# /opt/northstar/.env into /etc/northstar/creds/* (root-only files that
# systemd LoadCredential hands to the API process).
#
# Idempotent: reruns refresh cred files from whatever .env still holds, and
# every known credential file is created (empty if absent) so LoadCredential
# never fails a unit start. After verifying the service reads credentials
# (healthz llm_key_len > 0 etc.), run with --scrub to comment the secret
# lines out of .env.
set -euo pipefail

ENV_FILE=/opt/northstar/.env
CRED_DIR=/etc/northstar/creds
KEYS="ALPACA_API_KEY_COMPETITION ALPACA_SECRET_KEY_COMPETITION ALPACA_API_KEY ALPACA_SECRET_KEY GOOGLE_API_KEY NORTHSTAR_ADMIN_TOKEN"

mkdir -p "$CRED_DIR"
chmod 700 /etc/northstar "$CRED_DIR"

for key in $KEYS; do
  file="$CRED_DIR/$(echo "$key" | tr '[:upper:]' '[:lower:]')"
  val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r' || true)
  if [ -z "$val" ] && [ -s "$file" ]; then
    echo "kept $file (already populated; .env has no $key)"
    chmod 600 "$file"
    continue
  fi
  printf '%s' "$val" > "$file"
  chmod 600 "$file"
  if [ -n "$val" ]; then
    echo "installed $key -> $file (${#val} chars)"
  else
    echo "created empty $file (no $key in .env)"
  fi
done

if [ "${1:-}" = "--scrub" ]; then
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"
  for key in $KEYS; do
    sed -i "s|^${key}=.*|# ${key}= (moved to $CRED_DIR, $(date -I))|" "$ENV_FILE"
  done
  echo "scrubbed secret values from $ENV_FILE (backup kept beside it)"
else
  echo "dry keep: .env untouched - rerun with --scrub after verifying the service."
fi
