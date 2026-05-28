#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT/tmp/imagegen/shop-cap-sources"
PROMPT_FILE="$ROOT/prompts/regenerate-shop-caps.md"
ASSET_DIR="$ROOT/website/assets/shop/caps"
KEY_COLOR="#ff00ff"

generated_slugs=(
  lgtm-plus-two
  time-check
  velocity
  up-and-to-the-right
)

catalog_slugs=(
  engmanager-xyz
  scrum-of-scrums
  scrum-master
  velocity
  blocker-patrol
  sprint-review
  time-check
  standup-club
  lgtm-plus-two
  stakeholder
  backlog-zero
  release-train
  up-and-to-the-right
  merge-friday
  incident-commander
  roadmap-ghost
  consensus-builder
  scope-creep
)

views=(front angle detail worn)

usage() {
  cat <<'USAGE'
Usage:
  scripts/regenerate-shop-caps.sh --prompt
  scripts/regenerate-shop-caps.sh [--sources DIR]

Workflow:
  1. Run --prompt and generate each listed PNG with imagegen.
  2. Save generated PNGs as {slug}-{view}.png in the source dir.
  3. Run this script to chroma-key, normalize to 900x1100 WebP, and refresh model views.
USAGE
}

resize_for_view() {
  case "$1" in
    front) echo "780x820" ;;
    angle) echo "820x820" ;;
    detail) echo "900x900" ;;
    worn) echo "780x920" ;;
    *) echo "780x820" ;;
  esac
}

require_magick() {
  if ! command -v magick >/dev/null 2>&1; then
    echo "ImageMagick 'magick' is required." >&2
    exit 1
  fi
}

process_source() {
  local slug="$1"
  local view="$2"
  local name="${slug}-${view}"
  local src="$SOURCE_DIR/${name}.png"
  local work="$ROOT/tmp/imagegen/processed"
  local mask="$work/${name}-mask.png"
  local keyed="$work/${name}-keyed.png"
  local png="$work/${name}.png"
  local resize

  resize="$(resize_for_view "$view")"

  if [[ ! -f "$src" ]]; then
    echo "Missing generated source: $src" >&2
    echo "Run: scripts/regenerate-shop-caps.sh --prompt" >&2
    exit 1
  fi

  mkdir -p "$work"

  magick "$src" \
    -alpha set \
    -fuzz 18% \
    -transparent "$KEY_COLOR" \
    -alpha extract \
    -threshold 1% \
    -define connected-components:area-threshold=50000 \
    -connected-components 8 \
    -auto-level \
    "$mask"

  magick "$src" -alpha set "$mask" -compose CopyAlpha -composite "$keyed"

  magick "$keyed" \
    -trim +repage \
    -resize "$resize" \
    -gravity center \
    -background none \
    -extent 900x1100 \
    -alpha set \
    -fuzz 22% \
    -transparent "$KEY_COLOR" \
    "$png"

  # The generated time-check detail source can include opaque non-product
  # geometry below the brim. Clear those areas after normalization.
  if [[ "$name" == "time-check-detail" ]]; then
    local clear_mask="$work/${name}-clear-mask.png"
    local clear_alpha="$work/${name}-clear-alpha.png"
    local cleared="$work/${name}-cleared.png"

    magick -size 900x1100 xc:white \
      -fill black \
      -draw 'rectangle 0,830 735,1100 polygon 720,700 900,700 900,1100 735,1100 polygon 0,0 170,0 0,650' \
      "$clear_mask"
    magick "$clear_mask" -alpha copy -channel RGB -evaluate set 100% +channel "$clear_alpha"
    magick "$png" -alpha set "$clear_alpha" -compose DstIn -composite "$cleared"
    mv "$cleared" "$png"
  fi

  magick "$png" -define webp:lossless=true "$ASSET_DIR/${name}.webp"
}

generate_model_views() {
  local slug src out

  for slug in "${catalog_slugs[@]}"; do
    src="$ASSET_DIR/${slug}-worn.webp"
    out="$ASSET_DIR/${slug}-model.webp"

    if [[ ! -f "$src" ]]; then
      echo "Missing worn source for model view: $src" >&2
      exit 1
    fi

    magick "$src" \
      -trim +repage \
      -resize 820x960 \
      -gravity center \
      -background none \
      -extent 900x1100 \
      -define webp:lossless=true \
      "$out"
  done
}

verify_assets() {
  local slug view path geometry
  local channels
  local all_views=(front angle detail worn model)

  for slug in "${catalog_slugs[@]}"; do
    for view in "${all_views[@]}"; do
      path="$ASSET_DIR/${slug}-${view}.webp"
      if [[ ! -f "$path" ]]; then
        echo "Missing asset: $path" >&2
        exit 1
      fi

      geometry="$(identify -format '%wx%h' "$path")"
      if [[ "$geometry" != "900x1100" ]]; then
        echo "Unexpected geometry for $path: $geometry" >&2
        exit 1
      fi

      channels="$(identify -format '%[channels]' "$path")"
      if [[ "$channels" != *a* ]]; then
        echo "Missing alpha channel for $path: $channels" >&2
        exit 1
      fi
    done
  done
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prompt)
        cat "$PROMPT_FILE"
        exit 0
        ;;
      --sources)
        SOURCE_DIR="$(cd "$2" && pwd)"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  require_magick

  local slug view
  for slug in "${generated_slugs[@]}"; do
    for view in "${views[@]}"; do
      process_source "$slug" "$view"
    done
  done

  generate_model_views
  verify_assets
  echo "Regenerated shop cap assets in $ASSET_DIR"
}

main "$@"
