#!/usr/bin/env bash
# Updates a running Grimoire deployment: pulls the latest `main`, installs any
# changed dependencies, rebuilds if needed, and restarts the stack. Meant for
# the Proxmox LXC deployment (see docs/setup/proxmox-deployment.md) — not the
# Windows dev stack, which has its own restart flow documented in CLAUDE.md.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker/docker-compose.yml"

echo "==> Fetching latest changes on main..."
git fetch origin main
git checkout main
git merge --ff-only origin/main

echo "==> Installing updated dependencies..."
$COMPOSE run --rm -w /app server npm install --workspace server
$COMPOSE run --rm -w /app web npm install --workspace web

echo "==> Rebuilding images and restarting the stack..."
$COMPOSE up -d --build --force-recreate

echo "==> Update complete. Current status:"
$COMPOSE ps
