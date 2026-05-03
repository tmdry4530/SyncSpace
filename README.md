# SyncSpace

> 채팅으로 결정하고, 같은 화면의 문서에 바로 정리하는 실시간 협업 워크벤치

SyncSpace는 **React 기반 포트폴리오 프로젝트**입니다. Slack처럼 채널에서 대화하고, Notion/Obsidian처럼 문서를 함께 편집하는 흐름을 하나의 화면에 통합했습니다. 발표의 핵심은 단순 CRUD가 아니라, **로컬 UI 상태, 서버 상태, 실시간 협업 상태를 의도적으로 분리한 프론트엔드 아키텍처**입니다.

## 발표 한 줄 요약

**Zustand는 UI 상태, TanStack Query는 서버 상태, Yjs는 실시간 문서/채팅 상태를 담당하도록 분리한 React 협업 앱입니다.**

## 데모에서 보여줄 것

1. 회원가입 또는 로그인
2. 워크스페이스 생성
3. 초대 코드 복사 및 참여 흐름
4. 같은 화면에서 채팅과 문서 동시 작업
5. 두 브라우저에서 채팅 실시간 동기화
6. 두 브라우저에서 문서 실시간 공동 편집
7. 접속자 presence 표시
8. `/` 슬래시 명령으로 문서 블록 작성
9. `[[문서명]]` 문서 링크와 `#태그` 인사이트 확인

## 핵심 기능

- **Split Workbench**: 채팅과 문서를 좌우로 나눈 작업 화면
- **Channel Chat**: 채널별 실시간 채팅 및 메시지 영속화
- **Collaborative Editor**: Tiptap + Yjs 기반 공동 문서 편집
- **Notion/Obsidian-lite Editor**: 슬래시 명령, 제목 목차, 문서 링크, 태그 레일
- **Presence**: 현재 접속자와 실시간 연결 상태 표시
- **Workspace Invite**: 초대 코드 복사와 참여 API
- **Supabase Auth / DB / RLS**: 인증, 데이터 저장, Row Level Security
- **Node.js WebSocket Server**: 채팅방, 문서방, awareness, persistence adapter

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router |
| Local UI State | Zustand |
| Server State | TanStack Query |
| Realtime Collaboration | Yjs, y-websocket, Tiptap Collaboration |
| Editor | Tiptap StarterKit |
| Backend | Node.js, TypeScript, ws |
| Database/Auth | Supabase Postgres, Supabase Auth, RLS |
| Validation | TypeScript, Vite build, backend build |
| Build Tool | pnpm workspace |

## 아키텍처 포인트

### 1. 상태 책임 분리

```txt
Zustand        local UI state
               sidebar open, selected workspace, active pane

TanStack Query server state
               workspaces, channels, documents, persisted messages

Yjs            realtime collaboration state
               document updates, chat room updates, awareness
```

이 구조 덕분에 UI 전환, 서버 캐시, 실시간 동기화가 서로를 침범하지 않습니다.

### 2. Contract-first backend

프론트와 백엔드는 타입과 명명 규칙을 공유해 맞춥니다. 공개 리포지토리에서는 계약 문서를 루트 README로 통합하고, 실제 코드 기준점은 아래 파일입니다.

- `src/shared/types/contracts.ts`: 프론트가 사용하는 워크스페이스, 채널, 문서, 메시지 타입
- `server/src/types/contracts.ts`: 백엔드가 맞춰야 하는 요청/응답 타입
- `src/shared/utils/roomNames.ts`, `server/src/realtime/roomNames.ts`: WebSocket room naming 규칙
- `supabase/schema.sql`, `supabase/rls.sql`: DB shape와 RLS policy

### 3. 실시간 동기화 전략

```txt
React UI
  ├─ TanStack Query: DB 기반 목록과 히스토리 조회
  ├─ Supabase Realtime + polling fallback: 워크스페이스/채널/문서 목록 갱신
  └─ Yjs WebSocket Provider: 채팅/문서 room 실시간 동기화
```

채팅과 문서는 각각 독립 room으로 연결됩니다.

```txt
chat:{workspaceId}:{channelId}
doc:{workspaceId}:{documentId}
```

### 4. 에디터 설계

