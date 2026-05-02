-- Local development seed data for Supabase CLI.
-- Password for both seed users: password123
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'ada@syncspace.dev',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"displayName":"Ada Lovelace","color":"#7c3aed"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'grace@syncspace.dev',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"displayName":"Grace Hopper","color":"#0891b2"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, display_name, avatar_url, color)
values
  ('00000000-0000-0000-0000-000000000101', 'Ada Lovelace', null, '#7c3aed'),
  ('00000000-0000-0000-0000-000000000102', 'Grace Hopper', null, '#0891b2')
on conflict (id) do update
set display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    color = excluded.color;

insert into public.workspaces (id, name, owner_id, invite_code, created_at)
values (
  '10000000-0000-0000-0000-000000000001',
  'SyncSpace Demo',
  '00000000-0000-0000-0000-000000000101',
  'SYNCDEMO01',
  now()
)
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role, joined_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'owner', now()),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'member', now())
on conflict (workspace_id, user_id) do nothing;

insert into public.channels (id, workspace_id, name, created_by, created_at)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'general', '00000000-0000-0000-0000-000000000101', now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'docs', '00000000-0000-0000-0000-000000000101', now())
on conflict (id) do nothing;

insert into public.documents (id, workspace_id, title, created_by, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Welcome to SyncSpace', '00000000-0000-0000-0000-000000000101', now())
on conflict (id) do nothing;

insert into public.messages (id, channel_id, user_id, content, client_id, created_at)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Welcome to SyncSpace!', 'seed-hello-1', now() - interval '5 minutes'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Realtime collaboration is ready for local testing.', 'seed-hello-2', now() - interval '4 minutes')
on conflict (id) do nothing;
