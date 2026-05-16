#!/usr/bin/env bash
#
# Purge Cloudflare cache for engmanager.xyz.
#
# Typical use: call from a Render post-deploy hook so freshly-deployed HTML
# isn't masked by stale edge-cached copies.
#
# Required env:
#   CF_API_TOKEN  Cloudflare API token with "Zone Cache Purge" permission.
#                 Best practice: a separate, narrower token than the
#                 bootstrap one. Create at:
#                   https://dash.cloudflare.com/profile/api-tokens
#
#   CF_ZONE_ID    Zone id (output by cloudflare-bootstrap.sh).
#         OR
#   CF_ZONE_NAME  Zone name (e.g. engmanager.xyz). The script will resolve
#                 the id at runtime. Requires Zone:Zone:Read on the token.
#
# Usage:
#   Purge everything (default on deploy):
#     ./scripts/purge-cache.sh
#
#   Purge specific URLs:
#     ./scripts/purge-cache.sh https://engmanager.xyz/ https://engmanager.xyz/articles/

set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN.}"
command -v jq >/dev/null || { echo "Error: jq required." >&2; exit 1; }

API="https://api.cloudflare.com/client/v4"

if [ -z "${CF_ZONE_ID:-}" ]; then
  : "${CF_ZONE_NAME:?Set either CF_ZONE_ID or CF_ZONE_NAME.}"
  echo "→ Resolving zone id for $CF_ZONE_NAME..."
  CF_ZONE_ID=$(curl -fsS \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    "$API/zones?name=$CF_ZONE_NAME" \
    | jq -r '.result[0].id // empty')
  [ -n "$CF_ZONE_ID" ] || { echo "Zone $CF_ZONE_NAME not found." >&2; exit 1; }
fi

if [ $# -eq 0 ]; then
  body='{"purge_everything":true}'
  echo "→ Purging everything in zone $CF_ZONE_ID..."
else
  body=$(printf '%s\n' "$@" | jq -R . | jq -sc '{files: .}')
  echo "→ Purging $# URL(s)..."
fi

curl -fsS -X POST \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$body" \
  "$API/zones/$CF_ZONE_ID/purge_cache" \
  | jq -r 'if .success then "✓ Purged." else "✗ Failed: \(.errors)" end'
