# Backend AI Autopilot Spec

## 목적

백엔드는 AI가 구현한다. 단, 프론트엔드 학습 영역을 침범하지 않는다.

## Backend Scope

AI가 구현할 것:

1. Supabase schema
2. Supabase RLS policy
3. seed data
4. Auth helper SQL/policy
5. Node.js WebSocket server
6. Yjs document room endpoint
7. chat realtime room endpoint
8. presence awareness support
9. async message persistence
10. backend tests
11. deployment docs
12. `.env.example`

## Backend File Structure

```txt
server/
├─ src/
│  ├─ server.ts
│  ├─ config.ts
│  ├─ routes/
│  │  ├─ chatRoute.ts
│  │  └─ docRoute.ts
│  ├─ realtime/
│  │  ├─ setupYWebsocket.ts
│  │  ├─ chatRoom.ts
│  │  ├─ docRoom.ts
│  │  └─ awareness.ts
│  ├─ persistence/
│  │  ├─ messagePersistence.ts
│  │  └─ supabaseAdmin.ts
│  └─ utils/
│     └─ logger.ts
├─ tests/
├─ package.json
└─ README.md

supabase/
├─ schema.sql
├─ rls.sql
├─ seed.sql
└─ README.md
```

## Non-goals

AI backend agent must not:

- implement frontend core components
- implement Zustand stores
- implement TanStack Query hooks
- implement Yjs React hooks
- redesign frontend architecture
- change protected frontend paths

## Backend Acceptance Criteria

### Supabase

- `workspaces` table exists
- `workspace_members` table exists
- `channels` table exists
- `messages` table exists
- `documents` table exists
- RLS enabled on all core tables
- workspace members can only access workspace data they belong to
- service role key is used only on server side

### WebSocket Server

- server boots with `pnpm dev`
- `/health` returns ok
- document Yjs room can connect
- chat Yjs room can connect
- connection errors do not crash server
- CORS/origin config exists
- message persistence path exists

### Contract

- backend output matches `docs/contracts/API_CONTRACT_FIRST.md`
- `.env.example` is complete
- backend README explains local run

## Verification Commands

```bash
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
```
