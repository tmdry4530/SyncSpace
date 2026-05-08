# BACKEND_SPEC.md

## Realtime Server
Location: `apps/realtime-server`

Required:
- TypeScript Node.js
- `ws`
- `yjs`
- `zod`
- `dotenv`
- Supabase admin client

## Entrypoint
`src/server.ts`:
- load env
- create HTTP server
- create WebSocket server
- route by path
- `/health` endpoint if feasible
- graceful shutdown

## Modules
- `modules/chat.ts`: validation, auth/membership, Supabase persistence, broadcast
- `modules/docSync.ts`: Yjs doc room sync
- `modules/presence.ts`: presence tracking/awareness
- `lib/supabaseAdmin.ts`: service-role client, server-only

## Env
```txt
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WEB_ORIGIN=http://localhost:5173
```

## Backend Rules
- no raw JWT logging
- no service role exposure to frontend
- invalid messages return structured error
- bad client must not crash server
- disconnect clears presence
