#!/usr/bin/env bash
#
# Generate the Open Graph share cards in website/assets/og/.
#
# 1200x630 (the size LinkedIn, X, Slack and iMessage all want) rendered by
# headless Chrome from scripts/og/card.html, so the cards use the SITE's own
# display font and dark palette instead of a separate design that drifts.
#
# Cards produced:
#   og/default.jpg          the site card — every page that has no card of
#                           its own falls back to this one
#   og/coach.jpg            coach.engmanager.xyz, with the two recommenders'
#                           faces (social proof inside the share card)
#   og/article-<slug>.jpg   one per public article
#
# Article copy comes from the RUNNING SITE (the homepage's article data
# island), so the cards cannot drift from content.rs. The script boots the
# dev server itself on $OG_PORT and shuts it down on exit.
#
# Requires: Chrome/Chromium (CHROME_BIN or a standard install path), cargo,
# python3, and network access (Google Fonts, for Archivo).
#
# Usage:
#   ./scripts/generate-og.sh              # all cards
#   ./scripts/generate-og.sh coach        # just the ones matching "coach"
#
# Re-runs are deterministic: same input, same bytes. Commit the output.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/website/assets/og"
TPL="$ROOT/scripts/og"
PORT="${OG_PORT:-3177}"
FILTER="${1:-}"

find_chrome() {
  if [[ -n "${CHROME_BIN:-}" ]]; then echo "$CHROME_BIN"; return; fi
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )
  for c in "${candidates[@]}"; do [[ -x "$c" ]] && { echo "$c"; return; }; done
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    command -v "$c" >/dev/null && { command -v "$c"; return; }
  done
  echo "No Chrome/Chromium found. Set CHROME_BIN." >&2
  exit 1
}
CHROME="$(find_chrome)"

WORK="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Assets the template references must sit NEXT TO it: Chrome renders from a
# file:// URL, and cross-directory file:// reads are blocked.
cp "$TPL/card.html" "$WORK/"
cp "$ROOT/website/assets/fonts/monumentextended-black-webfont.woff2" "$WORK/"
cp "$ROOT/website/assets/coach/"*.webp "$WORK/" 2>/dev/null || true
cp "$ROOT/website/assets/auteurs/discord-qr.png" "$WORK/"
cp "$ROOT/website/js/src/auteurs-shader.js" "$WORK/"

# The author avatar lives in Cloudflare Images; pull it once for the byline.
echo "→ fetching the author avatar"
curl -fsS -o "$WORK/avatar.png" \
  "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300/w=160,fit=cover,format=auto" \
  || curl -fsS -o "$WORK/avatar.png" \
  "https://engmanager.xyz/cdn-cgi/imagedelivery/MdDtxXpLlqqwzPv4AklQiw/febf9573-0897-40b3-f687-a38a678b2300/public"

echo "→ booting the site on :$PORT for article copy"
(cd "$ROOT" && PORT="$PORT" cargo run -q -p website --features dev >"$WORK/server.log" 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 90); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 1
done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" || { echo "site never came up; see $WORK/server.log" >&2; exit 1; }

python3 "$TPL/manifest.py" "http://127.0.0.1:$PORT/" > "$WORK/cards.json"
COUNT=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$WORK/cards.json")
echo "→ $COUNT cards"

mkdir -p "$OUT"
python3 -c 'import json,sys; [print(c["name"]) for c in json.load(open(sys.argv[1]))]' "$WORK/cards.json" \
| while read -r name; do
  if [[ -n "$FILTER" && "$name" != *"$FILTER"* ]]; then continue; fi

  python3 -c '
import json, sys
cards = json.load(open(sys.argv[1]))
card = next(c for c in cards if c["name"] == sys.argv[2])
card.pop("name")
json.dump(card, open(sys.argv[3], "w"))
' "$WORK/cards.json" "$name" "$WORK/card.json"

  # SwiftShader gives headless Chrome a software WebGL2 implementation, which
  # the Auteurs card's orb needs. --disable-gpu would turn WebGL off entirely.
  #
  # Chrome is launched in the BACKGROUND and killed once the screenshot lands.
  # --virtual-time-budget never expires on a page with a requestAnimationFrame
  # loop (the orb's), so Chrome writes the png and then hangs forever. Poll for
  # the file instead of waiting on the process.
  rm -f "$WORK/$name.png"
  "$CHROME" \
    --headless \
    --use-gl=angle \
    --use-angle=swiftshader \
    --enable-unsafe-swiftshader \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size=1200,630 \
    --screenshot="$WORK/$name.png" \
    --virtual-time-budget=8000 \
    --allow-file-access-from-files \
    --user-data-dir="$WORK/chrome" \
    "file://$WORK/card.html" >/dev/null 2>&1 &
  CHROME_PID=$!

  for _ in $(seq 1 60); do
    [[ -s "$WORK/$name.png" ]] && break
    sleep 0.5
  done
  sleep 0.5
  kill "$CHROME_PID" 2>/dev/null || true
  wait "$CHROME_PID" 2>/dev/null || true

  [[ -s "$WORK/$name.png" ]] || { echo "  ✗ $name — Chrome produced nothing" >&2; exit 1; }

  # JPEG, because every scraper handles it and it is a third the size of PNG
  # for a card with photographs in it. -strip so no metadata rides along.
  magick "$WORK/$name.png" -strip -quality 88 -sampling-factor 4:2:0 "$OUT/$name.jpg"
  printf '  ✓ %-34s %s\n' "$name.jpg" "$(du -h "$OUT/$name.jpg" | cut -f1)"
done

echo "✓ cards written to website/assets/og/"
