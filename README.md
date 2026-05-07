# SyncSpace

> 채팅으로 결정하고, 같은 워크스페이스의 문서에 바로 정리하는 React 실시간 협업 워크벤치

SyncSpace는 채널 대화, 공동 문서 편집, 워크스페이스 내비게이션을 하나의 split workbench 화면에 묶은 협업 앱입니다. React 앱 안에서 **로컬 UI 상태**, **서버 캐시 상태**, **실시간 협업 상태**를 분리해 관리하는 것을 핵심 설계 목표로 삼았습니다.

- **Zustand**: 사이드바 접힘, 현재 워크스페이스/채널/문서, 채팅 draft 같은 로컬 UI 상태
- **TanStack Query**: 워크스페이스, 채널, 문서, 메시지 히스토리 같은 서버 상태
- **Yjs + y-websocket**: 채팅 room, 문서 room, awareness/presence 같은 실시간 협업 상태
- **Supabase**: 인증, Postgres, RLS, 서버 상태 realtime invalidation

## Live

- App: https://sync-space-green.vercel.app/

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| Split Workbench | 왼쪽 채팅, 오른쪽 문서를 한 화면에서 동시에 사용 |
| Workspace Navigation | 워크스페이스 안에서 채널/문서 선택 상태를 URL과 store로 유지 |
| Channel Chat | 메시지 히스토리 조회 + Yjs 기반 실시간 메시지 반영 |
| Collaborative Editor | Tiptap + Yjs Collaboration 기반 문서 공동 편집 |
| Presence Summary | 워크스페이스 접속 상태를 상단 command bar에 요약 표시 |
| Document Links | `[[문서명]]` 문법을 분석해 워크스페이스 내 문서 링크로 연결 |
| Editor Knowledge Rail | 제목 목차, 문서 링크 후보, `#태그`, 단어/제목 수 표시 |
| Responsive Sidebar | 접힘/펼침, tablet 좌측 rail, mobile drawer 내비게이션 지원 |
| Invite Flow | 초대 코드 복사와 초대 코드 기반 워크스페이스 참여 |

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Routing | React Router 7 |
| Local UI State | Zustand 5 |
| Server State | TanStack Query 5 |
| Realtime Collaboration | Yjs, y-websocket, `@y/websocket-server` |
| Editor | Tiptap StarterKit, Placeholder, Collaboration |
| Backend | Node.js HTTP/WebSocket server, TypeScript, `ws`, `tsx` |
| Database/Auth | Supabase Auth, Postgres, RLS |
| Package Manager | pnpm 10.28.0 |
| Runtime | Node.js 22.x 권장 |

## 화면 구조

```txt
Workspace Shell
├─ Workspace Header
│  ├─ 워크스페이스 이름
│  ├─ 초대 코드 액션
│  └─ 계정/워크스페이스 이동 액션
├─ Sidebar
│  ├─ 워크스페이스 홈
│  ├─ 채널 목록 / 채널 생성
│  └─ 문서 목록 / 문서 생성
└─ Split Workbench
   ├─ Command Bar
   │  ├─ 현재 채널 · 현재 문서
   │  └─ 실시간 연결 / 접속 인원 요약
   ├─ Chat Panel
   └─ Document Panel
      ├─ Tiptap editor
      └─ Knowledge rail
```

채팅 패널과 문서 패널은 워크벤치 안에서는 `채팅`, `문서`라는 짧은 섹션 라벨만 보여주고, 채널명/문서명/접속 요약은 command bar에서 한 번만 보여줍니다.

## 라우팅

```txt
/                                           # 홈
/auth/login                                 # 로그인/가입
/workspaces                                 # 워크스페이스 목록
/w/:workspaceId                             # 워크스페이스 workbench
/w/:workspaceId/ch/:channelId               # 채널 선택 workbench
/w/:workspaceId/doc/:documentId             # 문서 선택 workbench
/w/:workspaceId/ch/:channelId/doc/:documentId # 채널+문서 선택 workbench
/api-contract                               # 앱 내부 계약 문서 화면
```

문서 링크와 사이드바 이동은 React Router의 `Link`/`NavLink`를 사용합니다. 같은 앱 내부 이동이므로 브라우저 전체 reload 없이 현재 workbench 문맥을 유지합니다.

## 상태 관리 설계

```txt
React UI
├─ Zustand
│  └─ sidebar, current workspace/channel/document, drafts, presence UI cache
│
├─ TanStack Query
│  └─ workspaces, channels, documents, persisted chat messages
│
└─ Yjs
   └─ chat room, document room, awareness/presence
```

상태를 한 store에 몰아넣지 않고 성격별로 분리했습니다.

- UI 조작만 필요한 값은 Zustand에 둡니다.
- DB에서 온 목록/메시지는 TanStack Query cache로 관리합니다.
- 동시 편집과 실시간 전파는 Yjs room이 소유합니다.
- Supabase Realtime은 workspace/channel/document/message 목록 cache invalidation에 사용하고, polling fallback을 둡니다.

## Realtime room 규칙

```txt
chat:{workspaceId}:{channelId}
doc:{workspaceId}:{documentId}
```

