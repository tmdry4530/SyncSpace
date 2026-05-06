# SyncSpace 구현 이해 필수 정리

## 목적

이 문서는 SyncSpace 프로젝트를 발표하거나 면접에서 설명할 때 **반드시 알고 있어야 하는 구현 핵심**만 정리한 문서입니다.

목표는 단순 암기가 아니라, 아래 질문에 막히지 않는 것입니다.

```txt
이 프로젝트는 어떤 구조인가?
React에서는 어떤 방식으로 화면을 나눴나?
상태관리는 왜 이렇게 나눴나?
채팅은 어떻게 실시간으로 동작하나?
문서 공동 편집은 어떻게 동작하나?
Supabase와 WebSocket 서버는 각각 무슨 역할인가?
보안과 권한은 어디서 처리하나?
```

---

# 1. 프로젝트를 한 문장으로 설명하기

## 반드시 외울 문장

> SyncSpace는 채팅과 문서 편집을 한 화면에 통합한 React 기반 실시간 협업 앱이고, 로컬 UI 상태는 Zustand, 서버 상태는 TanStack Query, 실시간 협업 상태는 Yjs로 분리해 설계했습니다.

## 조금 더 긴 설명

SyncSpace는 Slack처럼 채널에서 대화하고, Notion처럼 문서를 같이 편집하는 흐름을 하나의 workbench에 합친 프로젝트입니다. React Router로 워크스페이스/채널/문서 URL을 구성하고, Supabase Auth와 RLS로 인증/권한을 처리합니다. 실시간 채팅과 문서 공동 편집은 Node.js WebSocket 서버와 Yjs room을 통해 동기화합니다.

---

# 2. 전체 구조를 반드시 이해해야 함

## 프론트 구조

```txt
src/
├─ app/          # App, Router, Providers
├─ pages/        # URL에 대응되는 페이지
├─ features/     # 기능별 모듈
└─ shared/       # 공통 API, store, type, util
```

## 백엔드 구조

```txt
server/src/
├─ auth/         # WebSocket 인증/멤버십 검증
├─ http/         # HTTP 서버, health, join API
├─ persistence/  # Supabase 저장 adapter
├─ realtime/     # Yjs WebSocket room, persistence hooks
├─ routes/       # REST route
├─ types/        # 백엔드 계약 타입
└─ utils/        # logger 등
```

## DB 구조

```txt
supabase/
├─ schema.sql    # 테이블, 인덱스, 트리거
├─ rls.sql       # Row Level Security 정책
└─ seed.sql      # 데모 데이터
```

## 발표용 표현

> Atomic Design 구조가 아니라 feature-based layered architecture입니다. 기능별로 `chat`, `editor`, `workspace`, `realtime`을 나누고, 여러 기능에서 공통으로 쓰는 코드는 `shared`에 둔 구조입니다.

---

# 3. Atomic Design이 아니라 Feature-based 구조임

## 반드시 알아야 할 차이

Atomic Design은 UI 크기 기준입니다.

```txt
atoms
molecules
organisms
templates
pages
```

SyncSpace는 기능 기준입니다.

```txt
features/chat
features/editor
features/workspace
features/realtime
features/presence
```

## 왜 이 구조를 썼는가

SyncSpace는 버튼, 카드 같은 UI 컴포넌트 모음이 아니라, 채팅/문서/워크스페이스/실시간 협업이라는 기능 도메인이 명확한 앱입니다.

따라서 기능별로 컴포넌트, hook, query, realtime 로직을 모아두는 것이 유지보수에 더 적합합니다.

## 예시

```txt
features/chat/
├─ components/
│  ├─ ChatPanel.tsx
│  ├─ MessageComposer.tsx
│  ├─ MessageItem.tsx
│  └─ MessageList.tsx
├─ hooks/
│  └─ useChatScrollRestoration.ts
├─ queries/
│  └─ useMessagesInfiniteQuery.ts
└─ realtime/
   └─ useYChatRoom.ts
```

채팅을 고치려면 `features/chat`을 보면 됩니다.

---

# 4. React에서 화면이 어떻게 조립되는지 알아야 함

## 엔트리 포인트

```txt
src/main.tsx
→ ReactDOM.createRoot
→ <React.StrictMode>
→ <App />
```

