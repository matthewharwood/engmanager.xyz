#!/usr/bin/env bash
# Capture golden snapshots (body + headers) of every public route from a
# locally running server, for before/after refactor diffing.
# Usage: scripts/golden-snapshot.sh <outdir> [port]
set -euo pipefail

OUT="${1:?usage: golden-snapshot.sh <outdir> [port]}"
PORT="${2:-3199}"
BASE="http://127.0.0.1:${PORT}"
mkdir -p "$OUT"

snap() { # name, path, [extra curl args...]
    local name="$1" path="$2"; shift 2
    curl -s -D "$OUT/$name.headers" -o "$OUT/$name.body" "$@" "$BASE$path"
    # Normalize volatile headers (date, cf noise) for stable diffs.
    sed -i '' -E '/^(date|Date):/d' "$OUT/$name.headers"
}

snap homepage            /
snap articles-index      /articles/
snap search              /search
snap search-query        '/search?q=rust'
snap typeahead           '/api/search/typeahead?q=ca'
snap checkout-nonshop    /checkout
snap sitemap             /sitemap.xml
snap sitemaps-alias      /sitemaps.xml
snap robots              /robots.txt
snap health              /health
snap offline             /offline.html
snap sw                  /sw.js
snap favicon             /favicon.ico
snap not-found           /this-page-does-not-exist
snap shop-root           / -H "Host: shop.localhost:${PORT}"
snap shop-products-fallback /products/anything -H "Host: shop.localhost:${PORT}"
snap checkout-shop       /checkout -H "Host: shop.localhost:${PORT}"

# Every article detail page, slugs scraped from the sitemap.
for slug in $(grep -o '/articles/[a-z0-9-]*' "$OUT/sitemap.body" | sed 's|/articles/||' | sort -u); do
    [ -n "$slug" ] && snap "article-$slug" "/articles/$slug"
done

# Hashed-asset round-trip: first stylesheet referenced by the homepage.
ASSET=$(grep -o '/assets/[^"]*\.css' "$OUT/homepage.body" | head -1)
[ -n "$ASSET" ] && snap asset-critical-css "$ASSET"

echo "snapshots: $(ls "$OUT" | grep -c '\.body$') routes -> $OUT"
