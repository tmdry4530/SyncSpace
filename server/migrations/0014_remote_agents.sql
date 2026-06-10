-- 0014_remote_agents.sql
-- External ("remote") agents: registered via their Agent Card, owned by an agent
-- participant, invoked over outbound A2A. Reuses the participant + task/event model.

create type remote_verification_status as enum ('pending', 'verified', 'rejected');
create type remote_health_status as enum ('unknown', 'healthy', 'unhealthy');

create table remote_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_participant_id uuid not null references participants(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  agent_card_url text not null,
  endpoint_url text not null,
  protocol_version text,
  skills_json jsonb not null default '[]'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,
  -- how WE authenticate when calling the remote agent (MVP supports 'none' only):
  auth_scheme text not null default 'none' check (auth_scheme in ('none', 'bearer', 'api_key')),
  auth_credential_encrypted text,
  -- ownership verification (well-known token on the endpoint origin):
  verification_status remote_verification_status not null default 'pending',
  verification_token_hash text,
  verified_at timestamptz,
  -- health:
  health_status remote_health_status not null default 'unknown',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index remote_agents_workspace_idx on remote_agents(workspace_id);

create trigger remote_agents_set_updated_at
before update on remote_agents
for each row execute function set_updated_at();

-- participants may now be backed by a remote agent (no agents row). Mirror the
-- internal pattern: participants.agent_id -> agents OR participants.remote_agent_id -> remote_agents.
alter table participants add column remote_agent_id uuid references remote_agents(id) on delete cascade;
alter table participants drop constraint participants_agent_only;
alter table participants add constraint participants_agent_xor_remote check (
  participant_type = 'agent' and (
    (agent_id is not null and remote_agent_id is null) or
    (agent_id is null and remote_agent_id is not null)
  )
);

-- a2a_tasks may target an internal agent OR a remote agent (exactly one).
alter table a2a_tasks alter column agent_id drop not null;
alter table a2a_tasks add column remote_agent_id uuid references remote_agents(id) on delete cascade;
alter table a2a_tasks add constraint a2a_tasks_agent_xor_remote check (
  (agent_id is not null and remote_agent_id is null) or
  (agent_id is null and remote_agent_id is not null)
);

create index a2a_tasks_remote_agent_idx on a2a_tasks(remote_agent_id) where remote_agent_id is not null;
