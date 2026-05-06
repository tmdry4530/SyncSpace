# SyncSpace

> 채팅으로 결정하고, 같은 화면의 문서에 바로 정리하는 React 실시간 협업 워크벤치

SyncSpace는 **React 기반 프론트엔드 포트폴리오 프로젝트**입니다. 채널 채팅과 공동 문서 편집을 하나의 workbench 화면에 통합하고, React 앱 안에서 UI 상태·서버 상태·실시간 협업 상태를 분리했습니다.

- **Zustand**: sidebar, selected item, pane 상태 같은 local UI state
- **TanStack Query**: workspace, channel, document, message history 같은 server state
- **Yjs**: chat/doc room, collaborative editing, awareness 같은 realtime state

Backend는 React 앱의 인증, 저장, WebSocket 동기화를 지원하는 보조 인프라입니다.

## Live

- App: https://sync-space-green.vercel.app/
- Login: https://sync-space-green.vercel.app/auth/login
- API Contract: https://sync-space-green.vercel.app/api-contract

## 주요 기능

| 기능                 | React 관점의 구현 포인트                  |
| -------------------- | ----------------------------------------- |
| Split Workbench      | 채팅과 문서를 한 화면의 좌우 패널로 구성  |
| Channel Chat         | 메시지 히스토리 + realtime message update |
| Collaborative Editor | Tiptap + Yjs 기반 문서 공동 편집          |
| Presence             | Yjs awareness state를 UI에 렌더링         |
| Workspace Navigation | workspace/channel/document 선택 상태 관리 |
| Notion/Obsidian-lite | `/` command, `[[문서명]]`, `#태그` 인식   |

## 기술 스택

| 영역            | 기술                                                 |
| --------------- | ---------------------------------------------------- |
| Frontend        | React 19, TypeScript, Vite                           |
| Routing         | React Router                                         |
| Local UI State  | Zustand                                              |
| Server State    | TanStack Query                                       |
| Realtime        | Yjs, y-websocket                                     |
| Editor          | Tiptap StarterKit, Tiptap Collaboration              |
| Backend Support | Node.js WebSocket server, Supabase Auth/Postgres/RLS |
| Deployment      | Vercel frontend, Railway backend, Supabase           |

## React 구조

```txt
src/
├─ app/                 # providers, router, protected routes
├─ pages/               # route pages
├─ features/
│  ├─ workspace/         # shell, sidebar, split layout
│  ├─ channel/           # channel list and mutations
│  ├─ chat/              # chat UI, message query, realtime room
│  ├─ documents/         # document metadata query/mutation
│  ├─ editor/            # Tiptap editor, slash command, insight rail
│  ├─ presence/          # awareness UI
│  └─ realtime/          # Yjs provider and connection hooks
└─ shared/              # api clients, stores, contracts, utilities
```

Route page는 화면 단위 책임을 갖고, 실제 기능 로직은 `src/features` 아래로 분리했습니다.

## 상태 관리 설계

```txt
React UI
├─ Zustand
│  └─ local UI state
│     sidebar, selected workspace/channel/document, visible pane
│
├─ TanStack Query
│  └─ server state
│     workspaces, channels, documents, persisted messages
│
└─ Yjs
   └─ realtime collaboration state
      chat updates, document updates, awareness
```

이 분리 덕분에 컴포넌트는 UI 상태, 서버 캐시, WebSocket 동기화 책임을 한 곳에 섞지 않습니다.

## 핵심 React 로직

### Workspace Workbench

Workspace 화면은 sidebar와 split workbench로 구성됩니다. Channel과 document를 별도 페이지로 완전히 분리하지 않고, 같은 workspace context 안에서 채팅과 문서를 동시에 유지합니다.

```txt
Workspace
├─ Sidebar
│  ├─ channel list
│  └─ document list
└─ Split Workbench
   ├─ Chat Panel
   └─ Document Panel
```

### Chat Panel

Chat Panel은 세 흐름을 합칩니다.

1. TanStack Query로 이전 메시지 히스토리 조회
2. Yjs chat room으로 새 메시지 실시간 반영
3. Composer 입력과 전송 상태를 React UI에 반영

### Document Editor

Document Editor는 Tiptap editor와 Yjs document를 연결합니다.

1. document room에 해당하는 Yjs document 생성
2. Tiptap Collaboration extension 연결
3. editor update를 같은 room의 다른 client에 전파
4. heading, `[[문서명]]`, `#태그`를 분석해 insight rail에 표시

### Presence

Presence는 Yjs awareness state를 React component에서 읽어 현재 접속자와 연결 상태를 표시합니다.

## Realtime room 규칙

```txt
chat:{workspaceId}:{channelId}
doc:{workspaceId}:{documentId}
```

채팅과 문서를 다른 room으로 분리해 서로 다른 데이터 구조와 동기화 흐름을 독립적으로 관리합니다.

## Backend 역할 요약

| 역할             | 설명                                                                |
| ---------------- | ------------------------------------------------------------------- |
| HTTP API         | workspace 생성, 초대 참여, 삭제처럼 service-role이 필요한 작업 처리 |
| WebSocket Server | Yjs chat/doc room 연결                                              |
| Persistence      | 채팅 메시지와 문서 snapshot 저장                                    |
| Supabase         | Auth, Postgres, RLS 제공                                            |

자세한 backend 계약은 `docs/contracts/API_CONTRACT_FIRST.md`, 운영 기준은 `server/README.md`에 정리되어 있습니다.

## 실행 방법

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:1234`
- Health check: `http://127.0.0.1:1234/health`

`SUPABASE_SERVICE_ROLE_KEY`는 backend 전용입니다. `VITE_` 환경 변수나 프론트엔드 번들에 포함하면 안 됩니다.

## 검증 명령

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm verify:all
```

Frontend 중심 검증은 `pnpm typecheck`와 `pnpm verify:frontend`를 우선 확인합니다.

## 배포 구조

권장 구조는 **Vercel frontend + Railway backend + Supabase**입니다.

- Vercel: Vite React 정적 frontend
- Railway: WebSocket을 유지하는 Node backend
- Supabase: Auth, Postgres, RLS

현재 frontend 배포 주소는 https://sync-space-green.vercel.app/ 입니다.

## 향후 개선 방향

- 문서 block drag handle / task-list node
- full-text search / backlink graph
- markdown import/export
- SSR 또는 prerender 기반 성능 개선

## 라이선스

Portfolio project.
