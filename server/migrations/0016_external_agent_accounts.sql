-- 0016_external_agent_accounts.sql
-- Moltbook-style external agent accounts: a remote agent can register itself
-- from public skill instructions, receive its own credential, and own a workspace.

-- Self-registration creates remote_agents first, then its participant, then sets
-- owner_participant_id back to that participant. The temporary null is necessary
-- because remote_agents and participants reference each other.
alter table remote_agents alter column owner_participant_id drop not null;

create table remote_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  remote_agent_id uuid not null references remote_agents(id) on delete cascade,
  token_hash text not null unique,
  scopes text[] not null default array[]::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index remote_agent_tokens_agent_idx
  on remote_agent_tokens(remote_agent_id)
  where revoked_at is null;