## App 구조

```txt
src/app/App.tsx
→ <RouterProvider router={router} />
```

## 라우터 구조

```txt
src/app/router/router.tsx
```

주요 경로:

```txt
/
/auth/login
/workspaces
/w/:workspaceId
/w/:workspaceId/ch/:channelId
/w/:workspaceId/doc/:documentId
/w/:workspaceId/ch/:channelId/doc/:documentId
```

## ProtectedRoute 흐름

```txt
ProtectedAppRoute
→ AppProviders
→ ProtectedRoute
→ Outlet
```

역할:

- 로그인 필요한 페이지 보호
- 세션 없으면 `/auth/login`으로 이동
- 세션 확인 중이면 로딩 표시

## 반드시 설명할 수 있어야 하는 것

> URL에 workspaceId, channelId, documentId를 담아서 새로고침하거나 링크를 공유해도 현재 작업 맥락을 복원할 수 있게 했습니다.

---

# 5. Provider 구조를 이해해야 함

## AppProviders 역할

```txt
src/app/providers/AppProviders.tsx
```

구성:

```txt
QueryProvider
→ AuthBootstrap
→ ServerRealtimeBridge
→ children
```

## QueryProvider

```txt
src/app/providers/QueryProvider.tsx
```

역할:

- TanStack Query의 QueryClient 제공
- 기본 query 옵션 설정
  - `retry: 1`
  - `refetchOnWindowFocus: false`

## AuthBootstrap

역할:

- Supabase session 확인
- auth store에 session/user 저장
- profile 생성 또는 조회
- auth state change subscription 등록
- cleanup에서 unsubscribe

## ServerRealtimeBridge

역할:

- Supabase Realtime 구독을 통해 workspace 목록 변경 감지
- 변경 시 TanStack Query cache invalidation

## 반드시 이해할 점

React에서 Provider는 단순 전역 wrapper가 아니라, 앱 전체에서 필요한 인증, query cache, realtime bridge를 초기화하는 진입점입니다.

---

# 6. 상태관리 3분할은 반드시 설명할 수 있어야 함

## 핵심 구조

```txt
Zustand
→ 로컬 UI 상태

TanStack Query
→ 서버 상태

Yjs
→ 실시간 협업 상태
```

이 프로젝트의 가장 중요한 설계입니다.

---

## 6-1. Zustand가 담당하는 것

파일:

```txt
src/shared/stores/
```

예시:

```txt
authStore.ts
workspaceUiStore.ts
sidebarStore.ts
chatUiStore.ts
editorUiStore.ts
presenceStore.ts
```

담당 상태:

```txt
사이드바 접힘 여부
현재 workspaceId/channelId/documentId
채팅 입력 draft
에디터 툴바 표시 여부
auth session/profile
presence UI 상태
```

## 왜 Zustand인가

- Redux보다 가볍다.
- Provider 없이 store를 바로 사용할 수 있다.
- selector로 필요한 값만 구독할 수 있다.
- persist middleware로 localStorage 저장이 쉽다.

## Recoil과 비교해서 말할 것

> Recoil은 atom/selector 기반이라 파생 상태에는 좋지만, 이 프로젝트의 로컬 UI 상태는 복잡한 atom graph보다 단순한 store 구조가 더 적합했습니다. 서버 상태는 Recoil selector보다 TanStack Query가 캐싱과 invalidation을 더 잘 담당합니다.

---

## 6-2. TanStack Query가 담당하는 것

파일:

```txt
src/features/**/queries/
```

예시:

```txt
useWorkspacesQuery.ts
useChannelsQuery.ts
useDocumentsQuery.ts
useMessagesInfiniteQuery.ts
useCreateWorkspaceMutation.ts
useCreateChannelMutation.ts
useCreateDocumentMutation.ts
```

담당 데이터:

```txt
워크스페이스 목록
채널 목록
문서 목록
메시지 히스토리
생성 mutation
초대 코드 참여 mutation
```

TanStack Query가 필요한 이유:

```txt
loading
error
cache
staleTime
refetch
retry
mutation 이후 invalidate
infinite query
```

## 반드시 설명할 수 있어야 하는 문장

