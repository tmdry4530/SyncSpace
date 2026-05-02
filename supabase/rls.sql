-- SyncSpace row-level security policies. Run after schema.sql.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.channels enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;

-- Profiles are visible to users who share at least one workspace. Users can manage their own profile.
drop policy if exists profiles_select_workspace_peers on public.profiles;
create policy profiles_select_workspace_peers
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members viewer
    join public.workspace_members target on target.workspace_id = viewer.workspace_id
    where viewer.user_id = auth.uid()
      and target.user_id = profiles.id
  )
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Workspaces are visible to members. Authenticated users can create workspaces they own.
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces for select
to authenticated
using (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner
on public.workspaces for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner
on public.workspaces for update
to authenticated
using (public.is_workspace_owner(id))
with check (owner_id = auth.uid());

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner
on public.workspaces for delete
to authenticated
using (public.is_workspace_owner(id));

-- Members can read their workspace roster. Owners can add/remove members; creators can add themselves as owner.
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_owner_or_self_owner on public.workspace_members;
create policy workspace_members_insert_owner_or_self_owner
on public.workspace_members for insert
to authenticated
with check (
  public.is_workspace_owner(workspace_id)
  or (
    user_id = auth.uid()
    and role = 'owner'
    and public.is_workspace_record_owner(workspace_id)
  )
);

drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner
on public.workspace_members for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists workspace_members_delete_owner_or_self on public.workspace_members;
create policy workspace_members_delete_owner_or_self
on public.workspace_members for delete
to authenticated
using (public.is_workspace_owner(workspace_id) or user_id = auth.uid());

-- Channels are workspace-scoped.
drop policy if exists channels_select_member on public.channels;
create policy channels_select_member
on public.channels for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists channels_insert_member on public.channels;
create policy channels_insert_member
on public.channels for insert
to authenticated
with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists channels_update_owner on public.channels;
create policy channels_update_owner
on public.channels for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists channels_delete_owner on public.channels;
create policy channels_delete_owner
on public.channels for delete
to authenticated
using (public.is_workspace_owner(workspace_id));

-- Documents are workspace-scoped metadata; Yjs document contents flow through the backend WS room.
drop policy if exists documents_select_member on public.documents;
create policy documents_select_member
on public.documents for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists documents_insert_member on public.documents;
create policy documents_insert_member
on public.documents for insert
to authenticated
with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists documents_update_member on public.documents;
create policy documents_update_member
on public.documents for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists documents_delete_owner on public.documents;
create policy documents_delete_owner
on public.documents for delete
to authenticated
using (public.is_workspace_owner(workspace_id));

-- Messages are channel-scoped and readable/writable only by workspace members.
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member
on public.messages for select
to authenticated
using (public.can_access_channel(channel_id));

drop policy if exists messages_insert_member_self on public.messages;
create policy messages_insert_member_self
on public.messages for insert
to authenticated
with check (user_id = auth.uid() and public.can_access_channel(channel_id));

drop policy if exists messages_delete_owner_or_self on public.messages;
create policy messages_delete_owner_or_self
on public.messages for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.channels c
    where c.id = channel_id
      and public.is_workspace_owner(c.workspace_id)
  )
);
