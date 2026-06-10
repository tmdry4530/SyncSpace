-- 0015_remote_a2a_dedup.sql
-- Idempotency for polled remote A2A results: a remote task may be polled many
-- times and return the same artifacts/messages. We claim each external event key
-- once per local task so the bridge mirrors it into local events exactly once.

create table remote_a2a_event_dedup (
  local_task_id uuid not null references a2a_tasks(id) on delete cascade,
  external_event_key text not null,
  created_at timestamptz not null default now(),
  primary key (local_task_id, external_event_key)
);
