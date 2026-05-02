# SyncSpace 현재 API 및 화면 구성 보고서

작성일: 2026-05-02  
대상 범위: 현재 로컬 코드 기준의 API 계약, Supabase DB/RLS, Realtime 구조, React 화면 구성

## 1. 요약

SyncSpace는 현재 **Supabase 서버 상태 + Node WebSocket/Yjs 실시간 협업 + React split workbench UI** 구조로 구현되어 있다.

핵심 방향은 다음과 같다.

- 사용자는 워크스페이스에 진입하면 한 화면에서 **채팅과 문서 편집을 동시에** 사용한다.
- 워크스페이스/채널/문서/메시지 목록은 Supabase 테이블을 TanStack Query로 조회한다.
- 목록성 서버 상태는 Supabase Realtime invalidate와 1.5초 polling fallback으로 새로고침 없이 갱신한다.
- 채팅 실시간 본문과 문서 본문 편집은 Node WebSocket 서버의 Yjs room으로 동기화한다.
- Supabase service-role key는 Node 서버에서만 사용하고 프론트에는 노출하지 않는다.

## 2. 상태 계층 구조

| 상태 종류 | 담당 기술 | 현재 사용처 |
| --- | --- | --- |
| 로컬 UI 상태 | Zustand | 현재 워크스페이스/채널/문서 선택, 사이드바 접힘, 채팅 draft, 에디터 UI 상태 |
| 서버 상태 | TanStack Query + Supabase | 워크스페이스 목록, 채널 목록, 문서 메타데이터, persisted 메시지 목록 |
| 실시간 협업 상태 | Yjs + y-websocket | 채팅 optimistic realtime array, Tiptap 문서 편집, awareness/presence |
| 실시간 서버 상태 갱신 | Supabase Realtime + polling fallback | 다른 브라우저의 채널/문서/메시지 생성 반영 |

## 3. Supabase DB 구성

스키마 파일: `supabase/schema.sql`  
RLS 파일: `supabase/rls.sql`

### 3.1 테이블

| 테이블 | 역할 | 주요 컬럼/제약 |
| --- | --- | --- |
| `profiles` | 사용자 공개 프로필 | `id`, `display_name`, `avatar_url`, `color`; auth.users와 1:1 |
| `workspaces` | 워크스페이스 메타데이터 | `id`, `name`, `owner_id`, `invite_code`, `created_at` |
| `workspace_members` | 워크스페이스 멤버십 | `(workspace_id, user_id)` PK, `role: owner/member` |
| `channels` | 워크스페이스별 채팅 채널 | `workspace_id`, `name`, `created_by`; `(workspace_id, name)` unique |
| `documents` | 워크스페이스별 문서 메타데이터 | `workspace_id`, `title`, `created_by`, `updated_at` |
| `messages` | 영속화된 채팅 메시지 | `channel_id`, `user_id`, `content`, `client_id`, `created_at` |

### 3.2 주요 인덱스

- `workspace_members(user_id)`
- `channels(workspace_id)`
- `documents(workspace_id, updated_at desc)`
- `messages(channel_id, created_at desc, id desc)`
- `messages(channel_id, client_id)` unique partial index: `client_id is not null`

### 3.3 트리거/함수

| 함수/트리거 | 역할 |
| --- | --- |
| `set_updated_at()` | `profiles`, `documents` update 시 `updated_at` 갱신 |
| `add_workspace_owner_member()` | 워크스페이스 생성 시 owner membership 자동 생성 |
| `is_workspace_member()` | RLS에서 워크스페이스 멤버 확인 |
| `is_workspace_owner()` | RLS에서 owner 권한 확인 |
| `is_workspace_record_owner()` | self-owner insert 보조 |
| `can_access_channel()` | 메시지 접근 가능한 채널인지 확인 |
| `handle_new_user_profile()` | auth user 생성 시 profile 자동 생성 |

### 3.4 Supabase Realtime publication

`schema.sql`에서 다음 테이블을 `supabase_realtime` publication에 등록하도록 구성되어 있다.

- `workspaces`
- `workspace_members`
- `channels`
- `documents`
- `messages`

목적은 프론트의 TanStack Query cache를 즉시 invalidate하기 위함이다. publication이 적용되지 않은 환경에서도 1.5초 polling fallback으로 새로고침 없이 갱신된다.

## 4. RLS 정책 요약

