# SUPABASE_SCHEMA.md

## Tables

### profiles
- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text`
- `avatar_url text`
- `created_at timestamptz default now()`

### workspaces
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `owner_id uuid not null references auth.users(id)`
- `invite_code text unique not null`
- `created_at timestamptz default now()`

### workspace_members
- `workspace_id uuid references workspaces(id) on delete cascade`
- `user_id uuid references auth.users(id) on delete cascade`
- `role text check role in ('owner','member')`
- `joined_at timestamptz default now()`
- primary key `(workspace_id, user_id)`

### channels
- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id) on delete cascade`
- `name text not null`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz default now()`

### messages
- `id uuid primary key default gen_random_uuid()`
- `channel_id uuid references channels(id) on delete cascade`
- `user_id uuid references auth.users(id)`
- `content text not null`
- `created_at timestamptz default now()`

### documents
- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid references workspaces(id) on delete cascade`
- `title text not null default 'Untitled'`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Optional:
- `yjs_state bytea`
- `content_snapshot jsonb`

## RLS
Enable RLS on every table.

Membership rule:
- workspace-owned data is readable/writable only by users in `workspace_members`.

Create helper:
```sql
public.is_workspace_member(target_workspace_id uuid, target_user_id uuid) returns boolean
```

## Required Indexes
- `workspace_members(user_id)`
- `channels(workspace_id)`
- `documents(workspace_id)`
- `messages(channel_id, created_at desc)`
