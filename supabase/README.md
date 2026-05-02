# SyncSpace Supabase Backend

This directory contains the backend-owned database contract for SyncSpace.

## Files

- `schema.sql` — core tables, indexes, triggers, helper functions, and Supabase Realtime publication registration.
- `rls.sql` — row-level security policies for authenticated users.
- `seed.sql` — local development users, workspace, channels, document metadata, and messages.

## Apply order

For a local Supabase CLI project, apply in this order:

```bash
supabase db reset
# or manually:
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/rls.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Core tables

| Table | Purpose |
| --- | --- |
| `profiles` | Contract `UserProfile`; one row per `auth.users` account. |
| `workspaces` | Contract `Workspace`; owned by a profile and identified by invite code. |
| `workspace_members` | Contract `WorkspaceMember`; owner/member roles. |
| `channels` | Contract `Channel`; workspace-scoped chat rooms. |
| `documents` | Contract `DocumentMeta`; workspace-scoped Yjs document metadata. |
| `messages` | Contract `ChatMessage`; persisted channel messages. |

## RLS summary

- RLS is enabled on all core public tables.
- Workspace-scoped reads require `public.is_workspace_member(workspace_id)`.
- Workspace owner-only updates/deletes use `public.is_workspace_owner(workspace_id)`.
- Message reads/inserts require access to the channel's workspace through `public.can_access_channel(channel_id)`.
- Users can insert/update only their own `profiles` row.
- Workspace inserts automatically create the owner membership with a security-definer trigger, so the contract `createWorkspace({ name })` can return a workspace visible to its creator.
- A new workspace creator may also add themselves as owner through a security-definer owner-record helper; owners may manage membership.
- The backend service role key bypasses RLS and is used only by the Node server for trusted persistence/auth checks.
- `workspaces`, `workspace_members`, `channels`, `documents`, and `messages` are added to `supabase_realtime` when that publication exists, so the frontend can invalidate TanStack Query caches without manual refresh.

## Seed users

The local seed creates two confirmed users with password `password123`:

- `ada@syncspace.dev`
- `grace@syncspace.dev`

It also creates workspace `SyncSpace Demo`, channels `general` and `docs`, document `Welcome to SyncSpace`, and two starter messages.
