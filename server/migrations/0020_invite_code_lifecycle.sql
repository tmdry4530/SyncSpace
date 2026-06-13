-- 0020_invite_code_lifecycle.sql
-- Invite-code lifecycle metadata. Additive and reversible.
--
-- Both columns are nullable. A null `invite_code_expires_at` means the code
-- never expires, preserving the current always-valid behavior. `rotated_at`
-- records when a member last regenerated the code.

alter table workspaces add column if not exists invite_code_rotated_at timestamptz;
alter table workspaces add column if not exists invite_code_expires_at timestamptz;