문서 에디터는 Tiptap과 Yjs를 기반으로 하고, 포트폴리오 발표에서 보이기 좋은 협업 기능을 얹었습니다.

- `/h1`, `/h2`, `/list`, `/code` 같은 슬래시 명령
- heading node를 스캔해서 우측 목차 생성
- `[[문서명]]` 패턴으로 문서 링크 후보 표시
- `#태그` 패턴으로 태그 인사이트 표시
- 단어 수와 제목 수 요약

## 폴더 구조

```txt
SyncSpace/
├─ src/
│  ├─ app/                 # providers, router
│  ├─ pages/               # route pages
│  ├─ features/
│  │  ├─ workspace/         # workspace shell, sidebar, queries
│  │  ├─ channel/           # channel list and mutations
│  │  ├─ chat/              # chat UI, queries, realtime room
│  │  ├─ documents/         # document metadata queries
│  │  ├─ editor/            # collaborative editor, slash command, insight rail
│  │  ├─ presence/          # awareness UI
│  │  └─ realtime/          # Yjs provider and connection hooks
│  └─ shared/              # api clients, stores, contracts, utilities
├─ server/
│  └─ src/
│     ├─ auth/              # realtime auth guard
│     ├─ http/              # HTTP app
│     ├─ persistence/       # Supabase adapters
│     ├─ realtime/          # chat/doc room setup
│     └─ routes/            # REST routes
└─ supabase/               # schema, RLS, seed
```

> 테스트 파일, QA 리포트, AI 작업 문서는 로컬 전용으로 `.gitignore` 처리되어 공개 리포지토리에는 올리지 않습니다.

## React 코드 이해 가이드

이 프로젝트를 읽을 때는 컴포넌트를 무작정 위에서부터 보지 말고, **진입점 → 라우터 → 보호된 앱 영역 → 워크스페이스 화면 → 상태/데이터 훅 → 실시간 훅** 순서로 따라가면 이해하기 쉽습니다.

### 1. 앱이 처음 켜지는 흐름

```txt
index.html
  └─ src/main.tsx
      └─ src/app/App.tsx
          └─ src/app/router/router.tsx
              └─ route별 page/component
```

먼저 볼 파일:

- `src/main.tsx`: React DOM root를 만들고 `<App />`을 렌더링합니다.
- `src/app/App.tsx`: React Router의 `RouterProvider`만 담당합니다.
- `src/app/router/router.tsx`: URL이 어떤 페이지와 컴포넌트로 이어지는지 정의합니다.
- `src/app/router/routes.ts`: route path 상수를 모아둔 파일입니다.

핵심 관점은 “어떤 URL이 어떤 화면을 여는가”입니다. 예를 들어 `/w/:workspaceId/ch/:channelId/doc/:documentId`는 워크스페이스 안에서 채팅과 문서를 함께 여는 경로입니다.

### 2. 로그인 이후 앱 영역

```txt
ProtectedAppRoute
  └─ AppProviders
      ├─ QueryProvider
      ├─ AuthBootstrap
      └─ ServerRealtimeBridge
```

먼저 볼 파일:

- `src/app/router/ProtectedAppRoute.tsx`: 로그인 이후 화면에 공통 provider를 씌웁니다.
- `src/app/router/ProtectedRoute.tsx`: 로그인 여부를 확인하고 보호된 route를 막거나 통과시킵니다.
- `src/app/providers/AppProviders.tsx`: TanStack Query, Supabase auth bootstrap, 서버 상태 realtime bridge를 연결합니다.
- `src/app/providers/QueryProvider.tsx`: `QueryClient` 기본 옵션을 만듭니다.

여기서 봐야 할 흐름은 “인증 세션을 Zustand에 넣고, 서버 상태 조회는 QueryProvider 아래에서 실행된다”입니다.

### 3. 화면 구조를 이해하는 순서

워크스페이스 진입 후 화면은 아래 흐름으로 읽으면 됩니다.

```txt
src/pages/workspace/WorkspacePage.tsx
  └─ 워크스페이스 목록/생성/참여

src/features/workspace/components/WorkspaceShell.tsx
  ├─ Sidebar
  ├─ WorkspaceHeader
  └─ Outlet
      └─ src/pages/workspace/WorkspaceSplitPage.tsx
          ├─ ChatPanel
          └─ EditorPanel
```

