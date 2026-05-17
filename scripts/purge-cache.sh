#!/bin/sh
#
# Purge Cloudflare cache for engmanager.xyz.
#
# Designed to run in minimal CI/build environments (e.g. Render's build
# container), so it deliberately uses only POSIX sh and `curl` — no bash,
# no jq, no external tools beyond curl.
#
# Required env:
#   CF_API_TOKEN  Cloudflare API token with Zone:Cache Purge.
#   CF_ZONE_ID    Zone id (e.g. 8e7adcbf3eee60989d041f45dc7f0e68).
#
# Optional positional args: specific URLs to purge.
# If none given, purges everything.
#
#   ./scripts/purge-cache.sh
#   ./scripts/purge-cache.sh https://engmanager.xyz/ https://engmanager.xyz/articles/

set -eu

: "${CF_API_TOKEN:?CF_API_TOKEN not set}"
: "${CF_ZONE_ID:?CF_ZONE_ID not set}"

API="https://api.cloudflare.com/client/v4"

if [ $# -eq 0 ]; then
    body='{"purge_everything":true}'
    echo "→ Purging everything in zone $CF_ZONE_ID..."
else
    # Build a JSON array of URLs manually (no jq). Each arg wrapped in quotes,
    # separated by commas.
    files=''
    sep=''
    for url in "$@"; do
        files="$files$sep\"$url\""
        sep=','
    done
    body="{\"files\":[$files]}"
    echo "→ Purging $# URL(s)..."
fi

response=$(curl -fsS -X POST \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$API/zones/$CF_ZONE_ID/purge_cache")

# Lightweight success check on the raw JSON, no jq.
case "$response" in
    *'"success":true'*)
        echo "✓ Purged."
        ;;
    *)
        echo "✗ Purge failed."
        echo "Response: $response" >&2
        exit 1
        ;;
esac