> 서버에서 가져오는 데이터는 단순 useState로 관리하면 캐싱, 재요청, 에러 처리, mutation 후 갱신을 직접 구현해야 하기 때문에 TanStack Query를 사용했습니다.

---

## 6-3. Yjs가 담당하는 것

파일:

```txt
src/features/realtime/
src/features/chat/realtime/
src/features/editor/realtime/
```

담당 상태:

```txt
실시간 채팅 room 메시지
문서 공동 편집 내용
presence / awareness
WebSocket 연결 상태
```

왜 필요한가:

- 공동 문서 편집은 여러 사용자가 동시에 수정한다.
- 단순 WebSocket 이벤트로는 충돌 병합이 어렵다.
- Yjs는 CRDT 기반이라 동시 수정 병합에 적합하다.

## 반드시 설명할 수 있어야 하는 문장

> Supabase Realtime은 DB row 변경 감지용이고, Yjs는 문서와 채팅 room의 실시간 협업 상태를 동기화하기 위한 도구입니다. 두 실시간 시스템의 책임이 다릅니다.

---

# 7. 채팅 구현 흐름은 반드시 알아야 함

## 관련 파일

```txt
src/features/chat/components/ChatPanel.tsx
src/features/chat/components/MessageList.tsx
src/features/chat/components/MessageComposer.tsx
src/features/chat/queries/useMessagesInfiniteQuery.ts
src/features/chat/realtime/useYChatRoom.ts
server/src/realtime/chatRoom.ts
server/src/persistence/messagePersistence.ts
```

## 채팅 데이터 흐름

```txt
MessageComposer
→ onSend
→ useYChatRoom.sendMessage
→ Yjs Array(messages)에 push
→ 다른 클라이언트에 실시간 전파
→ server chat persistence hook
→ Supabase messages 테이블 저장
→ TanStack Query로 history refetch
→ history + realtime messages 병합
→ clientId 기준 dedupe
→ MessageList 렌더링
```

## 중요한 구현 포인트

### 1. 실시간 메시지는 Yjs에 먼저 들어감

사용자가 메시지를 보내면 DB 응답을 기다리지 않고 Yjs array에 push합니다.

장점:

- UI에 즉시 보인다.
- 실시간 room에 바로 전파된다.

### 2. DB 히스토리와 Yjs 메시지를 합침

`ChatPanel`에서:

```txt
DB history messages
+
Yjs realtime messages
→ uniqueBy(clientId 또는 id)
→ createdAt 기준 정렬
```

### 3. clientId가 중요한 이유

같은 메시지가 Yjs에도 있고 DB에도 있으면 중복 표시될 수 있습니다.

그래서 메시지 생성 시 `clientId`를 만들고, 병합 시 `clientId` 기준으로 중복 제거합니다.

## 면접에서 반드시 말할 것

> 채팅은 Yjs로 즉시 반영하고, 백엔드 persistence hook이 DB에 저장합니다. 이후 TanStack Query로 가져온 히스토리와 Yjs 실시간 메시지를 clientId 기준으로 dedupe해서 중복 표시를 막았습니다.

---

# 8. 문서 공동 편집 구현 흐름은 반드시 알아야 함

## 관련 파일

```txt
src/features/editor/components/EditorPanel.tsx
src/features/editor/hooks/useCollaborativeEditor.ts
src/features/editor/realtime/useYEditorRoom.ts
src/features/realtime/useYDoc.ts
src/features/realtime/useYProvider.ts
server/src/realtime/docPersistence.ts
```

## 문서 편집 흐름

```txt
EditorPanel
→ useYEditorRoom
→ useYDoc(roomName)
→ useYProvider(wsUrl, roomName, doc)
→ useCollaborativeEditor(ydoc)
→ Tiptap Collaboration extension에 ydoc 연결
→ EditorContent 렌더링
```

## Tiptap을 쓰는 이유

- ProseMirror 기반 rich text editor
- React hook인 `useEditor` 제공
- StarterKit으로 heading/list/code block 제공
- Collaboration extension으로 Yjs 연결 가능
- slash command, toolbar, document link, tag insight 확장 가능

## Yjs를 쓰는 이유

- 여러 사용자의 동시 편집 충돌을 병합할 수 있음
- 문서 상태를 CRDT로 관리
- awareness로 presence 표현 가능

