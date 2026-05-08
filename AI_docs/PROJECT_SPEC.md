# PROJECT_SPEC.md — SyncSpace Full MVP

## Service Definition
SyncSpace is a collaboration tool where real-time chat and block-based collaborative documents coexist in one workspace.

## Main Portfolio Claim
"I built a real-time collaboration app where local UI state, server state, and realtime sync state are separated by responsibility using Zustand, TanStack Query, and Yjs/WebSocket."

## MVP Features

### Auth
- email/password signup
- login/logout
- persisted Supabase session
- protected routes

### Workspace
- create workspace
- list my workspaces
- enter workspace
- owner/member role model
- invite code field and placeholder invite route

### Channel + Chat
- create/list/select channels
- send messages
- realtime message delivery
- persisted message history
- infinite or paginated previous messages
- scroll position preservation per channel
- loading/empty/error/disconnected states

### Documents
- create/list/select documents
- edit document title metadata
- Tiptap editor
- Yjs collaborative editing across two tabs
- basic blocks: paragraph, H1/H2/H3, code block, horizontal rule

### Presence
- show online users
- show editor awareness/cursors if feasible
- show connection status

## Out of Scope
- mobile app
- push notification
- message search
- file attachments except optional images
- document version history
- mentions
- emoji reactions
- billing/admin features

## Definition of Done
- user can register/login
- user can create/open workspace
- user can create/open channel
- user can send persisted chat messages
- user can create/open document
- Tiptap editor works
- document sync works across two browser tabs
- presence visible at least in editor/workspace
- Supabase RLS exists
- realtime server runs separately
- README explains architecture and run commands
- build succeeds
