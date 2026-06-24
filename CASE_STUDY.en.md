# SyncSpace — Case Study

> A real-time collaboration workbench that puts chat and a shared document on one screen. Designed, built, deployed, and operated solo.

- **Live demo**: https://server-production-cc9e.up.railway.app (sign up and use it right away)
- **Role**: Solo (design, frontend, backend, infrastructure, visual design)
- **One line**: Started as a three-service stack (Supabase + Vercel + Railway) and consolidated it into a **single Railway service** (SPA + REST + Yjs WebSocket + Postgres), with self-hosted session auth and a dark-mode design system built from scratch.

This document is not a feature list. It's a record of **what I decided and why, what was hard, and what I'd change next time.**

---

## 1. What it is

Team collaboration usually splits into "discuss in chat → decide → re-type it into a doc," and context leaks out in the gap. SyncSpace puts the **chat panel and a collaborative document editor on one screen (a workbench)** so decisions from the conversation can be captured into the doc immediately.

- Channel chat + Yjs/TipTap collaborative document editing, side by side
- Workspace / channel / document encoded in the URL, so context survives a refresh
- Real-time co-editing, presence, light/dark themes

---

## 2. Architecture: three services → one

**Before (BaaS mix):**

```
Vercel (frontend) ── Supabase (Auth + Postgres + RLS + Realtime)
       └─────────── Railway (Yjs WebSocket server)
```

**Now (single Railway service):**

```
Railway, one service
  └ Node HTTP server: serves the built SPA + REST API + Yjs WS upgrade
Railway Postgres: data + sessions + Yjs snapshots
```

Operations spread across three places (two deploy targets + one auth/DB provider) collapsed into one service + one DB. A single `pnpm build` compiles the SPA into `dist/` and the server into `server/dist/`, and the same Node server handles static files, the API, and WebSockets on one port.

---

## 3. Key decisions and why

**1) Yjs (CRDT) as the core of real-time.**
Both chat and documents run as Yjs rooms. CRDTs guarantee conflict resolution for concurrent document edits, and reusing the same channel for chat kept the infrastructure simple. The server persists each room's changes as Postgres snapshots.

**2) State split into three layers.**
Instead of one global store, state is separated by nature: `Zustand` (UI state) / `TanStack Query` (server lists and message cache, polling) / `Yjs` (real-time rooms and presence). Components never have to juggle UI, server cache, and WS sync at once.

**3) WebSocket for live, polling for server state.**
Message history and channel/document lists stay fresh via 1.5s TanStack polling, while the actual live path (chat input, document edits, presence) flows over the Yjs WS. Simple, but a clear boundary.

**4) Supabase Auth → self-hosted sessions.**
Removing Supabase meant implementing auth myself. I used an **opaque random token** (not a JWT) and store only `SHA-256(token + server secret)` in the DB, never the token itself. Passwords use scrypt (per-hash salt); sessions ride an `HttpOnly` cookie (SameSite=Lax). I chose opaque tokens so the server can revoke/rotate sessions (something a stateless JWT can't do cleanly).

**5) Dark mode as a semantic token architecture.**
Colors aren't hardcoded in components. They're defined as ~79 semantic tokens on `:root`, and a single `:root[data-theme='dark']` block re-defines the token values so the whole app flips at once. Light/dark/system + a pre-paint init that avoids a flash on load.

---

## 4. What was hard (debugging war stories)

**Production went blank from a CORS leak.**
Right after cutting over to Railway, the live site was a blank page. Probing the same asset from different origins with a headless browser showed: the app's own origin got a **403**, but `localhost` got 200. Cause: I'd set the env vars with `--skip-deploys`, so they **never reached the already-running container**, and that container's CORS allowlist still held the defaults (localhost only). Lesson: env vars are read at boot. After setting them, redeploy. (One redeploy fixed it.)

**The build-time env / domain chicken-and-egg.**
`VITE_*` (API/WS URLs) get baked into the bundle at build time, but the domain is only issued after the service exists. Get the order wrong and the SPA calls localhost. I had to pin the sequence: create service → generate domain → set domain-dependent vars → then build.

**A dark-mode leak the build couldn't catch.**
In dark mode only the chat pane stayed white. A legacy class (`.message-list { background:#f7f9fb }`) and a token-based class (`.ap-wb-chat-scroll`, no background) were **applied to the same element**; since the token class set no background, the hardcoded light color showed through. `tsc`, `vite build`, and tests all passed. **This was only caught by auditing the live app in dark mode, not by the build.** A good reminder that visual bugs need visual verification.

---

## 5. What I'd change next time

- **Validate demand first.** The biggest lesson isn't technical. Before building, I should have found a person who desperately wanted this. (A crowded market + an unvalidated build is a textbook "solution in search of a problem.")
- **Unify the CSS on tokens.** Dual-applying legacy and token classes was the root cause of the dark-mode leak. A single token-only system would have made that class of bug structurally impossible.
- **Reduce build-time env coupling.** Leaning on `VITE_*` made deploys brittle. Same-origin relative paths + runtime config would have broken far less often.
- **Unify chat real-time.** Today it's history-polling + Yjs WS in parallel. Collapsing onto one (SSE or WS) would cut the duplicate load and complexity.

---

## 6. How I verified

I didn't treat "the build passes" as done. On every deploy I **verified the live domain directly with a headless browser**: register/login round-trip, create workspace/channel/document, send chat, edit a doc, confirm the WebSocket connects, toggle dark mode, persist the session across a refresh, and watch the network tab for failed requests or calls to the wrong host. Both the CORS blank-page and the dark-mode leak were caught this way.

---

## 7. Stack

| Area | Tech |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Routing / State | React Router 7, Zustand (UI), TanStack Query (server) |
| Realtime / Editor | Yjs, y-websocket, TipTap (Collaboration) |
| Backend | Node HTTP + WebSocket (REST + Yjs WS + SPA serving), migration runner (advisory lock + checksums) |
| Auth | Self-hosted sessions (opaque token + SHA-256 at rest), scrypt passwords, HttpOnly cookie |
| DB / Deploy | Railway Postgres, single Railway service |
| Design | Semantic CSS tokens + light/dark/system theme |
