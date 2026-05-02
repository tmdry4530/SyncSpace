# SyncSpace Backend Server

Backend-only real-time infrastructure for SyncSpace. This server owns WebSocket/Yjs transport, awareness relay, optional Supabase-backed WebSocket authorization, and chat message persistence. It does **not** implement frontend UI, Zustand stores, Query hooks, or React Yjs hooks.

## Architecture

```txt
HTTP server
├─ GET /health            health + active Yjs room stats
├─ GET /ready             lightweight readiness check
├─ POST /api/workspaces/join  invite-code workspace join using server-only service role
└─ WebSocket upgrades
   ├─ /doc/:workspaceId/:documentId   -> Yjs room doc:{workspaceId}:{documentId}
   └─ /chat/:workspaceId/:channelId   -> Yjs room chat:{workspaceId}:{channelId}
```

The implementation also accepts the native `y-websocket` provider form where the provider appends the room name to the server URL, for example `/doc/:workspaceId/:documentId/doc%3A...`.

## Modules

- `src/config.ts` — environment parsing, origin allowlist, auth mode.
- `src/http/app.ts` — testable HTTP server factory and lifecycle.
- `src/realtime/setupYWebsocket.ts` — WebSocket upgrade routing and `@y/websocket-server` connection setup.
- `src/realtime/roomNames.ts` — contract-compatible deterministic room naming.
- `src/realtime/awareness.ts` — Presence/Awareness payload validation helpers. Awareness transport is relayed by y-websocket.
- `src/realtime/chatRoom.ts` — observes the Yjs `messages` array for chat rooms and sends new items to the persistence adapter.
- `src/realtime/docPersistence.ts` — persists Yjs document snapshots to a server-side directory so document rooms survive reloads/restarts.
- `src/persistence/messagePersistence.ts` — Supabase service-role adapter plus local no-op adapter for tests/dev.
- `src/persistence/workspaceJoiner.ts` — Supabase service-role invite-code join adapter for `POST /api/workspaces/join`.
- `src/auth/realtimeAuth.ts` — optional Supabase JWT + workspace membership check for WebSocket upgrades.


## Dependency note

`@y/websocket-server` is pinned to `0.1.1` because SyncSpace targets the stable `y-websocket` provider with `yjs` v13. Newer `@y/websocket-server` releases may resolve the experimental `@y/y`/Yjs v14 stack and are not contract-compatible with the stable frontend provider without a coordinated migration.

## Environment

Copy the root example file and fill server-only values. The server loads `.env` from the current working directory or the repository root without overriding already exported environment variables:

```bash
cp .env.example .env
```

Required in production:

```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend.example
WS_AUTH_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SYNCSPACE_DOC_PERSISTENCE_DIR=.syncspace-data/ydocs
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only. Never put it in `VITE_*` variables or frontend bundles.

## Local development

```bash
pnpm install
pnpm --filter server dev
curl http://localhost:1234/health
```

For local smoke tests without Supabase credentials, keep `WS_AUTH_MODE=off`. The server will use an in-memory `NoopMessagePersistenceAdapter` and log a warning.

If `WS_AUTH_MODE=supabase`, set frontend `VITE_WS_AUTH_MODE=supabase` too so browser clients send the user access token during WebSocket upgrades.

## Client contract notes

Room names match `docs/contracts/API_CONTRACT_FIRST.md`:

```ts
const docRoom = `doc:${workspaceId}:${documentId}`
const chatRoom = `chat:${workspaceId}:${channelId}`
```

WebSocket paths match the contract:

```ts
const docWsUrl = `${WS_BASE_URL}/doc/${workspaceId}/${documentId}`
const chatWsUrl = `${WS_BASE_URL}/chat/${workspaceId}/${channelId}`
```

When using `y-websocket`, pass the deterministic room name as the provider room. To use Supabase auth mode from a browser client, pass the user access token through the `Sec-WebSocket-Protocol` values `bearer, <token>`; do not put the service role key or long-lived secrets in frontend code.

Invite-code join uses a backend HTTP endpoint because it requires service-role access:

```http
POST /api/workspaces/join
Authorization: Bearer <supabase access token>
Content-Type: application/json

{ "inviteCode": "ABC123" }
```

Chat room persistence watches a Yjs array named `messages`. Each item should match the contract fields `{ id?, channelId?, userId, content, clientId?, createdAt? }`. The backend fills missing `channelId` from the room and inserts into `public.messages` with a `(channel_id, client_id)` idempotency key when `clientId` is present.

## Verification

```bash
pnpm --filter server lint
pnpm --filter server typecheck
pnpm --filter server test
```

or:

```bash
pnpm verify:backend
```

## Deployment notes

- Deploy the server as a Node.js service (Railway, Fly.io, Render, or similar) with WebSocket upgrade support.
- Set `HOST=0.0.0.0` and `PORT` from the platform if provided.
- Set `WS_AUTH_MODE=supabase` outside local development.
- Configure a single public `VITE_WS_URL` on the frontend pointing to this server, for example `wss://syncspace-backend.example.com`.
- Keep Supabase SQL migrations (`supabase/schema.sql`, `supabase/rls.sql`, `supabase/seed.sql`) applied before enabling persistence.
