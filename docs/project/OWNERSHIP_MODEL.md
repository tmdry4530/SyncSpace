# Ownership Model

## 원칙

이 프로젝트는 프론트엔드 학습/포트폴리오 프로젝트다. 따라서 React 핵심 코드는 AI가 대신 작성하면 안 된다.

AI가 구현해도 되는 영역과 사용자가 직접 구현해야 하는 영역을 파일 단위로 분리한다.

## 사용자가 직접 구현할 영역

### 1. React 앱 구조

직접 작성:

- `src/app/App.tsx`
- `src/app/router/*`
- `src/app/providers/*`
- `src/pages/**`

학습 목표:

- 라우팅 설계
- Protected Route
- Provider composition
- 페이지 단위 상태 흐름

### 2. Zustand Store

직접 작성:

- `src/shared/stores/authStore.ts`
- `src/shared/stores/workspaceUiStore.ts`
- `src/shared/stores/sidebarStore.ts`
- `src/shared/stores/chatUiStore.ts`
- `src/shared/stores/editorUiStore.ts`

학습 목표:

- 로컬 UI 상태와 서버 상태 분리
- persist middleware
- selector 기반 렌더링 최적화
- action 중심 store 설계

### 3. TanStack Query Hook

직접 작성:

- `src/features/workspace/queries/*`
- `src/features/channel/queries/*`
- `src/features/documents/queries/*`
- `src/features/chat/queries/*`

학습 목표:

- query key 설계
- enabled 조건
- optimistic update
- infinite query
- cache invalidation

### 4. Yjs / Realtime Hook

직접 작성:

- `src/features/realtime/useYDoc.ts`
- `src/features/realtime/useYProvider.ts`
- `src/features/realtime/useYAwareness.ts`
- `src/features/realtime/useConnectionStatus.ts`
- `src/features/chat/realtime/useYChatRoom.ts`
- `src/features/editor/realtime/useYEditorRoom.ts`

학습 목표:

- Y.Doc 생명주기
- WebsocketProvider 연결/해제
- awareness/presence
- React effect cleanup
- 실시간 상태와 서버 히스토리 상태 분리

### 5. 핵심 UI 컴포넌트

직접 작성:

- `src/features/workspace/components/WorkspaceShell.tsx`
- `src/features/workspace/components/Sidebar.tsx`
- `src/features/chat/components/ChatPanel.tsx`
- `src/features/chat/components/MessageList.tsx`
- `src/features/chat/components/MessageComposer.tsx`
- `src/features/editor/components/EditorPanel.tsx`
- `src/features/editor/components/EditorToolbar.tsx`
- `src/features/presence/components/PresenceBar.tsx`

학습 목표:

- container/presentational 분리
- loading/empty/error 상태
- controlled input
- scroll restoration
- responsive layout

## AI가 구현해도 되는 영역

### 1. Backend

AI 구현 허용:

- Supabase schema SQL
- RLS policy
- seed data
- Node.js WebSocket server
- y-websocket adapter
- chat persistence worker
- Railway/Vercel 설정
- backend tests
- backend README

### 2. Frontend 보조 영역

AI 구현 허용:

- Tailwind config
- ESLint/Prettier/Vitest/Playwright config
- shadcn/ui 또는 기본 UI primitive scaffold
- mock data fixture
- test boilerplate
- 타입 정의 초안
- 문서/README

단, AI가 사용자의 핵심 학습 파일을 직접 완성하면 안 된다.

## AI가 프론트에서 해도 되는 역할

허용:

- 개념 설명
- 코드 리뷰
- 버그 원인 분석
- 테스트 케이스 제안
- 타입 에러 설명
- 작은 코드 조각 예시 제공
- 사용자가 작성한 코드 개선안 제안

금지:

- 핵심 컴포넌트 전체 구현
- Zustand store 전체 구현
- Query hook 전체 구현
- Yjs hook 전체 구현
- 사용자가 이해하지 못한 채 붙여넣을 수 있는 대량 코드 생성
