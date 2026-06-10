#!/usr/bin/env bash
# dev-full.sh — full local stack: embedded Postgres + migrate + seed + API + worker + frontend.
#
#   embedded Postgres (:5433)  -> server/scripts/dev-db.ts (persistent)
#   migrate + seed             -> once, against the embedded cluster
#   API (REST/WS/A2A, :1234)   -> pnpm --filter server dev
#   agent-worker               -> tsx watch src/workers/index.ts
#   frontend (Vite, :5173)     -> pnpm run dev:frontend
#
# Env comes from the repo-root .env (loaded by the server config and by Vite).
# Open the app at http://localhost:5173 so session cookies are same-site with the API.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

READY_MARKER="$ROOT/.syncspace-data/.dev-db-ready"
PIDS=()

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  for pid in "${PIDS[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  # Belt-and-suspenders: make sure the embedded Postgres launcher is gone.
  pkill -f "scripts/dev-db.ts" 2>/dev/null || true
  wait 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT INT TERM

echo "[dev-full] starting embedded Postgres..."
rm -f "$READY_MARKER"
pnpm --filter server exec tsx scripts/dev-db.ts &
PIDS+=("$!")

echo "[dev-full] waiting for database to become ready..."
for _ in $(seq 1 90); do
  [[ -f "$READY_MARKER" ]] && break
  sleep 1
done
if [[ ! -f "$READY_MARKER" ]]; then
  echo "[dev-full] ERROR: database did not become ready in time" >&2
  exit 1
fi
echo "[dev-full] database ready."

echo "[dev-full] applying migrations..."
pnpm --filter server db:migrate

echo "[dev-full] seeding demo data..."
pnpm --filter server db:seed

echo "[dev-full] starting API, agent worker, and frontend..."
pnpm --filter server dev &
PIDS+=("$!")

pnpm --filter server exec tsx watch src/workers/index.ts &
PIDS+=("$!")

pnpm run dev:frontend &
PIDS+=("$!")

# Exit (and trigger cleanup) as soon as any one service exits.
wait -n
