# Frontend Core Code Roadmap

## 직접 코딩할 핵심 순서

### 1. Router

목표:

- 앱의 이동 구조를 직접 이해한다.
- workspaceId/channelId/documentId route param을 다룬다.

구현 순서:

1. route constant 정의
2. public routes 정의
3. protected routes 정의
4. workspace nested layout 정의
5. NotFound 처리

체크 질문:

- route param은 어디에서 읽는가?
- 현재 선택 채널/문서는 URL이 source of truth인가, Zustand가 source of truth인가?
- 새로고침 시 어떻게 복원되는가?

권장 판단:

- URL이 source of truth다.
- Zustand는 마지막 선택값과 UI 편의를 위한 cache다.

### 2. Zustand Store

구현 순서:

1. store별 책임을 먼저 적는다.
2. state와 action을 분리한다.
3. 서버 데이터는 넣지 않는다.
4. 필요한 store만 persist한다.
5. unit test를 붙인다.

주의:

- `channels`, `documents`, `messages` 배열을 Zustand에 넣지 않는다.
- 이 데이터는 TanStack Query 책임이다.

### 3. Query Hooks

구현 순서:

1. API contract type 작성
2. query key factory 작성
3. list query 작성
4. create mutation 작성
5. optimistic update는 나중에 추가
6. invalidation 먼저 확실히 구현

체크 질문:

- workspaceId가 없을 때 query가 실행되는가?
- mutation 성공 후 어떤 query를 invalidate하는가?
- 같은 데이터를 두 군데 캐시에 중복 저장하지 않는가?

### 4. Workspace Shell

구현 순서:

1. 전체 2-column layout
2. sidebar
3. main panel outlet
4. loading skeleton
5. empty workspace state
6. mobile sidebar overlay

핵심:

- layout은 데이터 fetching을 최소화한다.
- 각 feature list는 자기 query hook을 가진다.

### 5. Chat UI

구현 순서:

1. 메시지 히스토리 렌더링
2. composer controlled input
3. submit handler
4. pending state
5. scroll-to-bottom
6. scroll restoration
7. 실시간 메시지 병합

주의:

- 메시지 히스토리 = TanStack Query
- 신규 실시간 메시지 = Yjs
- 렌더링 시 dedupe 필요

### 6. Yjs Chat

구현 순서:

1. roomName 생성
2. Y.Doc 생성
3. provider 연결
4. Y.Array 관찰
5. 메시지 append
6. cleanup
7. connection status 반환

핵심 질문:

- useEffect dependency가 정확한가?
- channelId가 바뀔 때 이전 provider가 destroy되는가?
- 같은 메시지가 히스토리와 실시간 스트림에 중복 표시되지 않는가?

### 7. Editor

구현 순서:

1. Tiptap 기본 editor
2. StarterKit
3. Placeholder
4. CodeBlock
5. Collaboration extension
6. CollaborationCursor
7. Toolbar command

주의:

- editor instance lifecycle이 중요하다.
- documentId 변경 시 Y.Doc/provider/editor 연결이 모두 바뀌어야 한다.

### 8. Presence

구현 순서:

1. awareness local state 설정
2. awareness change listener
3. online users array 변환
4. avatar stack UI
5. cleanup

주의:

- presence는 영속 저장 대상이 아니다.
- presence는 room별로 다르다.

## 핵심 구현 원칙

### 상태 책임 원칙

```txt
서버에서 다시 가져올 수 있는 데이터 = TanStack Query
화면 조작 편의 상태 = Zustand
다른 브라우저와 동기화되는 상태 = Yjs
```

### 컴포넌트 원칙

```txt
Page = route와 feature 조립
Feature container = 데이터 hook 호출
UI component = props 기반 렌더링
Store = UI state만
Query hook = 서버 state만
Yjs hook = realtime state만
```

### 학습 기준

각 파일을 작성한 뒤 아래를 기록한다.

```md
## 내가 작성한 이유
- 왜 이 상태를 여기에 뒀는가?
- 다른 선택지는 무엇이었는가?
- 어떤 edge case가 있는가?
- 테스트는 무엇이 필요한가?
```
