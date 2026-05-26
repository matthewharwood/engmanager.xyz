#!/usr/bin/env bash
#
# Idempotently attaches shop.engmanager.xyz to the existing Render service.
#
# Required env:
#   RENDER_API_KEY     Render API key.
#   RENDER_SERVICE_ID  Render web service id, e.g. srv_...
#
# Optional env:
#   SHOP_DOMAIN        Custom domain to attach (default: shop.engmanager.xyz)
#
# Usage:
#   RENDER_API_KEY=... RENDER_SERVICE_ID=srv_... ./scripts/render-shop-domain.sh

set -euo pipefail

API="https://api.render.com/v1"
SHOP_DOMAIN="${SHOP_DOMAIN:-shop.engmanager.xyz}"

: "${RENDER_API_KEY:?Set RENDER_API_KEY.}"
: "${RENDER_SERVICE_ID:?Set RENDER_SERVICE_ID.}"
command -v jq >/dev/null || { echo "Error: jq required (brew install jq)." >&2; exit 1; }

api() {
  curl -fsS \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" "$@"
}

encoded_domain=$(jq -nr --arg domain "$SHOP_DOMAIN" '$domain|@uri')

echo "-> Checking Render custom domain $SHOP_DOMAIN..."
existing=$(
  api "$API/services/$RENDER_SERVICE_ID/custom-domains?limit=100&name=$encoded_domain" \
    | jq -r --arg domain "$SHOP_DOMAIN" '
        .[]?
        | select(.customDomain.name == $domain)
        | "\(.customDomain.id) \(.customDomain.verificationStatus)"
      ' \
    | head -n 1
)

if [ -n "$existing" ]; then
  read -r domain_id verification_status <<<"$existing"
  cat <<EOF
✓ Render custom domain already exists.
  id: $domain_id
  verification: $verification_status
EOF
  exit 0
fi

echo "-> Creating Render custom domain $SHOP_DOMAIN..."
api -X POST "$API/services/$RENDER_SERVICE_ID/custom-domains" \
  -d "$(jq -nc --arg name "$SHOP_DOMAIN" '{name:$name}')" \
  | jq -r '
      if type == "array" then .[0] else . end
      | "✓ Created Render custom domain.\n  id: \(.id)\n  name: \(.name)\n  verification: \(.verificationStatus)"
    '

cat <<EOF

Next:
  1. Run ./scripts/cloudflare-bootstrap.sh with CF_API_TOKEN.
  2. Wait a minute for DNS.
  3. In Render, verify $SHOP_DOMAIN if it is still unverified.
EOF