## 문서 본문 저장 방식

```txt
documents 테이블
→ 문서 제목, workspaceId, createdBy, updatedAt 같은 메타데이터

Yjs snapshot
→ 실제 공동 편집 본문 상태
```

## 반드시 설명할 문장

> 문서 본문을 단순 DB row에 저장하면 동시 편집 충돌을 처리하기 어렵기 때문에, 메타데이터는 Supabase documents 테이블에 저장하고 실제 편집 상태는 Yjs document snapshot으로 관리했습니다.

---

# 9. 실시간 연결 공통 Hook을 이해해야 함

## useYDoc

파일:

```txt
src/features/realtime/useYDoc.ts
```

역할:

- roomName이 있으면 `new Y.Doc()` 생성
- roomName이 바뀌거나 unmount되면 destroy

## useYProvider

파일:

```txt
src/features/realtime/useYProvider.ts
```

역할:

- `WebsocketProvider` 생성
- Supabase auth token을 WebSocket protocol로 전달
- `disableBc: true`로 같은 브라우저 BroadcastChannel shortcut 비활성화
- `resyncInterval`로 재동기화
- cleanup에서 provider destroy

## useConnectionStatus

파일:

```txt
src/features/realtime/useConnectionStatus.ts
```

역할:

- provider의 내부 연결 상태를 React 상태로 변환
- `idle`, `connecting`, `connected`, `disconnected`로 표시

## useYAwareness

파일:

```txt
src/features/realtime/useYAwareness.ts
```

역할:

- Yjs awareness local state 설정
- 다른 사용자 presence 수집
- presenceStore에 반영

## 반드시 이해할 점

React 컴포넌트 안에 WebSocket 연결 로직을 직접 넣지 않고, custom hook으로 분리했습니다. 이게 React 구현에서 중요한 설계 포인트입니다.

---

# 10. Supabase 역할을 반드시 이해해야 함

## Supabase가 담당하는 것

```txt
Auth
Postgres DB
RLS
Realtime publication
```

## 주요 테이블

```txt
profiles
workspaces
workspace_members
channels
documents
messages
```

## RLS 핵심

```txt
워크스페이스 멤버만 해당 workspace 데이터 접근 가능
채널/문서/메시지도 workspace membership 기반으로 제한
```

## 프론트에서 Supabase 사용

파일:

```txt
src/shared/api/supabaseClient.ts
```

역할:

- `createClient`로 Supabase client 생성
- session persistence
- auto refresh token

## 반드시 설명할 문장

> Supabase anon key는 프론트에서 사용하지만, 실제 데이터 접근은 RLS 정책으로 제한됩니다. service role key는 RLS를 우회할 수 있으므로 서버 환경 변수로만 관리합니다.

---

# 11. WebSocket 백엔드 역할을 반드시 이해해야 함

## 관련 파일

```txt
server/src/http/app.ts
server/src/realtime/setupYWebsocket.ts
server/src/auth/realtimeAuth.ts
server/src/realtime/chatRoom.ts
server/src/realtime/docPersistence.ts
```

## 백엔드가 하는 일

```txt
HTTP health check
workspace join API
WebSocket upgrade 처리
origin 검증
access token 검증
workspace membership 검증
Yjs room 연결
chat message persistence
document snapshot persistence
```

## WebSocket 인증 흐름

```txt
Client
→ access token 포함해서 WebSocket 연결
→ server realtimeAuth
→ Supabase admin client로 user 확인
→ workspace_members에서 멤버십 확인
→ 통과하면 Yjs room 연결
```

## 반드시 설명할 문장

> 프론트의 RLS만 믿지 않고, WebSocket room 접속 시에도 access token과 workspace membership을 백엔드에서 다시 검증합니다.

---

# 12. Supabase Realtime과 Yjs의 차이를 반드시 알아야 함

## Supabase Realtime

사용 위치:

```txt
src/features/realtime/useServerStateRealtime.ts
```

담당:

```txt
workspaces 변경 감지
workspace_members 변경 감지
channels 변경 감지
documents 변경 감지
messages 변경 감지
→ TanStack Query invalidate
```

## Yjs realtime

담당:

```txt
문서 공동 편집
실시간 채팅 room
presence / awareness
```

## 차이점

