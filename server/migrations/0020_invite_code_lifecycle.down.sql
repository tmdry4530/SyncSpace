-- 0020_invite_code_lifecycle.down.sql
-- Revert 0020: drop the invite-code lifecycle columns.

alter table workspaces drop column if exists invite_code_expires_at;
alter table workspaces drop column if exists invite_code_rotated_at;
