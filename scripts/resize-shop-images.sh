#!/usr/bin/env bash
# Derive responsive delivery images; keep the lossless originals for detail.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v magick >/dev/null || { echo "ImageMagick is required" >&2; exit 1; }
while IFS= read -r slug; do
  for view in front angle detail worn model; do
    source="$ROOT/website/assets/shop/caps/${slug}-${view}.webp"
    for width in 160 384 640; do
      magick "$source" -resize "${width}x" -quality 86 \
        -define webp:method=6 -define webp:alpha-quality=100 \
        "${source%.webp}-${width}.webp"
    done
  done
done < <(sed -nE 's/^ *slug: "([^"]+)".*/\1/p' "$ROOT/website/src/catalog.rs")
