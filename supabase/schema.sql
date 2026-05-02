-- SyncSpace core schema. Run before rls.sql and seed.sql.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  content text not null check (char_length(content) between 1 and 4000),
  client_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_channels_workspace_id on public.channels (workspace_id);
create index if not exists idx_documents_workspace_id_updated_at on public.documents (workspace_id, updated_at desc);
create index if not exists idx_messages_channel_id_created_at on public.messages (channel_id, created_at desc, id desc);
create unique index if not exists idx_messages_channel_client_id_unique
  on public.messages (channel_id, client_id)
  where client_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace function public.add_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_add_owner_member on public.workspaces;
create trigger workspaces_add_owner_member
after insert on public.workspaces
for each row execute function public.add_workspace_owner_member();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

create or replace function public.is_workspace_record_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where c.id = target_channel_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, color)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'displayName', ''), split_part(new.email, '@', 1), 'SyncSpace User'),
    nullif(new.raw_user_meta_data ->> 'avatarUrl', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'color', ''), '#64748b')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_syncspace_profile on auth.users;
create trigger on_auth_user_created_syncspace_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Supabase Realtime publication for frontend server-state cache invalidation.
-- The app also keeps a short polling fallback, but enabling this publication
-- makes workspace/channel/document/message list updates arrive immediately.
alter table public.workspaces replica identity full;
alter table public.workspace_members replica identity full;
alter table public.channels replica identity full;
alter table public.documents replica identity full;
alter table public.messages replica identity full;

do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'workspaces',
    'workspace_members',
    'channels',
    'documents',
    'messages'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array realtime_tables loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
