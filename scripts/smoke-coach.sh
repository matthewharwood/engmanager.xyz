#!/usr/bin/env bash
#
# Post-deploy smoke test for coach.engmanager.xyz (read-only).
#
# Checks, against the live internet:
#   1. engmanager.xyz/coaching 308s to the subdomain (proves the deploy is live
#      even before DNS for the subdomain exists).
#   2. coach.engmanager.xyz resolves, serves TLS, and returns the booking page.
#   3. The embedded Google Calendar booking page (if configured) answers 200.
#   4. The Icebreakers template's /copy link is reachable.
#
# Usage:
#   ./scripts/smoke-coach.sh                 # production
#   ORIGIN=http://coach.localhost:3000 APEX=http://127.0.0.1:3000 ./scripts/smoke-coach.sh

set -euo pipefail

APEX="${APEX:-https://engmanager.xyz}"
ORIGIN="${ORIGIN:-https://coach.engmanager.xyz}"
fail=0
pass() { printf '  ✓ %s\n' "$1"; }
flunk() { printf '  ✗ %s\n' "$1" >&2; fail=1; }

echo "→ $APEX/coaching redirect"
location=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "$APEX/coaching" || true)
[ "$location" = "308 https://coach.engmanager.xyz/" ] && pass "308 → coach" || flunk "expected 308 to coach, got: $location"

echo "→ $ORIGIN/"
html=$(curl -fsS "$ORIGIN/" 2>/dev/null || true)
if [ -z "$html" ]; then
  flunk "no response from $ORIGIN/ (DNS / Render custom domain not live yet?)"
else
  for needle in 'window.__coach=' '$100' '35 min' 'Fridays · 10am–2pm PT' '/copy'; do
    grep -qF -- "$needle" <<<"$html" && pass "page contains $needle" || flunk "page missing $needle"
  done
  booking=$(grep -oE 'https://calendar\.(google\.com/calendar/appointments/schedules|app\.google)/[A-Za-z0-9_-]+' <<<"$html" | head -n1 || true)
  if [ -n "$booking" ]; then
    code=$(curl -sS -L -o /dev/null -w '%{http_code}' "$booking" || true)
    [ "$code" = "200" ] && pass "booking page $booking → 200" || flunk "booking page $booking → $code"
  else
    flunk "no Google Calendar booking URL on the page (COACH_BOOKING_URL / DEFAULT_BOOKING_URL unset)"
  fi
  copy=$(grep -oE 'https://docs\.google\.com/document/d/[A-Za-z0-9_-]+/copy' <<<"$html" | head -n1 || true)
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$copy" || true)
  case "$code" in 200|302) pass "Icebreakers /copy → $code" ;; *) flunk "Icebreakers /copy → $code" ;; esac
fi

[ "$fail" -eq 0 ] && echo "✓ coach smoke passed" || { echo "✗ coach smoke failed" >&2; exit 1; }
