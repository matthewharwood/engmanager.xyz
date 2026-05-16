#!/usr/bin/env bash
#
# Cloudflare bootstrap for engmanager.xyz.
#
# Idempotent. Configures:
#   - DNS records: apex + www CNAME → Render hostname, both proxied
#   - SSL/TLS mode: Full (Strict)
#   - Always Use HTTPS: on
#   - Cache Rule: cache HTML at "/" and "/articles*", respecting origin TTL
#
# Required env:
#   CF_API_TOKEN  Cloudflare API token. Create at
#                 https://dash.cloudflare.com/profile/api-tokens with these
#                 permissions on the engmanager.xyz zone:
#                   - Zone:Zone:Read
#                   - Zone:DNS:Edit
#                   - Zone:Zone Settings:Edit
#                   - Zone:Cache Rules:Edit
#
# Optional env:
#   RENDER_HOSTNAME  Render service hostname (default: engmanager-xyz.onrender.com)
#   ZONE_NAME        Cloudflare zone name (default: engmanager.xyz)
#
# Usage:
#   CF_API_TOKEN=... ./scripts/cloudflare-bootstrap.sh
#
# Re-runs are safe — DNS records upserted by name, cache rule upserted by
# description.

set -euo pipefail

ZONE_NAME="${ZONE_NAME:-engmanager.xyz}"
RENDER_HOSTNAME="${RENDER_HOSTNAME:-engmanager-xyz.onrender.com}"
RULE_DESCRIPTION="cache HTML for engmanager.xyz"
API="https://api.cloudflare.com/client/v4"

: "${CF_API_TOKEN:?Set CF_API_TOKEN (Cloudflare API token).}"
command -v jq >/dev/null || { echo "Error: jq required (brew install jq)." >&2; exit 1; }

# Authenticated curl that exits non-zero on HTTP errors.
api() {
  curl -fsS \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" "$@"
}

# Same but does not exit on 4xx (lets us check if a resource exists).
api_quiet() {
  curl -sS \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" "$@"
}

echo "→ Looking up zone $ZONE_NAME..."
ZONE_ID=$(api "$API/zones?name=$ZONE_NAME" | jq -r '.result[0].id // empty')
[ -n "$ZONE_ID" ] || { echo "Zone $ZONE_NAME not found in this account." >&2; exit 1; }
echo "  zone id: $ZONE_ID"

upsert_cname() {
  local name=$1 target=$2 proxied=$3
  local existing
  existing=$(api "$API/zones/$ZONE_ID/dns_records?type=CNAME&name=$name" \
    | jq -r '.result[0].id // empty')
  local body
  body=$(jq -nc --arg name "$name" --arg target "$target" --argjson proxied "$proxied" \
    '{type:"CNAME", name:$name, content:$target, ttl:1, proxied:$proxied}')
  if [ -n "$existing" ]; then
    echo "→ Updating CNAME $name → $target (proxied=$proxied)"
    api -X PUT "$API/zones/$ZONE_ID/dns_records/$existing" -d "$body" >/dev/null
  else
    echo "→ Creating CNAME $name → $target (proxied=$proxied)"
    api -X POST "$API/zones/$ZONE_ID/dns_records" -d "$body" >/dev/null
  fi
}

upsert_cname "$ZONE_NAME"        "$RENDER_HOSTNAME" true
upsert_cname "www.$ZONE_NAME"    "$RENDER_HOSTNAME" true

echo "→ Setting SSL mode = Full (Strict)..."
api -X PATCH "$API/zones/$ZONE_ID/settings/ssl" -d '{"value":"strict"}' \
  | jq -r '"  ssl: \(.result.value)"'

echo "→ Setting Always Use HTTPS = on..."
api -X PATCH "$API/zones/$ZONE_ID/settings/always_use_https" -d '{"value":"on"}' \
  | jq -r '"  always_use_https: \(.result.value)"'

echo "→ Upserting HTML cache rule..."
RULE_EXPR='(http.host eq "'"$ZONE_NAME"'" and (http.request.uri.path eq "/" or starts_with(http.request.uri.path, "/articles")))'

# Fetch existing ruleset (404 if none — handled by `// []`).
existing_rules=$(api_quiet "$API/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
  | jq -c '.result.rules // []')

# Our desired rule.
our_rule=$(jq -nc --arg expr "$RULE_EXPR" --arg desc "$RULE_DESCRIPTION" '{
  expression: $expr,
  action: "set_cache_settings",
  action_parameters: {
    cache: true,
    edge_ttl: { mode: "respect_origin" },
    browser_ttl: { mode: "respect_origin" }
  },
  description: $desc,
  enabled: true
}')

# Replace any existing rule with same description, else append.
new_rules=$(echo "$existing_rules" | jq -c --arg desc "$RULE_DESCRIPTION" --argjson new "$our_rule" '
  if any(.[]; .description == $desc)
  then map(if .description == $desc then $new else . end)
  else . + [$new]
  end
')

api -X PUT "$API/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
    -d "$(jq -nc --argjson rules "$new_rules" '{rules:$rules}')" \
  | jq -r '.result.rules[] | select(.description == "'"$RULE_DESCRIPTION"'") | "  rule id: \(.id)"'

cat <<EOF

✓ Cloudflare configured.

Stash this for the purge script (Render env var or .env):
  CF_ZONE_ID=$ZONE_ID

Verify (give DNS a minute to propagate, request twice for a HIT):
  curl -sI https://$ZONE_NAME/ | grep -iE 'cf-ray|cf-cache-status|cache-control|age'
  curl -sI https://$ZONE_NAME/assets/styles.css | grep -iE 'cf-cache-status|cache-control|age'
EOF
