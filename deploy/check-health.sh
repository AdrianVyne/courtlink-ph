#!/bin/sh
set -eu

HEALTH_URL="${COURTLINK_HEALTH_URL:-http://127.0.0.1/api/v1/health/ready}"

if curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null; then
  exit 0
fi

MESSAGE='CourtLink PH readiness check failed. Inspect Docker service health and correlated JSON logs.'
printf '%s\n' "$MESSAGE" >&2

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  curl --fail --silent --show-error --max-time 10 \
    --header 'Content-Type: application/json' \
    --data '{"text":"CourtLink PH readiness check failed. Inspect the production host."}' \
    "$ALERT_WEBHOOK_URL" >/dev/null
fi

exit 1
