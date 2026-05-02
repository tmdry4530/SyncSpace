# Codex Backend Autopilot Prompt

아래 프롬프트를 Codex/OMX에 그대로 넣는다.

```text
/prompts:executor
You are implementing the backend only for SyncSpace.

Read first:
- AGENTS.md
- docs/project/OWNERSHIP_MODEL.md
- docs/contracts/API_CONTRACT_FIRST.md
- docs/backend/BACKEND_AI_AUTOPILOT_SPEC.md

Critical rule:
Do not implement, overwrite, or refactor protected frontend core files.
Frontend core is human-authored for learning.
You may create backend files, Supabase SQL, config, tests, docs, and frontend-facing type stubs only if they do not implement business UI logic.

Goal:
Implement the backend infrastructure for SyncSpace:
1. Supabase schema
2. RLS policies
3. seed data
4. Node.js WebSocket server
5. y-websocket document room
6. chat room
7. presence/awareness support
8. message persistence adapter
9. backend tests
10. env and deployment docs

Constraints:
- Keep backend implementation contract-compatible with docs/contracts/API_CONTRACT_FIRST.md.
- Service role key must be server-only.
- Never expose secrets to frontend.
- Keep server modules small and independently testable.
- Do not touch protected frontend paths.

Allowed paths:
- server/**
- supabase/**
- scripts/**
- .github/workflows/**
- package.json / pnpm-workspace.yaml only if necessary
- .env.example
- backend README files

Required output:
1. changed files
2. backend architecture summary
3. Supabase tables and RLS summary
4. WebSocket endpoints
5. verification commands run
6. risks or manual steps

Verification:
Run relevant lint/typecheck/test commands.
If a command cannot run, explain the exact missing dependency or environment variable.
```
