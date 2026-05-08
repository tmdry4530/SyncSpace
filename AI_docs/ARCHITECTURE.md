# ARCHITECTURE.md

## System
```txt
Browser apps/web
  ├─ React UI
  ├─ Zustand local UI state
  ├─ TanStack Query Supabase server cache
  ├─ Supabase client
  └─ Yjs/WebSocket realtime client

Supabase
  ├─ Auth
  ├─ PostgreSQL
  └─ RLS policies

apps/realtime-server
  ├─ /doc/:documentId   Yjs document sync
  ├─ /chat/:channelId   live chat events
  └─ /presence/:workspaceId optional presence
```

## Frontend Layers
- `app`: providers, router, global app setup
- `pages`: route-level screens
- `features`: auth, workspace, channel, chat, documents, editor, presence, realtime
- `entities`: domain adapters/types
- `shared`: ui, api, stores, config, helpers

## Realtime Server Modules
- `server.ts`: HTTP/WS server and routing
- `modules/docSync.ts`: Yjs document sync
- `modules/chat.ts`: chat validation, persistence, broadcast
- `modules/presence.ts`: connected users and awareness
- `lib/supabaseAdmin.ts`: server-only Supabase service role client

## Chat Flow
```txt
ChatInput submit
 -> useChatRoom.sendMessage
 -> realtime server validates payload/auth
 -> server persists message to Supabase
 -> server broadcasts saved message
 -> ChatPanel merges live message with query history
 -> on reconnect, invalidate message query
```

## Document Flow
```txt
Document route opens
 -> TanStack Query loads document metadata
 -> useYEditorRoom creates Y.Doc and provider
 -> Tiptap Collaboration binds to Y.Doc
 -> awareness sends user metadata
 -> other tabs receive CRDT updates
```

## Security Boundary
Frontend may use only:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_REALTIME_URL`

Realtime server may use:
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose service role key to frontend.