먼저 볼 파일:

- `src/pages/workspace/WorkspacePage.tsx`: 로그인 후 워크스페이스 목록으로 들어가는 첫 화면입니다.
- `src/features/workspace/components/WorkspaceShell.tsx`: 사이드바와 상단 헤더, 내부 route outlet을 담당합니다.
- `src/pages/workspace/WorkspaceSplitPage.tsx`: 채팅 패널과 문서 패널을 한 화면에 배치하는 핵심 화면입니다.
- `src/features/workspace/components/Sidebar.tsx`: 워크스페이스 안의 채널/문서 목록 탐색을 담당합니다.
- `src/features/chat/components/ChatPanel.tsx`: 채팅 히스토리와 실시간 메시지를 합쳐 보여줍니다.
- `src/features/editor/components/EditorPanel.tsx`: Tiptap editor, presence, slash command, knowledge rail을 조립합니다.

화면을 이해할 때는 `WorkspaceSplitPage`를 중심에 두고 “왼쪽은 채팅, 오른쪽은 문서, 둘 다 같은 workspaceId를 공유한다”고 보면 됩니다.

### 4. 세 종류의 상태를 구분해서 보기

SyncSpace의 가장 중요한 React 학습 포인트는 상태 책임 분리입니다.

#### Zustand: 로컬 UI 상태

볼 파일:

- `src/shared/stores/authStore.ts`: 로그인 세션과 사용자 프로필
- `src/shared/stores/workspaceUiStore.ts`: 현재 workspace/channel/document 선택 기억
- `src/shared/stores/sidebarStore.ts`: 사이드바 열림/접힘
- `src/shared/stores/presenceStore.ts`: presence UI 표시용 상태
- `src/shared/stores/chatUiStore.ts`, `src/shared/stores/editorUiStore.ts`: 패널 UI 상태

판단 기준: 서버에서 다시 받아와야 하는 데이터가 아니라 “지금 이 브라우저 화면의 선택/표시 상태”면 Zustand입니다.

#### TanStack Query: 서버 상태

볼 파일:

- `src/features/workspace/queries/useWorkspacesQuery.ts`
- `src/features/workspace/queries/useCreateWorkspaceMutation.ts`
- `src/features/workspace/queries/useJoinWorkspaceMutation.ts`
- `src/features/channel/queries/useChannelsQuery.ts`
- `src/features/channel/queries/useCreateChannelMutation.ts`
- `src/features/documents/queries/useDocumentsQuery.ts`
- `src/features/documents/queries/useCreateDocumentMutation.ts`
- `src/features/chat/queries/useMessagesInfiniteQuery.ts`

판단 기준: DB에 저장되어 있고 여러 화면에서 다시 조회/캐시/무효화해야 하는 데이터면 TanStack Query입니다.

#### Yjs: 실시간 협업 상태

볼 파일:

- `src/features/realtime/useYProvider.ts`: WebSocket provider 생성
- `src/features/realtime/useYDoc.ts`: Yjs document lifecycle
- `src/features/realtime/useYAwareness.ts`: 접속자 awareness
- `src/features/chat/realtime/useYChatRoom.ts`: 채팅 room 실시간 메시지
- `src/features/editor/realtime/useYEditorRoom.ts`: 문서 room 실시간 편집
- `src/features/realtime/useConnectionStatus.ts`: 연결 상태 표시

판단 기준: 여러 브라우저가 동시에 편집/전송하고 즉시 동기화되어야 하는 데이터면 Yjs입니다.

### 5. 데이터가 오가는 실제 흐름

#### 워크스페이스 목록

```txt
WorkspacePage
  └─ useWorkspacesQuery
      └─ Supabase client
          └─ workspaces/memberships tables
```

#### 채팅

```txt
ChatPanel
  ├─ useMessagesInfiniteQuery       # DB에 저장된 이전 메시지
  ├─ useYChatRoom                   # 지금 들어오는 실시간 메시지
  └─ MessageList / MessageComposer  # 화면 표시와 입력
```

