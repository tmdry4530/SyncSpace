# SyncSpace

Real-time collaboration workspace built with React, TypeScript, Supabase, WebSocket, Yjs, and Tiptap.

## Core Idea
Slack-style channel chat + Notion-style collaborative document editing in one workspace.

## Architecture Highlight
| State Type | Tool | Example |
|---|---|---|
| Local UI State | Zustand | selected channel, sidebar, scroll position |
| Server State | TanStack Query | workspace list, channel list, message history |
| Realtime State | Yjs/WebSocket | editor content, live chat, presence |

## Tech Stack
- React 18, TypeScript, Vite, Tailwind CSS
- Zustand, TanStack Query
- Supabase Auth/Postgres/RLS
- Node.js + ws
- Yjs, Tiptap
- Vitest, Playwright

## Verification
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
