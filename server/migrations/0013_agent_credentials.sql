-- 0013_agent_credentials.sql
-- Remove human accounts entirely. The agent credential (agent_tokens) becomes the
-- only account: identity = agent + participant + workspace. Every former app_users
-- reference is repointed to participants or dropped.

-- 1. Drop the owner-member trigger/function (membership is now set in code, because
--    a workspace's owner participant only exists after its agent is created).
drop trigger if exists workspaces_add_owner_member on workspaces;
drop function if exists add_workspace_owner_member();

-- 2. participants: sever the human linkage to app_users.
alter table participants drop constraint if exists participants_exactly_one_owner;
drop index if exists participants_user_unique;
alter table participants drop column if exists user_id; -- drops the app_users FK too
alter table participants
  add constraint participants_agent_only
  check (participant_type = 'agent' and agent_id is not null);

-- 3. workspaces: owner is now a participant (nullable; set after the agent exists).
alter table workspaces
  add column if not exists owner_participant_id uuid references participants(id) on delete set null;
alter table workspaces drop column if exists owner_id; -- drops app_users FK + NOT NULL

-- 4. workspace_members: participant-based membership.
alter table workspace_members drop constraint if exists workspace_members_pkey;
drop index if exists idx_workspace_members_user_id;
alter table workspace_members drop column if exists user_id; -- drops app_users FK
alter table workspace_members alter column participant_id set not null;
alter table workspace_members add primary key (workspace_id, participant_id);

-- 5. channels / documents: created_by now references a participant (nullable).
alter table channels drop constraint if exists channels_created_by_fkey;
alter table channels alter column created_by drop not null;
alter table channels
  add constraint channels_created_by_participant_fkey
  foreign key (created_by) references participants(id) on delete set null;

alter table documents drop constraint if exists documents_created_by_fkey;
alter table documents alter column created_by drop not null;
alter table documents
  add constraint documents_created_by_participant_fkey
  foreign key (created_by) references participants(id) on delete set null;

-- 6. messages: drop legacy user_id (authorship lives in author_participant_id).
alter table messages drop constraint if exists messages_user_id_fkey;
alter table messages drop column if exists user_id;

-- 7. agents: drop created_by (no human creators anymore).
alter table agents drop constraint if exists agents_created_by_fkey;
alter table agents drop column if exists created_by;

-- 8. Drop the human auth tables.
drop table if exists auth_sessions;
drop table if exists app_users cascade;

-- 9. Agent registration challenges (capability gate at registration).
create table agent_registration_challenges (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  prompt text not null,
  answer_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  solved boolean not null default false
);

create index agent_registration_challenges_active_idx
  on agent_registration_challenges (expires_at)
  where consumed_at is null;
