# AGENTS.md — SyncSpace Hybrid Mode

## Project Mode

This repository uses a hybrid implementation model.

- Backend implementation may be delegated to AI agents.
- Frontend core implementation must remain human-authored for learning and portfolio purposes.
- AI agents may assist the frontend only as tutor, reviewer, debugger, or test assistant.

## Product Summary

SyncSpace is a React frontend portfolio project for a real-time collaborative workspace.
It combines Slack-style channel chat and Notion-style block document collaboration.
The central architectural idea is strict state separation:

- Zustand: local UI state
- TanStack Query: server state
- Yjs: realtime collaboration state

## Hard Rule: Frontend Core Protection

AI agents must not directly implement or overwrite the following frontend core files unless the user explicitly says: `프론트 핵심코드 직접 구현 허용`.

Protected paths:

- `src/app/**`
- `src/pages/**`
- `src/shared/stores/**`
- `src/features/**/queries/**`
- `src/features/realtime/**`
- `src/features/chat/components/**`
- `src/features/editor/components/**`
- `src/features/presence/components/**`
- `src/features/workspace/components/**`

Allowed frontend assistance:

- Explain concepts
- Suggest small snippets
- Review user-written code
- Add tests after user implementation
- Add comments explaining user code
- Create TODO stubs
- Generate fixtures, types, config, and mock server

## Backend AI Scope

AI agents may fully implement:

- `server/**`
- `supabase/**`
- `scripts/**`
- `.github/workflows/**`
- `railway.json`
- backend tests
- database schema and RLS policies
- backend README files

## Contract-first Requirement

Before backend implementation, produce or update:

- `docs/contracts/API_CONTRACT_FIRST.md`
- `supabase/schema.sql`
- `server/README.md`
- `.env.example`

Frontend must consume backend through typed adapters and contracts, not direct ad-hoc calls.

## Frontend Tutor Mode

When asked to help with frontend core code:

1. Explain the concept first.
2. Show the target file responsibility.
3. Provide a small skeleton or pseudocode only.
4. Ask the user to implement the missing logic.
5. Review the user's code after they paste it.
6. Do not replace the user's implementation with a full solution unless explicitly requested.

## Validation Commands

Preferred commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Backend-specific:

```bash
pnpm --filter server test
pnpm --filter server typecheck
```

Frontend-specific:

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web test:e2e
```

## Completion Criteria

A task is complete only when:

- The responsible area matches the ownership model.
- Tests or validation evidence are provided.
- `STATUS.md` is updated.
- No protected frontend core file was overwritten by AI without explicit approval.
