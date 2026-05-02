#!/usr/bin/env bash
set -euo pipefail
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