| 테이블 | select | insert | update/delete |
| --- | --- | --- | --- |
| `profiles` | 자기 자신 또는 같은 워크스페이스 구성원 | 자기 profile | 자기 profile |
| `workspaces` | owner 또는 member | `owner_id = auth.uid()` | owner만 |
| `workspace_members` | 같은 워크스페이스 member | owner 또는 생성자 self-owner | owner 또는 자기 탈퇴 |
| `channels` | 워크스페이스 member | member 본인 생성 | owner만 |
| `documents` | 워크스페이스 member | member 본인 생성 | update는 member, delete는 owner |
| `messages` | 채널 접근 가능한 member | 본인 메시지 + 채널 접근 가능 | 본인 또는 workspace owner |

## 5. HTTP API 구성

Node 서버 파일: `server/src/http/app.ts`

### 5.1 서버 기본값

| 항목 | 값 |
| --- | --- |
| 기본 host | `0.0.0.0` |
| 기본 port | `1234` |
| 기본 frontend dev origin | `http://127.0.0.1:5173`, `http://localhost:5173` 등 |
| auth mode | `WS_AUTH_MODE=off | supabase` |

### 5.2 엔드포인트

| Method | Path | 인증 | 역할 |
| --- | --- | --- | --- |
| `GET` | `/health` | 없음 | 서버 상태와 realtime room 통계 반환 |
| `GET` | `/ready` | 없음 | readiness probe |
| `POST` | `/api/workspaces/join` | `Authorization: Bearer <Supabase access token>` | 초대 코드로 워크스페이스 참여 |
| `OPTIONS` | 모든 HTTP route | 없음 | CORS preflight |

### 5.3 `POST /api/workspaces/join`

프론트가 service-role key를 가지면 안 되므로 초대 코드 참여만 Node 서버가 service role로 처리한다.

```http
POST /api/workspaces/join
Authorization: Bearer <supabase access token>
Content-Type: application/json
```

요청:

```json
{ "inviteCode": "0FC143F8EA" }
```

성공 응답:

```json
{ "workspace": { "id": "...", "name": "...", "ownerId": "...", "inviteCode": "...", "createdAt": "..." } }
```

에러 응답은 공통 `AppError` shape를 따른다.

```ts
interface AppError {
  code: string
  message: string
  details?: unknown
}
```

## 6. Supabase 직접 Query API

프론트의 CRUD 대부분은 Supabase anon client + RLS로 직접 수행한다.

| 함수 | 위치 | 역할 |
| --- | --- | --- |
| `listMyWorkspaces()` | `useWorkspacesQuery.ts` | 내가 속한 워크스페이스 조회 |
| `createWorkspace()` | `useCreateWorkspaceMutation.ts` | 워크스페이스 생성 |
| `joinWorkspaceByInviteCode()` | `useJoinWorkspaceMutation.ts` | Node backend join API 호출 |
| `listChannels(workspaceId)` | `useChannelsQuery.ts` | 채널 목록 조회 |
| `createChannel()` | `useCreateChannelMutation.ts` | 채널 생성 |
| `listDocuments(workspaceId)` | `useDocumentsQuery.ts` | 문서 메타 목록 조회 |
| `createDocument()` | `useCreateDocumentMutation.ts` | 문서 메타 생성 |
| `listMessages(channelId, cursor, limit)` | `useMessagesInfiniteQuery.ts` | persisted 메시지 페이지네이션 조회 |

### 6.1 Query cache 갱신 전략

- `workspaces`, `channels`, `documents`, `messages`: `refetchInterval: 1500ms`
- Supabase Realtime 구독으로 DB change 발생 시 관련 query invalidate
- 생성 mutation 성공 시 자기 탭의 TanStack Query cache 즉시 `setQueryData`

관련 파일:

- `src/features/realtime/useServerStateRealtime.ts`
- `src/features/realtime/queryPolling.ts`

## 7. WebSocket / Yjs Realtime API

Node WebSocket 서버 파일: `server/src/realtime/setupYWebsocket.ts`

### 7.1 WebSocket endpoint

| 용도 | URL |
| --- | --- |
| 문서 협업 | `ws://<server>/doc/:workspaceId/:documentId` |
| 채팅 협업 | `ws://<server>/chat/:workspaceId/:channelId` |

프론트는 y-websocket provider 특성상 실제 접속 URL 끝에 room name이 append된다.

예시:

```txt
ws://localhost:1234/chat/<workspaceId>/<channelId>/chat:<workspaceId>:<channelId>
ws://localhost:1234/doc/<workspaceId>/<documentId>/doc:<workspaceId>:<documentId>
```

### 7.2 Room naming

```ts
chatRoom = `chat:${workspaceId}:${channelId}`
docRoom = `doc:${workspaceId}:${documentId}`
```

### 7.3 WebSocket 인증

`WS_AUTH_MODE=supabase`일 때:

- 브라우저가 Supabase access token을 `Sec-WebSocket-Protocol: bearer, <token>` 형식으로 전달
- Node 서버가 token으로 user를 확인
- `workspace_members`에서 해당 workspace membership 확인
- service-role key는 서버 전용

### 7.4 Yjs persistence

| 대상 | 저장 방식 |
| --- | --- |
| 채팅 Yjs 메시지 array | 서버가 Yjs `messages` array를 observe 후 `public.messages`에 insert |
| 문서 Yjs 상태 | 서버 로컬 `.syncspace-data/ydocs` snapshot 저장 |
| presence/awareness | y-websocket awareness relay; 영속 저장 없음 |

## 8. 현재 화면 구성

### 8.1 라우팅

라우터 파일: `src/app/router/router.tsx`  
route helper: `src/app/router/routes.ts`

| Route | 화면 | 설명 |
| --- | --- | --- |
| `/` | `HomePage` | 랜딩/소개 |
| `/auth/login` | `LoginPage` | 로그인/회원가입 |
| `/api-contract` | `ContractPage` | API 계약 설명 화면 |
| `/workspaces` | `WorkspacePage` | 내 워크스페이스 목록, 생성, 초대코드 참여 |
| `/w/:workspaceId` | `WorkspaceShell` + `WorkspaceSplitPage` | 기본 split workbench |
| `/w/:workspaceId/ch/:channelId` | `WorkspaceSplitPage` | 특정 채널 선택 + 문서는 기존/첫 문서 유지 |
| `/w/:workspaceId/doc/:documentId` | `WorkspaceSplitPage` | 특정 문서 선택 + 채널은 기존/첫 채널 유지 |
| `/w/:workspaceId/ch/:channelId/doc/:documentId` | `WorkspaceSplitPage` | 채널+문서 조합 선택 |
| `*` | `NotFoundPage` | 404 |

참고: `ChannelPage`, `DocumentPage`, `WorkspaceOverviewPage` 파일은 남아 있지만 현재 router에서는 split workbench가 메인으로 사용된다.

### 8.2 워크스페이스 화면 레이아웃

현재 워크스페이스 화면은 전체화면 기준으로 다음 구조다.

```txt
┌──────────────────────────────────────────────────────────────┐
│ Sidebar │ Header: workspace name / invite copy / account     │
│         ├────────────────────────────────────────────────────┤
│         │ Workspace presence bar                             │
│         ├────────────────────────────────────────────────────┤
│         │ DUAL MODE WORKBENCH            unified connected   │
│         ├────────────────────────────┬───────────────────────┤
│         │ ChatPanel                  │ EditorPanel           │
│         │ - selected channel         │ - selected document   │
│         │ - messages                 │ - toolbar             │
│         │ - composer                 │ - Tiptap editor       │
└─────────┴────────────────────────────┴───────────────────────┘
```

### 8.3 주요 컴포넌트

| 컴포넌트 | 위치 | 역할 |
| --- | --- | --- |
| `WorkspaceShell` | `features/workspace/components` | 워크스페이스 접근 권한 확인, shell layout, sidebar/header/presence 배치 |
| `Sidebar` | `features/workspace/components` | 채널/문서 목록, 채널/문서 생성 form |
| `WorkspaceHeader` | `features/workspace/components` | 워크스페이스명, 초대코드 복사, 사용자 chip, 목록/로그아웃 |
| `WorkspaceSplitPage` | `pages/workspace` | 채팅/문서 동시 workbench, 채널/문서 선택 조합 유지 |
| `ChatPanel` | `features/chat/components` | 채팅 메시지 목록 + 입력기 + Yjs chat room |
| `EditorPanel` | `features/editor/components` | Tiptap editor + Yjs doc room + document presence |
| `PresenceBar` | `features/presence/components` | awareness 기반 접속자 표시 |

### 8.4 채널/문서 선택 동작