`ChatPanel`은 서버 히스토리와 Yjs 실시간 메시지를 합친 뒤 중복을 제거해서 보여줍니다. 그래서 “저장된 메시지”와 “방금 들어온 메시지”가 같은 리스트처럼 보입니다.

#### 문서 편집

```txt
EditorPanel
  ├─ useYEditorRoom
  │   └─ Yjs doc + awareness + connection status
  ├─ useCollaborativeEditor
  │   └─ Tiptap editor instance
  ├─ EditorToolbar
  ├─ SlashCommandMenu
  └─ EditorKnowledgeRail
```

문서 본문은 일반 REST 저장 상태로 직접 다루지 않고, Yjs document를 Tiptap collaboration extension에 연결해서 동기화합니다.

### 6. API와 환경 변수 위치

볼 파일:

- `src/shared/api/supabaseClient.ts`: Supabase browser client 생성
- `src/shared/api/backendClient.ts`: 백엔드 REST 요청 공통 함수
- `src/shared/types/env.ts`: `VITE_` 환경 변수 읽기
- `.env.example`: 필요한 환경 변수 목록

프론트에서 사용할 수 있는 환경 변수는 `VITE_` 접두사가 붙은 값뿐입니다. `SUPABASE_SERVICE_ROLE_KEY`는 백엔드 전용이라 프론트 코드에서 읽으면 안 됩니다.

### 7. 백엔드와 연결해서 읽는 방법

프론트만 보다가 흐름이 끊기면 아래 백엔드 파일을 같이 보면 됩니다.

- `server/src/http/app.ts`: HTTP route 조립
- `server/src/routes/chatRoute.ts`: 채팅 메시지 저장/조회 API
- `server/src/routes/docRoute.ts`: 문서 관련 API
- `server/src/realtime/chatRoom.ts`: 채팅 Yjs room 처리
- `server/src/realtime/docRoom.ts`: 문서 Yjs room 처리
- `server/src/realtime/setupYWebsocket.ts`: WebSocket 서버 연결
- `server/src/persistence/supabaseAdmin.ts`: service role 기반 DB 접근

React 코드를 이해하는 목적이라면 백엔드는 “프론트 훅이 호출하는 대상” 정도로만 먼저 보고, 자세한 구현은 나중에 따라가도 됩니다.

### 8. 추천 학습 순서

1. `src/main.tsx` → `src/app/App.tsx` → `src/app/router/router.tsx`로 앱 진입 흐름 확인
2. `ProtectedAppRoute`와 `AppProviders`로 인증/provider 구조 확인
3. `WorkspacePage`에서 워크스페이스 목록이 어떻게 조회되는지 확인
4. `WorkspaceShell`에서 레이아웃과 `Outlet` 구조 확인
5. `WorkspaceSplitPage`에서 채팅/문서가 어떻게 동시에 배치되는지 확인
6. `ChatPanel`에서 Query 데이터와 Yjs 데이터가 합쳐지는 방식 확인
7. `EditorPanel`에서 Tiptap, slash command, presence가 어떻게 조립되는지 확인
8. `shared/stores/*`와 `features/*/queries/*`, `features/realtime/*`를 비교하며 상태 책임 분리 복습
9. 마지막으로 `server/src/*`와 `supabase/*.sql`을 보며 프론트 요청이 어디로 이어지는지 확인

## 실행 방법

### 1. 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

필수 값은 Supabase 프로젝트와 실행 모드에 맞게 채웁니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PORT=1234
VITE_WS_URL=ws://127.0.0.1:1234
```

> `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. 프론트엔드에 노출하면 안 됩니다.

### 3. 개발 서버 실행

루트에서 한 번에 실행합니다.

```bash
pnpm dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:1234`

개별 실행도 가능합니다.

```bash
pnpm run dev:frontend
pnpm run dev:backend
```

## 배포 방법

권장 배포 구조는 **Supabase + Railway backend + Vercel frontend**입니다. Vercel은 Vite React 정적 프론트에 적합하고, SyncSpace 백엔드는 WebSocket을 유지해야 하므로 Railway 같은 장기 실행 Node 서비스에 배포합니다.

### 1. Supabase 준비

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 아래 순서로 실행합니다.

