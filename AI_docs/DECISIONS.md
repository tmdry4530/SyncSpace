# DECISIONS.md

## ADR-001: pnpm monorepo
Status: accepted

Use `apps/web`, `apps/realtime-server`, and `packages/shared` to keep frontend, realtime server, and contracts separated.

## ADR-002: Vite React
Status: accepted

Use Vite React instead of Next.js because the PRD targets React 18 + TypeScript with Vite.

## ADR-003: State separation
Status: accepted

Zustand owns local UI state. TanStack Query owns Supabase server state. Yjs/WebSocket owns realtime collaboration state.

## ADR-004: Supabase direct CRUD
Status: accepted

Frontend uses Supabase client directly for CRUD under RLS. Separate backend is only for realtime behavior.

## ADR-005: Realtime fallback
Status: proposed

If Yjs-backed chat persistence is unstable, use JSON WebSocket for chat and Supabase/TanStack Query for history. Must be documented before use.
