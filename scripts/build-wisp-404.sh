#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$ROOT/website/wasm/not-found-wisp"
DIST_DIR="$CRATE_DIR/dist"
ASSET_DIR="$ROOT/website/assets/wisp-404"

rm -rf "$DIST_DIR"
(
  cd "$CRATE_DIR"
  env -u NO_COLOR trunk build --release \
    --dist "$DIST_DIR" \
    --public-url /assets/wisp-404/
)

mkdir -p "$ASSET_DIR"
cp "$DIST_DIR"/*.js "$ASSET_DIR/not-found-wisp.js"
cp "$DIST_DIR"/*_bg.wasm "$ASSET_DIR/not-found-wisp_bg.wasm"

printf 'Wisp3D 404 assets written to %s\n' "$ASSET_DIR"
