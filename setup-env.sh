#!/usr/bin/env bash
# setup-env.sh — Create .env.local from .env.example
# Run this once before starting dev server:  bash setup-env.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env.local ]; then
  echo "[setup-env] .env.local already exists — skipping."
else
  cp .env.example .env.local
  echo "[setup-env] Created .env.local from .env.example"
  echo "[setup-env] Edit .env.local and fill in your FingerprintJS API keys."
  echo "[setup-env] Get keys at: https://dashboard.fingerprint.com"
fi
