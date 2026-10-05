#!/usr/bin/env bash
# Runs Lighthouse against a running `vite preview` (port 4173) and saves the reports under docs/lighthouse.
# Usage: bash scripts/lighthouse-all.sh   (needs Chrome; set CHROME_PATH if it is not found)
set -e
export CHROME_PATH="${CHROME_PATH:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
base="${1:-http://localhost:4173}"
mkdir -p docs/lighthouse
run() { # name url preset
  npx --yes lighthouse@12 "$2" --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="docs/lighthouse/$1.json" --quiet "${@:3}" >/dev/null 2>&1 || true
}
run story-desktop "$base/" --preset=desktop
run story-lite-desktop "$base/?3d=0" --preset=desktop
run story-mobile "$base/"
run story-lite-mobile "$base/?3d=0"
run lab-desktop "$base/#lab/data" --preset=desktop
