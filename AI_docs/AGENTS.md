# AGENTS.md — SyncSpace Full AI Implementation Contract

## Role
You are the sole implementation agent for SyncSpace MVP. Implement frontend, backend/realtime server, Supabase schema/RLS, tests, and documentation.

## Product
SyncSpace is a real-time collaboration workspace combining Slack-style channels/chat and Notion-style collaborative documents.

## Core Architecture Thesis
Strictly separate state responsibilities:

| Layer | Tool | Responsibility |
|---|---|---|
| Local UI state | Zustand | selected workspace/channel/document, sidebar, drafts, scroll position |
| Server state | TanStack Query | Supabase data: workspaces, members, channels, documents, message history |
| Realtime state | Yjs/WebSocket | editor CRDT, live chat events, presence/awareness, connection status |

## Required Stack
Frontend:
- React 18, TypeScript, Vite, React Router
- Tailwind CSS v3
- Zustand
- TanStack Query v5
- Supabase JS
- Yjs, y-websocket-compatible client, Tiptap v2
- Vitest, React Testing Library, Playwright if feasible

Backend/realtime:
- Node.js, TypeScript
- ws, yjs, zod, dotenv
- Supabase admin client with service role key server-side only

Database:
- Supabase Auth + PostgreSQL + RLS

## Target Repo Structure
```txt
apps/web/src/{app,pages,features,entities,shared}
apps/realtime-server/src/{modules,lib,routes}
packages/shared/src/{types,schemas}
supabase/migrations
docs
```

## Read First
Before editing, read:
1. `PROJECT_SPEC.md`
2. `ARCHITECTURE.md`
3. `TASKS.json`
4. `STATE_MANAGEMENT.md`
5. `API_CONTRACTS.md`
6. `REALTIME_SPEC.md`
7. `TEST_PLAN.md`

## Implementation Order
1. pnpm monorepo scaffold
2. shared types/zod contracts
3. Supabase schema + RLS
4. realtime server
5. frontend app shell/router/providers
6. Zustand stores + TanStack Query hooks
7. workspace/channel/document CRUD
8. realtime chat
9. Tiptap/Yjs editor
10. presence/connection UX
11. tests
12. README and final verification

## Forbidden
- Do not place `SUPABASE_SERVICE_ROLE_KEY` in frontend.
- Do not disable RLS to make the app work.
- Do not use Zustand for server-state cache.
- Do not put editor content in TanStack Query.
- Do not hide failing tests by weakening assertions.
- Do not add unrelated features outside MVP.
- Do not commit real `.env` files.

## Realtime Fallback Rule
Primary target: Yjs for collaborative document editing and awareness, realtime chat with persistence.
If Yjs-backed chat persistence is unstable after two serious attempts, use JSON WebSocket for chat live delivery and Supabase/TanStack Query for persisted history. Record this in `DECISIONS.md`. Do not downgrade silently.

## Required Verification
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Optional if implemented:
```bash
pnpm test:e2e
```

## Progress Protocol
After each task group:
- update `TASKS.json`
- update `STATUS.md`
- record decisions in `DECISIONS.md`
- record repeated failures in `FAILURES.md`

## Final Report
Final answer must include:
1. implemented features
2. changed file groups
3. commands run
4. passing/failing checks
5. known gaps
6. local run instructions
7. environment variables
8. portfolio talking points