| 구분 | Supabase Realtime | Yjs |
| --- | --- | --- |
| 대상 | DB row 변경 | 협업 room 상태 |
| 용도 | 목록/히스토리 갱신 | 동시 편집/실시간 room |
| source of truth | Postgres | Yjs Doc |
| 충돌 병합 | 직접 처리 필요 | CRDT로 처리 |

## 면접용 답변

> Supabase Realtime은 Postgres 변경 이벤트를 받아 TanStack Query cache를 갱신하는 용도이고, Yjs는 여러 사용자가 동시에 편집하는 문서와 실시간 room 상태를 동기화하는 용도입니다.

---

# 13. Tiptap 에디터 확장을 이해해야 함

## 관련 파일

```txt
src/features/editor/hooks/useCollaborativeEditor.ts
src/features/editor/components/EditorPanel.tsx
src/features/editor/components/EditorToolbar.tsx
src/features/editor/components/SlashCommandMenu.tsx
src/features/editor/components/EditorKnowledgeRail.tsx
src/features/editor/utils/editorInsights.ts
```

## 기본 에디터 구성

```txt
StarterKit.configure({ undoRedo: false })
Placeholder
Collaboration.configure({ document: ydoc })
```

## 왜 undoRedo를 false로 했는가

Tiptap StarterKit의 기본 undo/redo와 협업 extension의 undo/redo가 충돌할 수 있기 때문에 collaborative editing에서는 기본 undoRedo를 끄는 선택을 했습니다.

## 추가 기능

```txt
/editor toolbar
/slash command menu
heading outline
[[문서명]] 링크 후보
#태그 추출
word count
```

## 반드시 설명할 문장

> Tiptap은 rich text UI를 담당하고, Yjs는 공동 편집 상태를 담당합니다. Tiptap Collaboration extension이 두 영역을 연결합니다.

---

# 14. 환경 변수와 배포 구조를 알아야 함

## 주요 환경 변수

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WS_URL
VITE_API_URL
VITE_WS_AUTH_MODE

SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
WS_AUTH_MODE
ALLOWED_ORIGINS
PORT
```

## 프론트/백엔드 분리

```txt
Frontend
→ Vercel 정적 배포 가능
→ Vite SPA

Backend
→ Railway 같은 장기 실행 Node 서비스
→ WebSocket 유지 필요

Database/Auth
→ Supabase
```

## 반드시 설명할 문장

> 프론트는 정적 SPA로 배포할 수 있지만, WebSocket은 장기 연결이 필요하기 때문에 Node.js 백엔드를 별도 서비스로 배포합니다.

---

# 15. 보안에서 반드시 알아야 할 것

## 핵심 보안 포인트

```txt
Supabase RLS
service role key 서버 전용
WebSocket token 검증
workspace membership 검증
Origin 검증
CORS allowed origins
DB check constraints
```

## anon key와 service role key 차이

```txt
anon key
→ 프론트에서 사용 가능
→ RLS 정책 적용됨