```sql
-- 1
supabase/schema.sql

-- 2
supabase/rls.sql

-- 3, 선택
supabase/seed.sql
```

3. Project Settings에서 아래 값을 복사합니다.
   - Project URL
   - anon public key
   - service_role key

`service_role key`는 Railway 백엔드에만 넣고, Vercel 프론트에는 절대 넣지 않습니다.

### 2. Railway backend 배포

GitHub repo `tmdry4530/SyncSpace`를 Railway에 연결합니다. 이 레포에는 `railway.json`이 있어서 build/start command는 자동으로 맞춰집니다.

Backend 환경 변수:

```env
NODE_ENV=production
HOST=0.0.0.0
ALLOWED_ORIGINS=https://your-frontend.vercel.app
WS_AUTH_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LOG_LEVEL=info
```

문서 Yjs snapshot을 재시작 후에도 보존하려면 Railway Volume을 `/data`에 붙이고 아래 값도 추가합니다.

```env
SYNCSPACE_DOC_PERSISTENCE_DIR=/data/ydocs
```

배포 후 backend URL의 `/health`가 JSON을 반환하면 정상입니다.

```txt
https://your-backend.up.railway.app/health
```

### 3. Vercel frontend 배포

GitHub repo `tmdry4530/SyncSpace`를 Vercel에 연결합니다. 이 레포에는 `vercel.json`이 있어서 Vite build와 SPA route rewrite가 적용됩니다.

Frontend 환경 변수:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-backend.up.railway.app
VITE_WS_URL=wss://your-backend.up.railway.app
VITE_WS_AUTH_MODE=supabase
```

Vercel에 `SUPABASE_SERVICE_ROLE_KEY`를 넣지 마세요. 프론트 번들에는 `VITE_` 값만 들어가야 합니다.

### 4. 배포 후 확인

1. Vercel URL 접속
2. 회원가입/로그인
3. 워크스페이스 생성
4. 채널 메시지 전송
5. 문서 편집
6. 다른 브라우저에서 같은 워크스페이스 접속
7. 채팅과 문서가 새로고침 없이 동기화되는지 확인

프론트 도메인을 바꾸면 Railway의 `ALLOWED_ORIGINS`도 새 도메인으로 바꾸고 백엔드를 재배포해야 합니다.

## 검증 명령

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm verify:all
```

공개 리포지토리에서는 테스트 스크립트와 테스트 결과를 제외하고, 타입체크와 빌드를 기준 검증으로 유지합니다.

## 발표에서 강조할 차별점

### 단순 UI 구현이 아니라 상태 설계를 보여준다

많은 React 포트폴리오가 CRUD 중심으로 끝나지만, SyncSpace는 세 종류의 상태를 분리해 실제 협업 앱에서 자주 만나는 복잡도를 다룹니다.

### 실시간 협업을 직접 다룬다

Yjs document room, chat room, awareness, WebSocket persistence adapter를 직접 구성했습니다. 새로고침 없이 다른 브라우저에 채팅과 문서 변경이 반영됩니다.

### 보안과 계약을 같이 고려했다

Supabase RLS, service role server-only 원칙, 공유 타입과 room naming 규칙을 기준으로 프론트와 백엔드 경계를 분리했습니다.

### 리뷰어가 이해하기 쉬운 화면 구조다

워크스페이스 화면은 채팅과 문서를 동시에 보여줍니다. 발표 중 “대화에서 결정하고 바로 문서화한다”는 제품 컨셉을 한 화면에서 설명할 수 있습니다.

## 품질 근거

공개 리포지토리 기준 검증 항목:

- TypeScript typecheck
- frontend production build
- backend typecheck/build
- Supabase schema/RLS 파일 유지

테스트 스크립트, 테스트 결과, QA 리포트, AI 작업 로그는 로컬 전용 자료로 관리합니다.

## 향후 개선 방향

- 문서 editor block drag handle
- 실제 checkbox/task-list node
- 문서 full-text search
- backlink graph
- markdown import/export
- SSR 또는 prerender 기반 Lighthouse Performance 개선
- Supabase Realtime publication 운영 환경 적용 자동화

## 라이선스

Portfolio project.