- Zustand store `workspaceUiStore`가 현재 선택된 `currentChannelId`, `currentDocumentId`를 보관한다.
- 채널 클릭 시 현재 문서 선택을 유지한 채 `/w/:workspaceId/ch/:channelId/doc/:documentId`로 이동한다.
- 문서 클릭 시 현재 채널 선택을 유지한 채 같은 combined route로 이동한다.
- URL에 한쪽만 있으면 나머지 한쪽은 기억된 값 또는 첫 번째 항목으로 자동 선택한다.

### 8.5 연결 상태 표시

- 이전에는 채팅 패널과 문서 패널 각각 `connected` 배지가 있었다.
- 현재는 split workbench 상단에 단일 realtime 상태 배지만 표시한다.
- 병합 규칙:
  - 하나라도 `disconnected` → `disconnected`
  - 하나라도 `connecting` 또는 `idle` → `connecting`
  - 모두 정상 → `connected`

## 9. 초대코드 기능 상태

현재 `WorkspaceHeader`에서 초대코드 복사 버튼을 제공한다.

- 버튼 라벨: `초대코드 <code> 복사`
- 클릭 성공 시: `복사됨`
- Clipboard API 실패 시 임시 textarea fallback 사용
- 초대코드 참여는 `/workspaces` 화면에서 입력 후 `POST /api/workspaces/join` 호출

## 10. 환경변수 계약

### 10.1 프론트 공개 변수

| 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_WS_URL` | Node WebSocket server base URL, 예: `ws://localhost:1234` |
| `VITE_WS_AUTH_MODE` | `off` 또는 `supabase` |
| `VITE_API_URL` | Node HTTP API base URL. 없으면 `VITE_WS_URL`에서 HTTP URL로 변환 |

### 10.2 서버 전용 변수

| 변수 | 설명 |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 service-role key |
| `WS_AUTH_MODE` | `off` 또는 `supabase` |
| `ALLOWED_ORIGINS` | CORS/WebSocket origin allowlist |
| `PORT` | backend port, 기본 `1234` |
| `HOST` | backend host, 기본 `0.0.0.0` |
| `SYNCSPACE_DOC_PERSISTENCE_DIR` | Yjs 문서 snapshot 저장 위치 |

## 11. 현재 검증 상태

최근 확인된 검증 항목:

- `pnpm typecheck` 통과
- `pnpm verify:frontend` 통과
- `pnpm --filter server test` 통과: 7 files / 25 tests
- 브라우저 확인:
  - split workbench에서 채팅/문서 동시 표시
  - 채널 선택 시 문서 선택 유지
  - 문서 선택 시 채널 선택 유지
  - 초대코드 복사 버튼 상태 변경
  - `connected` 배지 단일 표시
  - 새 채널/새 문서/새 메시지/문서 편집이 다른 브라우저에 새로고침 없이 반영

## 12. 현재 한계 및 후속 개선 제안

| 영역 | 현재 상태 | 후속 제안 |
| --- | --- | --- |
| 번들 크기 | Tiptap/Yjs 포함 JS chunk가 500kB 초과 경고 | editor route 또는 Tiptap extension lazy loading |
| 문서 persistence | Node 서버 로컬 snapshot 파일 기반 | 운영 배포 시 durable storage 또는 Supabase Storage/DB 기반 persistence 검토 |
| 서버 상태 realtime | Supabase Realtime + polling fallback | 운영 DB에 `schema.sql` publication 적용 확인 후 polling 간격 조정 가능 |
| 삭제/이름 변경 UI | 현재 생성 중심 | 채널/문서 rename/delete, 권한 UI 추가 가능 |
| 테스트 | backend test 있음, frontend automated test 부족 | React component test 또는 Playwright e2e 추가 |
| 접근성 | 기본 label/aria 일부 적용 | keyboard navigation/focus order/a11y audit 보강 |

## 13. 결론

현재 SyncSpace는 기존 Slack/Notion식 단일 패널 전환 구조에서 벗어나, **채팅과 문서 협업을 동시에 수행하는 split workbench** 형태로 정리되었다. API 측면에서는 Supabase RLS 기반 직접 Query와 Node WebSocket/Yjs 서버가 역할을 분리하며, 초대코드 참여처럼 service-role이 필요한 작업만 backend HTTP API로 제한되어 있다.

다음 단계는 UI 완성도를 높이는 세부 인터랙션, frontend 테스트, 운영용 문서 persistence 전략 보강이다.