service role key
→ 서버에서만 사용
→ RLS 우회 가능
→ 노출되면 위험
```

## WebSocket 보안

WebSocket은 DB query가 아니기 때문에 RLS만으로 보호되지 않습니다. 따라서 WebSocket upgrade 시 백엔드에서 별도로 token과 membership을 확인합니다.

## 반드시 설명할 문장

> DB 접근은 Supabase RLS로 제한하고, WebSocket room 접근은 백엔드 인증 로직으로 별도 제한합니다.

---

# 16. React 성능/렌더링 포인트를 알아야 함

## 적용된 것

```txt
React.lazy + Suspense
Zustand selector
TanStack Query cache
useMemo
useRef
effect cleanup
Vite manualChunks
```

## 설명 포인트

### route-level code splitting

라우트 페이지를 `React.lazy`로 불러옵니다.

장점:

- 초기 로딩에 모든 페이지 코드를 싣지 않음
- 로그인/워크스페이스/에디터 화면을 필요한 시점에 로드

### selector 기반 구독

Zustand store 전체를 구독하지 않고 필요한 값만 구독합니다.

### useMemo

메시지 병합, selected channel/document 계산처럼 파생 데이터 계산에 사용합니다.

### useRef

slash command 입력 시점처럼 렌더링을 유발할 필요 없는 transient 값을 관리합니다.

### cleanup

WebSocket, Supabase subscription, DOM event listener는 cleanup이 중요합니다.

## 반드시 설명할 문장

> React 성능 최적화는 무조건 memo를 남발한 것이 아니라, 상태 책임을 분리하고 필요한 값만 구독하게 만든 것이 핵심입니다.

---

# 17. 이 프로젝트에서 헷갈리면 안 되는 Source of Truth

## 데이터별 source of truth

| 데이터 | Source of truth |
| --- | --- |
| 워크스페이스 목록 | Supabase Postgres |
| 채널 목록 | Supabase Postgres |
| 문서 메타데이터 | Supabase Postgres |
| 메시지 히스토리 | Supabase Postgres |
| 실시간 채팅 room 현재 상태 | Yjs Doc |
| 문서 본문 | Yjs Doc / snapshot |
| 현재 선택한 채널/문서 | Zustand + URL param |
| 사이드바 접힘 | Zustand persist |
| 로그인 세션 | Supabase Auth + authStore |
| presence | Yjs awareness |

## 반드시 이해할 점

모든 데이터를 React state나 Zustand에 넣지 않습니다. 데이터마다 source of truth가 다릅니다.

---

# 18. 발표/면접에서 자주 나올 질문과 핵심 답변

## Q1. 이 프로젝트 아키텍처는 어떤 패턴인가요?

Atomic Design이 아니라 feature-based layered architecture입니다. 기능별로 `chat`, `editor`, `workspace`, `realtime`을 나누고, 공통 API/store/type/util은 `shared`에 둔 구조입니다.

## Q2. 왜 Zustand와 TanStack Query를 같이 썼나요?

Zustand는 로컬 UI 상태에 적합하고, TanStack Query는 서버 상태에 적합하기 때문입니다. UI 상태와 서버 상태는 생명주기와 필요한 기능이 다릅니다.

## Q3. Recoil과 비교하면 어떤 차이가 있나요?

Recoil은 atom/selector 기반이고, Zustand는 store/action 기반입니다. 이 프로젝트의 UI 상태는 단순한 store 구조가 더 적합했고, 서버 데이터는 TanStack Query가 더 적합했습니다.

## Q4. 왜 Yjs를 썼나요?

문서 공동 편집은 여러 사용자의 동시 수정 충돌을 처리해야 합니다. Yjs는 CRDT 기반으로 충돌 병합을 처리할 수 있어 단순 WebSocket보다 적합합니다.

## Q5. Supabase Realtime과 Yjs는 왜 둘 다 쓰나요?

Supabase Realtime은 DB row 변경 감지와 query invalidation 용도입니다. Yjs는 문서/채팅 room의 실시간 협업 상태 동기화 용도입니다.

## Q6. 채팅 메시지는 어떻게 중복을 막나요?

Yjs 실시간 메시지와 DB 히스토리 메시지를 합칠 때 `clientId` 또는 `id` 기준으로 dedupe합니다.

## Q7. 문서 내용은 어디에 저장되나요?

문서 메타데이터는 Supabase `documents` 테이블에 저장하고, 실제 공동 편집 본문은 Yjs document snapshot으로 저장합니다.

## Q8. WebSocket 권한은 어떻게 검증하나요?

클라이언트가 access token을 보내고, 백엔드가 Supabase admin client로 user를 확인한 뒤 `workspace_members` 테이블에서 해당 workspace 멤버인지 확인합니다.

## Q9. React에서 custom hook을 왜 많이 썼나요?

WebSocket 연결, Yjs provider, Supabase subscription, Tiptap editor 같은 side effect를 컴포넌트에서 분리해 재사용성과 cleanup 안정성을 높이기 위해서입니다.

## Q10. 가장 개선하고 싶은 점은 무엇인가요?

테스트 자동화입니다. Vitest로 순수 함수와 hook을 테스트하고, Playwright로 두 브라우저 간 채팅/문서 동기화 E2E 테스트를 추가하고 싶습니다.

---

# 19. 반드시 열어보고 설명할 수 있어야 하는 파일

## React 앱 시작점

```txt
src/main.tsx
src/app/App.tsx
```

## Router / Provider

```txt
src/app/router/router.tsx
src/app/router/ProtectedRoute.tsx
src/app/router/ProtectedAppRoute.tsx
src/app/providers/AppProviders.tsx
src/app/providers/QueryProvider.tsx
```

## Zustand

```txt
src/shared/stores/workspaceUiStore.ts
src/shared/stores/chatUiStore.ts
src/shared/stores/sidebarStore.ts
src/shared/stores/authStore.ts
```

## TanStack Query

```txt
src/features/workspace/queries/useWorkspacesQuery.ts
src/features/channel/queries/useChannelsQuery.ts
src/features/documents/queries/useDocumentsQuery.ts
src/features/chat/queries/useMessagesInfiniteQuery.ts
```

## Yjs / realtime

```txt
src/features/realtime/useYDoc.ts
src/features/realtime/useYProvider.ts
src/features/realtime/useYAwareness.ts
src/features/realtime/useConnectionStatus.ts
src/features/chat/realtime/useYChatRoom.ts
src/features/editor/realtime/useYEditorRoom.ts
```

## Tiptap editor

```txt
src/features/editor/hooks/useCollaborativeEditor.ts
src/features/editor/components/EditorPanel.tsx
src/features/editor/components/SlashCommandMenu.tsx
src/features/editor/utils/editorInsights.ts
```

## Backend

```txt
server/src/http/app.ts
server/src/realtime/setupYWebsocket.ts
server/src/auth/realtimeAuth.ts
server/src/realtime/chatRoom.ts
server/src/realtime/docPersistence.ts
```

## Supabase

```txt
supabase/schema.sql
supabase/rls.sql
```

---

# 20. 최종 암기용 요약

## 10초 요약

> SyncSpace는 React 기반 실시간 협업 앱이고, 상태를 Zustand, TanStack Query, Yjs로 나눠 관리한 것이 핵심입니다.

## 30초 요약

> SyncSpace는 채팅과 문서 편집을 한 화면에 통합한 React SPA입니다. 구조는 Atomic Design이 아니라 feature-based 구조이고, `chat`, `editor`, `workspace`, `realtime`처럼 기능별로 코드를 나눴습니다. 로컬 UI 상태는 Zustand, 서버 상태는 TanStack Query, 실시간 협업 상태는 Yjs가 담당합니다. Supabase는 Auth, Postgres, RLS를 맡고, Node.js WebSocket 서버는 Yjs room, 권한 검증, persistence를 담당합니다.

## 1분 요약

> SyncSpace는 채팅에서 논의한 내용을 같은 화면의 문서에 바로 정리할 수 있도록 만든 React 기반 실시간 협업 워크벤치입니다. React Router로 워크스페이스, 채널, 문서 URL을 구성하고, feature-based 구조로 채팅, 에디터, 워크스페이스, 실시간 로직을 분리했습니다. 상태관리는 성격별로 나눴습니다. 사이드바, 선택 ID, 입력 draft 같은 로컬 UI 상태는 Zustand가 담당하고, Supabase에서 가져오는 워크스페이스/채널/문서/메시지 히스토리는 TanStack Query가 담당합니다. 문서 공동 편집과 실시간 room 상태는 Yjs가 담당합니다. Supabase는 인증과 DB, RLS를 처리하고, Node.js WebSocket 서버는 Yjs room 연결, workspace membership 검증, 채팅 persistence, 문서 snapshot persistence를 처리합니다.

---

# 21. 이걸 모르면 위험한 부분

아래 내용은 발표 전에 반드시 다시 확인해야 합니다.

```txt
1. Atomic Design이 아니라 feature-based architecture라는 점
2. Zustand / TanStack Query / Yjs의 역할 차이
3. Supabase Realtime과 Yjs의 차이
4. 채팅 메시지가 Yjs → DB persistence → Query history와 dedupe되는 흐름
5. 문서 본문은 DB row가 아니라 Yjs snapshot이라는 점
6. WebSocket 접속도 workspace membership 검증을 한다는 점
7. React custom hook으로 side effect를 분리했다는 점
8. URL param과 Zustand가 현재 선택 상태를 함께 다룬다는 점
9. service role key는 서버 전용이라는 점
10. 테스트 개선 방향은 Vitest + Playwright라는 점
```
