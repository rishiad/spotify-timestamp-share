#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/assets"
LOGO="$ASSETS_DIR/logo.svg"
ICONS_DIR="$ASSETS_DIR/icons"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["ROOT_DIR"]) / "manifest.json"
data = json.loads(path.read_text())
print(data.get("version", "0.0.0"))
PY
)"
OUT="$DIST_DIR/spotify-share-timestamp-$VERSION.zip"

ensure_icons() {
  if [ ! -f "$LOGO" ]; then
    echo "Missing $LOGO" >&2
    exit 1
  fi

  local sizes=(16 32 48 128)
  local missing=()

  for size in "${sizes[@]}"; do
    if [ ! -f "$ICONS_DIR/icon-$size.png" ]; then
      missing+=("$size")
    fi
  done

  if command -v rsvg-convert >/dev/null 2>&1; then
    mkdir -p "$ICONS_DIR"
    for size in "${sizes[@]}"; do
      rsvg-convert -w "$size" -h "$size" "$LOGO" -o "$ICONS_DIR/icon-$size.png"
    done
  elif [ ${#missing[@]} -gt 0 ]; then
    echo "rsvg-convert not found and icons missing: ${missing[*]}" >&2
    exit 1
  fi
}

ensure_icons

if ! command -v zip >/dev/null 2>&1; then
  echo "zip not found in PATH" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"
(
  cd "$ROOT_DIR"
  zip -r "$OUT" manifest.json content.js assets/icons -x "*.DS_Store"
)

echo "Built $OUT"
