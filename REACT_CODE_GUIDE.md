# React 코드 이해 가이드

이 프로젝트를 읽을 때는 컴포넌트를 무작정 위에서부터 보지 말고, **진입점 → 라우터 → 보호된 앱 영역 → 워크스페이스 화면 → 상태/데이터 훅 → 실시간 훅** 순서로 따라가면 이해하기 쉽습니다.

## 1. 앱이 처음 켜지는 흐름

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

## 2. 로그인 이후 앱 영역

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

## 3. 화면 구조를 이해하는 순서

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

## 4. 세 종류의 상태를 구분해서 보기

SyncSpace의 가장 중요한 React 학습 포인트는 상태 책임 분리입니다.

### Zustand: 로컬 UI 상태

볼 파일:

- `src/shared/stores/authStore.ts`: 로그인 세션과 사용자 프로필
- `src/shared/stores/workspaceUiStore.ts`: 현재 workspace/channel/document 선택 기억
- `src/shared/stores/sidebarStore.ts`: 사이드바 열림/접힘
- `src/shared/stores/presenceStore.ts`: presence UI 표시용 상태
- `src/shared/stores/chatUiStore.ts`, `src/shared/stores/editorUiStore.ts`: 패널 UI 상태

판단 기준: 서버에서 다시 받아와야 하는 데이터가 아니라 “지금 이 브라우저 화면의 선택/표시 상태”면 Zustand입니다.

### TanStack Query: 서버 상태

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

### Yjs: 실시간 협업 상태

볼 파일:

- `src/features/realtime/useYProvider.ts`: WebSocket provider 생성
- `src/features/realtime/useYDoc.ts`: Yjs document lifecycle
- `src/features/realtime/useYAwareness.ts`: 접속자 awareness
- `src/features/chat/realtime/useYChatRoom.ts`: 채팅 room 실시간 메시지
- `src/features/editor/realtime/useYEditorRoom.ts`: 문서 room 실시간 편집
- `src/features/realtime/useConnectionStatus.ts`: 연결 상태 표시

판단 기준: 여러 브라우저가 동시에 편집/전송하고 즉시 동기화되어야 하는 데이터면 Yjs입니다.

## 5. 데이터가 오가는 실제 흐름

### 워크스페이스 목록

```txt
WorkspacePage
  └─ useWorkspacesQuery
      └─ Supabase client
          └─ workspaces/memberships tables
```

### 채팅

```txt
ChatPanel
  ├─ useMessagesInfiniteQuery       # DB에 저장된 이전 메시지
  ├─ useYChatRoom                   # 지금 들어오는 실시간 메시지
  └─ MessageList / MessageComposer  # 화면 표시와 입력
```

`ChatPanel`은 서버 히스토리와 Yjs 실시간 메시지를 합친 뒤 중복을 제거해서 보여줍니다. 그래서 “저장된 메시지”와 “방금 들어온 메시지”가 같은 리스트처럼 보입니다.

### 문서 편집

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

## 6. API와 환경 변수 위치

볼 파일:

- `src/shared/api/supabaseClient.ts`: Supabase browser client 생성
- `src/shared/api/backendClient.ts`: 백엔드 REST 요청 공통 함수
- `src/shared/types/env.ts`: `VITE_` 환경 변수 읽기
- `.env.example`: 필요한 환경 변수 목록

프론트에서 사용할 수 있는 환경 변수는 `VITE_` 접두사가 붙은 값뿐입니다. `SUPABASE_SERVICE_ROLE_KEY`는 백엔드 전용이라 프론트 코드에서 읽으면 안 됩니다.

## 7. 백엔드와 연결해서 읽는 방법

프론트만 보다가 흐름이 끊기면 아래 백엔드 파일을 같이 보면 됩니다.

- `server/src/http/app.ts`: HTTP route 조립
- `server/src/routes/chatRoute.ts`: 채팅 메시지 저장/조회 API
- `server/src/routes/docRoute.ts`: 문서 관련 API
- `server/src/realtime/chatRoom.ts`: 채팅 Yjs room 처리
- `server/src/realtime/docRoom.ts`: 문서 Yjs room 처리
- `server/src/realtime/setupYWebsocket.ts`: WebSocket 서버 연결
- `server/src/persistence/supabaseAdmin.ts`: service role 기반 DB 접근

React 코드를 이해하는 목적이라면 백엔드는 “프론트 훅이 호출하는 대상” 정도로만 먼저 보고, 자세한 구현은 나중에 따라가도 됩니다.

## 8. 추천 학습 순서

1. `src/main.tsx` → `src/app/App.tsx` → `src/app/router/router.tsx`로 앱 진입 흐름 확인
2. `ProtectedAppRoute`와 `AppProviders`로 인증/provider 구조 확인
3. `WorkspacePage`에서 워크스페이스 목록이 어떻게 조회되는지 확인
4. `WorkspaceShell`에서 레이아웃과 `Outlet` 구조 확인
5. `WorkspaceSplitPage`에서 채팅/문서가 어떻게 동시에 배치되는지 확인
6. `ChatPanel`에서 Query 데이터와 Yjs 데이터가 합쳐지는 방식 확인
7. `EditorPanel`에서 Tiptap, slash command, presence가 어떻게 조립되는지 확인
8. `shared/stores/*`와 `features/*/queries/*`, `features/realtime/*`를 비교하며 상태 책임 분리 복습
9. 마지막으로 `server/src/*`와 `supabase/*.sql`을 보며 프론트 요청이 어디로 이어지는지 확인
