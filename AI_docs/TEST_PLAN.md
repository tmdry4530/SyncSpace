# TEST_PLAN.md

## Required Commands
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional:
```bash
pnpm test:e2e
```

## Unit Tests
- Zustand stores
- query key factories
- timestamp formatting
- user color helper
- message deduplication
- chat event schema parser

## Component Tests
- LoginForm validation
- WorkspaceList loading/empty/error
- ChannelList active item
- DocumentList active item
- ChatInput empty submit prevention
- MessageItem rendering
- PresenceBar rendering

## Backend Tests
- route parser
- zod validation for chat events
- mocked message persistence adapter

## Manual Realtime Verification
- open two browser tabs
- open same document
- type in tab A and see tab B update
- send chat message in tab A and see tab B update
- restart realtime server and see connection UI change

## Release Gate
MVP complete if build succeeds, core routes work, chat persists, editor opens, document sync works across two tabs, and README documents any limitation.