채팅과 문서는 서로 다른 room을 사용합니다. workbench 상단의 `실시간 연결 중` 표시는 개별 채팅/문서 room이 둘 다 같은 상태여야만 켜지는 값이 아니라, 워크스페이스 화면의 실시간 작업 가능 상태를 나타내는 요약입니다.

## 문서 편집 경험

문서 편집은 toolbar 중심이 아니라 Markdown/shortcut 중심입니다.

- `/` 슬래시 명령으로 제목, 목록, 인용, 코드, 구분선 등을 삽입
- `[[문서명]]`으로 같은 워크스페이스 안의 문서 링크 후보 표시
- `#태그`를 knowledge rail에 수집
- 문서 링크 클릭 시 현재 채널이 있으면 workbench route를 유지한 채 문서만 전환
- 본문 상단 여백과 패널 header를 줄여 문서 작성 시작점이 화면 상단에 가깝게 배치

## 프로젝트 구조

```txt
src/
├─ app/
│  ├─ providers/          # Query/Auth bootstrap providers
│  └─ router/             # routes, protected route wrappers
├─ features/
│  ├─ channel/            # 채널 목록/생성 query
│  ├─ chat/               # 채팅 패널, 메시지 query, Yjs chat room
│  ├─ documents/          # 문서 목록/생성 query
│  ├─ editor/             # Tiptap editor, slash command, knowledge rail
│  ├─ presence/           # awareness avatar/presence UI
│  ├─ realtime/           # Yjs provider, awareness, Supabase realtime bridge
│  └─ workspace/          # shell, sidebar, header, workspace queries
├─ pages/                 # route-level pages
├─ shared/
│  ├─ api/                # Supabase/backend clients
│  ├─ stores/             # Zustand stores
│  ├─ types/              # shared contracts/env types
│  └─ utils/              # room names, display names, dedupe
└─ styles.css             # app-wide design system and responsive layout

server/src/
├─ auth/                  # WebSocket auth and workspace membership checks
├─ http/                  # health/ready/API request handling
├─ persistence/           # Supabase admin adapters and message/doc persistence
├─ realtime/              # Yjs websocket setup, chat/doc room parsing
├─ routes/                # chat/doc websocket route helpers
├─ types/                 # backend contract types
└─ utils/                 # logger

supabase/
├─ schema.sql             # tables, indexes, triggers
├─ rls.sql                # Row Level Security policies
└─ seed.sql               # local/demo seed data
```

## Backend 역할

Backend는 React 앱을 보조하는 HTTP/WebSocket 인프라입니다.

| 역할 | 엔드포인트/규칙 |
| --- | --- |
| Health | `GET /health` |
| Readiness | `GET /ready` |
| Workspace 생성 | `POST /api/workspaces` |
| Workspace 삭제 | `DELETE /api/workspaces/:workspaceId` |
| 초대 코드 참여 | `POST /api/workspaces/join` |
| 문서 WebSocket | `ws://<server>/doc/:workspaceId/:documentId` |
| 채팅 WebSocket | `ws://<server>/chat/:workspaceId/:channelId` |

`SUPABASE_SERVICE_ROLE_KEY`가 없으면 workspace 생성/참여/삭제와 일부 persistence 기능은 비활성화됩니다. 이 키는 반드시 backend 전용으로만 사용해야 하며, `VITE_` 환경 변수에 넣으면 안 됩니다.

## 배포 구조

권장 배포 조합:

```txt
Vercel       → Vite React frontend
Railway      → Node.js HTTP/WebSocket backend
Supabase     → Auth, Postgres, RLS, Realtime
```

운영 환경에서는 다음을 확인해야 합니다.

- `ALLOWED_ORIGINS`를 실제 frontend origin으로 제한
- `WS_AUTH_MODE=supabase`로 WebSocket upgrade 인증 활성화
- `SUPABASE_SERVICE_ROLE_KEY`는 backend 환경에만 저장
- `VITE_API_URL`, `VITE_WS_URL`은 배포 backend 주소로 설정
- `SYNCSPACE_DOC_PERSISTENCE_DIR`는 필요 시 persistent volume에 연결
- Supabase schema/RLS 및 Realtime publication 적용

## 구현상 주의점

- 내부 route 이동에는 `<a href>` 대신 React Router `Link`/`NavLink`를 사용합니다.
- workbench command bar는 workspace-level 상태 요약만 담당하고, 개별 room health는 pane 내부 관심사로 둡니다.
- sidebar collapsed/tablet/mobile 규칙은 `WorkspaceShell`의 `sidebar-collapsed`, `mobile-sidebar-open` class와 CSS media query가 함께 제어합니다.
- 문서 editor는 toolbar가 아니라 Markdown/슬래시 명령 중심으로 설계되어 있습니다.
- `README.md`는 루트 온보딩 문서이고, 실험/발표/리포트성 문서는 별도 로컬 docs나 산출물로 관리합니다.

## 검증 기준

변경 후 기본적으로 아래를 통과시키는 것을 목표로 합니다.

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
```

프론트 UI 변경은 가능하면 브라우저에서 직접 확인합니다. 이 프로젝트는 agent-browser 기반 스크린샷 검증을 사용해 sidebar, workbench, editor spacing 같은 시각 변경을 확인해 왔습니다.

## 라이선스

Portfolio project.
