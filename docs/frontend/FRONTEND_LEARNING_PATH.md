# Frontend Learning Path

## 목적

프론트엔드 핵심 코드를 직접 작성하면서 다음 역량을 증명한다.

1. React 컴포넌트 설계
2. Zustand 로컬 상태 관리
3. TanStack Query 서버 상태 관리
4. Yjs 실시간 상태 관리
5. Tiptap 에디터 연동
6. 실시간 협업 UX
7. 테스트 가능한 구조

## Stage 0 — 프로젝트 구조 이해

직접 할 일:

- PRD 읽기
- 라우팅 목록 정리
- 주요 화면과 상태 책임 매핑
- `src/` 폴더 구조 생성

체크포인트:

- 각 feature가 어떤 상태 레이어를 쓰는지 말로 설명 가능해야 한다.

## Stage 1 — App Shell 직접 구현

구현 파일:

- `src/app/App.tsx`
- `src/app/router/router.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/pages/workspace/WorkspacePage.tsx`

핵심 개념:

- BrowserRouter 또는 createBrowserRouter
- Protected route
- QueryClientProvider
- Zustand는 provider가 필요 없다는 점
- Supabase auth listener 위치

직접 구현 목표:

- `/`
- `/auth/login`
- `/workspaces`
- `/w/:workspaceId/ch/:channelId`
- `/w/:workspaceId/doc/:docId`

검증:

- URL 이동이 정상 동작
- 없는 경로는 NotFound
- 로그인 필요 페이지는 guard 처리

## Stage 2 — Zustand Stores 직접 구현

구현 파일:

- `authStore.ts`
- `workspaceUiStore.ts`
- `sidebarStore.ts`
- `chatUiStore.ts`
- `editorUiStore.ts`

핵심 개념:

- 서버에서 가져오는 데이터는 store에 저장하지 않는다.
- store에는 UI 선택값과 임시 상태만 저장한다.
- persist는 마지막 선택 채널/문서, 사이드바 상태, 스크롤 위치에만 쓴다.

권장 store shape:

```ts
interface WorkspaceUiState {
  currentWorkspaceId: string | null;
  currentChannelId: string | null;
  currentDocumentId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentChannelId: (id: string | null) => void;
  setCurrentDocumentId: (id: string | null) => void;
}
```

검증:

- store 단위 테스트
- selector 사용
- 새로고침 후 필요한 상태만 복원

## Stage 3 — TanStack Query 직접 구현

구현 파일:

- `useWorkspacesQuery.ts`
- `useChannelsQuery.ts`
- `useDocumentsQuery.ts`
- `useMessagesInfiniteQuery.ts`
- `useCreateChannelMutation.ts`
- `useCreateDocumentMutation.ts`

핵심 개념:

- query key factory
- enabled 조건
- staleTime/cacheTime/gcTime
- optimistic update
- invalidation
- infinite query pageParam

Query key 예시:

```ts
export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (workspaceId: string) => ['workspaces', workspaceId] as const,
  channels: (workspaceId: string) => ['workspaces', workspaceId, 'channels'] as const,
  documents: (workspaceId: string) => ['workspaces', workspaceId, 'documents'] as const,
};
```

검증:

- 로딩/에러/빈 상태 UI와 연결
- workspace 변경 시 query가 새로 동작
- 메시지 히스토리 무한스크롤 동작

## Stage 4 — Workspace Layout 직접 구현

구현 파일:

- `WorkspaceShell.tsx`
- `Sidebar.tsx`
- `ChannelList.tsx`
- `DocumentList.tsx`
- `WorkspaceHeader.tsx`

핵심 개념:

- layout composition
- 현재 route와 선택 상태 동기화
- skeleton/empty/error state
- responsive sidebar

검증:

- 채널 클릭 시 채팅 화면 이동
- 문서 클릭 시 문서 화면 이동
- 사이드바 토글 상태 유지

## Stage 5 — Chat UI 직접 구현

구현 파일:

- `ChatPanel.tsx`
- `MessageList.tsx`
- `MessageItem.tsx`
- `MessageComposer.tsx`
- `useChatScrollRestoration.ts`

핵심 개념:

- controlled input
- optimistic UI
- scroll-to-bottom 조건
- 이전 메시지 히스토리와 신규 실시간 메시지 병합
- pending/error message state

검증:

- 메시지 입력/전송 UI
- 빈 채널 상태
- 스크롤 위치 복원
- 중복 메시지 방지

## Stage 6 — Yjs Chat Room 직접 구현

구현 파일:

- `useYChatRoom.ts`
- `useConnectionStatus.ts`

핵심 개념:

- Y.Doc 생성과 cleanup
- roomName 규칙
- Y.Array 메시지 스트림
- provider status event
- Supabase 히스토리와 Yjs 신규 메시지의 경계

검증:

- 같은 채널 2개 브라우저에서 실시간 반영
- 채널 변경 시 이전 room cleanup
- offline 상태 UI 표시

## Stage 7 — Tiptap Editor 직접 구현

구현 파일:

- `EditorPanel.tsx`
- `EditorToolbar.tsx`
- `useYEditorRoom.ts`
- `useCollaborativeEditor.ts`

핵심 개념:

- Tiptap extension
- Collaboration extension
- CollaborationCursor
- Y.Doc binding
- editor lifecycle

검증:

- 텍스트/제목/코드블록 입력
- 두 브라우저 동시 편집
- 커서 표시
- 문서 전환 시 editor destroy/recreate 안정성

## Stage 8 — Presence UI 직접 구현

구현 파일:

- `useYAwareness.ts`
- `PresenceBar.tsx`
- `UserAvatarStack.tsx`

핵심 개념:

- awareness local state
- awareness change listener
- online users array 변환
- avatar stack UI
- cleanup

검증:

- 접속자 표시
- 탭 종료 시 presence 제거
- 채팅/문서 room별 presence 다르게 표시

## Stage 9 — 테스트 직접 보강

직접 작성:

- Zustand store unit test
- query hook test
- 핵심 컴포넌트 test
- Playwright smoke test

AI에게 맡길 수 있는 것:

- 테스트 boilerplate 생성
- 실패 원인 분석
- coverage gap 제안

## 완료 기준

다음 질문에 답할 수 있어야 한다.

1. 왜 Zustand에 서버 데이터를 넣지 않았는가?
2. 왜 메시지 히스토리는 TanStack Query고 신규 메시지는 Yjs인가?
3. Y.Doc은 언제 생성되고 언제 destroy되는가?
4. 채팅과 문서 전환 시 어떤 상태가 보존되는가?
5. Presence는 문서 내용과 왜 분리해야 하는가?
6. Query key를 어떻게 설계했는가?
7. 실시간 상태와 persisted DB 상태의 경계는 어디인가?
