# ENVIRONMENT.md

## apps/web/.env.local
```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_REALTIME_URL=ws://localhost:4000
```

## apps/realtime-server/.env
```txt
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WEB_ORIGIN=http://localhost:5173
```

## Rules
- Commit only `.env.example`.
- Never commit real secrets.
- Service role key is server-only.
