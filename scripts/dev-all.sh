#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PID=""
BACKEND_PID=""

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if [[ -n "${FRONTEND_PID}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi

  wait "${FRONTEND_PID}" 2>/dev/null || true
  wait "${BACKEND_PID}" 2>/dev/null || true
  exit "${status}"
}

trap cleanup EXIT INT TERM

pnpm run dev:frontend &
FRONTEND_PID=$!

pnpm run dev:backend &
BACKEND_PID=$!

wait -n "${FRONTEND_PID}" "${BACKEND_PID}"
