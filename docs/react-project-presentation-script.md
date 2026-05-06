# SyncSpace React 프로젝트 발표 대본

## 발표 제목

**SyncSpace: React 기반 실시간 협업 워크벤치**

## 발표 한 줄 요약

> SyncSpace는 채팅과 문서 편집을 한 화면에 통합하고, Zustand, TanStack Query, Yjs로 상태 책임을 분리한 React 실시간 협업 앱입니다.

## React 중심 보강 포인트

발표에서 React 역량을 강조하려면 아래 흐름을 반복해서 연결합니다.

```txt
React 컴포넌트 구조
→ Router로 화면 상태를 URL에 연결
→ Provider로 앱 공통 환경 구성
→ Custom Hook으로 비동기/실시간 side effect 분리
→ Zustand / TanStack Query / Yjs로 React 상태 책임 분리
→ lazy / Suspense / selector / memo로 렌더링 비용 관리
```

핵심 메시지는 다음입니다.

> 이 프로젝트는 React를 단순 화면 렌더링 도구로만 쓴 것이 아니라, 라우팅, Provider composition, custom hook, 상태 책임 분리, 렌더링 최적화를 통해 실시간 협업 UI를 구조화한 프로젝트입니다.

## 추천 발표 시간

- 짧은 발표: 5분
- 일반 발표: 10~12분
- 기술 면접형 발표: 12~15분

이 문서는 **React 중심 10~12분 발표**를 기준으로 보강했습니다.

---

# 1. 오프닝

## 슬라이드 1. 프로젝트 소개

### 화면에 보여줄 내용

```txt
SyncSpace
채팅으로 결정하고, 같은 화면의 문서에 바로 정리하는 실시간 협업 워크벤치
```

### 발표 대본

안녕하세요. 제가 소개할 프로젝트는 **SyncSpace**입니다.

SyncSpace는 팀이 채팅에서 논의한 내용을 바로 같은 화면의 문서에 정리할 수 있도록 만든 **React 기반 실시간 협업 웹 애플리케이션**입니다.

일반적인 협업 환경에서는 Slack 같은 채팅 도구와 Notion 같은 문서 도구를 따로 사용합니다. 그러다 보면 대화에서 나온 결정사항이 문서로 옮겨지지 않거나, 문서를 보면서 다시 채팅으로 돌아가야 하는 흐름이 생깁니다.

SyncSpace는 이 문제를 해결하기 위해 **왼쪽에는 채팅, 오른쪽에는 공동 문서 편집 화면**을 배치했습니다. 사용자는 대화하면서 동시에 문서를 작성할 수 있고, 다른 사용자의 접속 상태와 편집 상태도 실시간으로 확인할 수 있습니다.

---

# 2. 문제 정의와 핵심 목표

## 슬라이드 2. 왜 만들었는가

### 화면에 보여줄 내용

```txt
문제
- 채팅과 문서가 분리되어 결정사항이 흩어짐
- 실시간 협업 상태 관리가 복잡함
- 서버 상태, UI 상태, 협업 상태가 섞이기 쉬움

목표
- 채팅 + 문서 편집을 한 화면에 통합
- 실시간 협업 경험 구현
- React 상태 책임을 명확히 분리
```

### 발표 대본

이 프로젝트에서 해결하고 싶었던 문제는 크게 두 가지였습니다.

첫 번째는 사용자 경험 측면입니다. 협업을 하다 보면 채팅에서 결정하고, 그 내용을 다시 문서 도구에 옮겨야 합니다. 저는 이 흐름을 하나의 화면 안에서 연결하고 싶었습니다.

두 번째는 프론트엔드 아키텍처 측면입니다. 실시간 협업 앱은 상태 종류가 굉장히 많습니다. 예를 들어 사이드바가 열려 있는지 같은 UI 상태도 있고, Supabase에서 가져온 워크스페이스 목록 같은 서버 상태도 있고, 여러 사용자가 동시에 편집하는 문서 상태도 있습니다.

이 상태들을 하나의 전역 store에 다 넣으면 유지보수가 어려워집니다. 그래서 이 프로젝트의 핵심 목표는 **상태의 성격에 따라 책임을 분리하는 것**이었습니다.

---

# 3. 데모 흐름 소개

## 슬라이드 3. 주요 기능

### 화면에 보여줄 내용

```txt
주요 기능
1. 로그인 / 회원가입
2. 워크스페이스 생성 및 초대 코드 참여
3. 채널 기반 실시간 채팅
4. Tiptap 기반 공동 문서 편집
5. Presence 표시
6. 슬래시 명령, 문서 링크, 태그 인사이트
```

### 발표 대본

주요 기능은 다음과 같습니다.

먼저 Supabase Auth를 이용해 로그인과 회원가입을 처리합니다. 로그인한 사용자는 워크스페이스를 생성하거나 초대 코드로 다른 워크스페이스에 참여할 수 있습니다.

워크스페이스 안에서는 채널을 만들고 채팅을 할 수 있습니다. 채팅 메시지는 실시간으로 반영되고, 동시에 Supabase DB에 영속화됩니다.

문서 영역은 Tiptap 에디터를 사용했습니다. 여러 사용자가 같은 문서를 동시에 편집할 수 있고, Yjs를 통해 충돌 없이 동기화됩니다.

또한 현재 접속자 정보를 presence로 보여주고, 문서 안에서는 `/` 슬래시 명령, `[[문서명]]` 형태의 문서 링크, `#태그` 기반 인사이트를 제공합니다.

---

# 4. 전체 기술 스택

## 슬라이드 4. 기술 스택

### 화면에 보여줄 내용

```txt
Frontend
- React 19
- TypeScript
- Vite
- React Router
- Zustand
- TanStack Query

Realtime / Editor
- Yjs
- y-websocket
- Tiptap

Backend / DB
- Node.js WebSocket Server
- Supabase Auth
- Supabase Postgres
- RLS
```

### 발표 대본

프론트엔드는 React 19, TypeScript, Vite를 사용했습니다. React Router로 SPA 라우팅을 구성했고, 상태 관리는 Zustand와 TanStack Query를 역할별로 나누어 사용했습니다.

실시간 협업은 Yjs와 y-websocket을 사용했습니다. 문서 편집기는 Tiptap을 사용했고, Tiptap의 Collaboration extension을 통해 Yjs 문서와 연결했습니다.

백엔드는 Node.js 기반 WebSocket 서버를 별도로 두었습니다. Supabase는 인증, Postgres 데이터베이스, Row Level Security를 담당합니다.

이 프로젝트에서 중요한 점은 단순히 여러 라이브러리를 사용했다는 것이 아니라, 각 라이브러리의 책임을 분리했다는 점입니다.

---


---

# React 중심 보강 파트

아래 파트는 기존 기술 스택 설명 뒤에 넣으면 좋습니다. 발표 시간이 짧으면 R1과 R3만 사용하고, 기술 면접형 발표라면 R1~R5를 모두 사용합니다.

## 슬라이드 R1. 왜 React를 선택했는가

### 화면에 보여줄 내용

```txt
React 선택 이유
- 복잡한 협업 화면을 컴포넌트로 분해
- Hook으로 상태와 side effect를 재사용
- Router / Query / Zustand / Tiptap 생태계 활용
- SPA 기반 실시간 상호작용에 적합
```

### 발표 대본

이 프로젝트에서 React를 선택한 이유는 단순히 익숙해서가 아니라, **실시간 협업 화면을 컴포넌트와 Hook 단위로 분해하기 좋기 때문**입니다.

SyncSpace의 화면은 채팅 패널, 메시지 목록, 메시지 입력창, 문서 에디터, 툴바, 문서 인사이트 rail, presence bar처럼 여러 독립적인 UI 조각으로 구성됩니다. React는 이런 UI를 컴포넌트 단위로 나누고, 각 컴포넌트가 필요한 상태만 구독하게 만들기 좋습니다.

또한 React 생태계에는 React Router, TanStack Query, Zustand, Tiptap처럼 이 프로젝트에 필요한 라이브러리가 잘 갖춰져 있습니다. 그래서 직접 모든 상태관리와 라우팅, 에디터 통합을 만들기보다, React 생태계의 검증된 도구들을 역할별로 조합했습니다.

여기서 중요한 점은 React를 “화면 그리는 라이브러리”로만 쓴 것이 아니라, **컴포넌트 분리, Hook 추상화, Provider composition, 상태 책임 분리**를 통해 앱 구조의 중심으로 사용했다는 점입니다.

---

## 슬라이드 R2. 컴포넌트 설계 방식

### 화면에 보여줄 내용

```txt
Component Composition

WorkspaceSplitPage
├─ ChatPanel
│  ├─ MessageList
│  └─ MessageComposer
└─ EditorPanel
   ├─ PresenceBar
   ├─ EditorToolbar
   ├─ EditorContent
   └─ EditorKnowledgeRail
```

### 발표 대본

React 컴포넌트는 화면의 책임에 따라 나눴습니다.

`WorkspaceSplitPage`는 채팅과 문서를 한 화면에 배치하는 페이지 수준 컴포넌트입니다. 실제 채팅 기능은 `ChatPanel`이 담당하고, 그 안에서 `MessageList`는 메시지 렌더링, `MessageComposer`는 입력과 전송을 담당합니다.

문서 영역도 마찬가지입니다. `EditorPanel`이 문서 편집 화면의 컨테이너 역할을 하고, `EditorToolbar`, `EditorContent`, `EditorKnowledgeRail`, `PresenceBar`가 각각 툴바, 에디터 본문, 문서 분석 정보, 접속자 표시를 담당합니다.

이렇게 나눈 이유는 한 컴포넌트가 너무 많은 일을 하지 않게 하기 위해서입니다. React에서는 컴포넌트를 작게 나누는 것도 중요하지만, 단순히 작게만 나누면 오히려 흐름이 흩어질 수 있습니다. 그래서 이 프로젝트에서는 **기능 단위로 응집도 있게 나누고, 각 컴포넌트가 하나의 UI 책임을 갖도록** 설계했습니다.

---

## 슬라이드 R3. Custom Hook으로 side effect 분리

### 화면에 보여줄 내용

```txt
Custom Hooks

useWorkspacesQuery       서버 상태 조회
useMessagesInfiniteQuery 메시지 페이지네이션
useYDoc                  Yjs 문서 생성/정리
useYProvider             WebSocket provider 연결/해제
useYAwareness            presence 동기화
useConnectionStatus      연결 상태 계산
useCollaborativeEditor   Tiptap + Yjs 연결
```

### 발표 대본

React에서 실시간 앱을 만들 때 가장 조심해야 하는 부분은 side effect입니다. 이 프로젝트에는 Supabase 구독, WebSocket 연결, Yjs document 생성, Tiptap editor 생성, event listener cleanup 같은 side effect가 많습니다.

이 로직을 컴포넌트 안에 직접 모두 넣으면 컴포넌트가 너무 복잡해지고, cleanup 누락으로 중복 연결이나 memory leak이 생길 수 있습니다. 그래서 반복되는 비동기 로직과 실시간 연결 로직을 custom hook으로 분리했습니다.

예를 들어 `useYDoc`은 room이 바뀔 때 Yjs document를 새로 만들고 unmount 시 destroy합니다. `useYProvider`는 WebSocket provider를 만들고 token, roomName, serverUrl 변화에 맞춰 연결과 해제를 관리합니다. `useConnectionStatus`는 provider의 내부 상태를 React 상태로 변환해 UI에서 표시할 수 있게 해줍니다.

이 구조 덕분에 `ChatPanel`이나 `EditorPanel`은 “어떻게 WebSocket을 연결하는지”보다 “연결된 데이터를 어떻게 화면에 보여줄지”에 집중할 수 있습니다.

---

## 슬라이드 R4. React 상태 책임 분리

### 화면에 보여줄 내용

```txt
React state를 한 곳에 몰지 않음

Local UI State    → Zustand
Server State      → TanStack Query
Realtime CRDT     → Yjs
Component State   → useState / useMemo / useRef
Form State        → controlled input
```

### 발표 대본

React 프로젝트에서 자주 생기는 문제는 모든 상태를 `useState`나 하나의 전역 store에 몰아넣는 것입니다. SyncSpace는 실시간 협업 앱이라 상태 종류가 더 많기 때문에, 처음부터 상태 책임을 나누는 것이 중요했습니다.

컴포넌트 내부에서만 의미 있는 값은 `useState`로 관리했습니다. 예를 들어 split panel의 드래그 상태나 모바일에서 현재 보고 있는 패널은 페이지 컴포넌트 내부 상태로 충분합니다.

여러 컴포넌트에서 공유하지만 서버와 관련 없는 UI 상태는 Zustand로 관리했습니다. 사이드바 접힘, 현재 선택한 채널/문서, 채팅 draft가 여기에 해당합니다.

Supabase에서 가져오는 데이터는 TanStack Query가 담당합니다. 로딩, 에러, 캐시, refetch, mutation 후 invalidation이 필요하기 때문입니다.

그리고 여러 사용자가 동시에 수정하는 문서와 실시간 room 상태는 Yjs가 담당합니다. 이 데이터는 일반적인 React state처럼 마지막 값으로 덮어쓰면 안 되고, CRDT 기반 병합이 필요하기 때문입니다.

---

## 슬라이드 R5. React 렌더링과 성능 고려

### 화면에 보여줄 내용

```txt
React 성능 포인트
- React.lazy + Suspense로 route-level code splitting
- Zustand selector로 필요한 상태만 구독
- useMemo로 메시지 병합/선택값 계산 최적화
- useRef로 transient 값 관리
- Query cache로 중복 fetch 감소
- effect cleanup으로 중복 구독 방지
```

### 발표 대본

React 성능 측면에서는 몇 가지를 신경 썼습니다.

먼저 라우트 단위로 `React.lazy`와 `Suspense`를 사용했습니다. 로그인 화면, 워크스페이스 화면, 에디터 화면은 처음 랜딩 페이지를 볼 때 모두 필요하지 않기 때문에, 필요한 시점에 불러오도록 했습니다.

Zustand를 사용할 때도 store 전체를 구독하지 않고 selector로 필요한 값만 구독했습니다. 이렇게 하면 예를 들어 채팅 draft가 바뀌어도 사이드바 전체가 불필요하게 리렌더링되는 일을 줄일 수 있습니다.

또한 메시지 히스토리와 Yjs 실시간 메시지를 합치고 정렬하는 부분처럼 계산 비용이 있는 파생 데이터는 `useMemo`를 사용했습니다. 반대로 슬래시 명령 입력 시점처럼 렌더링과 직접 관련이 없지만 유지해야 하는 값은 `useRef`를 사용했습니다.

그리고 모든 effect에는 cleanup을 두려고 했습니다. Supabase subscription, Yjs provider, event listener는 cleanup이 없으면 StrictMode나 route 전환 상황에서 중복 연결 문제가 생길 수 있기 때문입니다.

# 5. React 구조 설명

## 슬라이드 5. React 앱 구조

### 화면에 보여줄 내용

```txt
src/
├─ app/          # router, providers
├─ pages/        # route page
├─ features/     # workspace, chat, editor, realtime
└─ shared/       # api, stores, types, utils
```

### 발표 대본

프로젝트 구조는 크게 `app`, `pages`, `features`, `shared`로 나누었습니다.

`app`에는 React 앱의 가장 바깥 구조가 들어갑니다. `App.tsx`는 RouterProvider를 연결하고, providers 폴더에서는 QueryProvider와 AuthBootstrap처럼 앱 전체에 필요한 React context와 초기화 로직을 구성합니다.

`pages`는 라우트 단위 화면입니다. 여기서는 기능 컴포넌트들을 조합합니다. 예를 들어 workbench 페이지는 채팅 기능의 `ChatPanel`과 에디터 기능의 `EditorPanel`을 함께 배치합니다.

`features`는 실제 기능 단위 React 코드입니다. 채팅, 에디터, 워크스페이스, presence, realtime처럼 기능별로 components, hooks, queries를 모았습니다. Atomic Design처럼 atoms/molecules로 나누지 않고 feature-based 구조를 선택한 이유는, 이 앱이 버튼 모음보다 채팅/문서/실시간 협업이라는 도메인 기능이 더 중요하기 때문입니다.

`shared`에는 Supabase client, backend fetch wrapper, Zustand store, 공통 타입, 유틸 함수가 들어갑니다. 여러 feature가 함께 쓰는 코드만 shared로 올리고, 특정 기능에만 필요한 코드는 해당 feature 안에 둬서 의존 방향을 단순하게 유지했습니다.

---

# 6. 라우팅 설계

## 슬라이드 6. React Router 설계

### 화면에 보여줄 내용

```txt
/
/auth/login
/workspaces
/w/:workspaceId
/w/:workspaceId/ch/:channelId
/w/:workspaceId/doc/:documentId
/w/:workspaceId/ch/:channelId/doc/:documentId
```

### 발표 대본

라우팅은 React Router의 `createBrowserRouter`를 사용했습니다.

홈 화면, 로그인 화면, 워크스페이스 목록 화면이 있고, 실제 협업 화면은 `/w/:workspaceId` 하위에 중첩 라우트로 구성했습니다.

채널과 문서 선택 상태는 URL에 반영됩니다. 예를 들어 특정 워크스페이스의 특정 채널과 문서를 같이 열면 `/w/:workspaceId/ch/:channelId/doc/:documentId` 형태가 됩니다.

이렇게 URL에 상태를 표현하면 새로고침이나 링크 공유에도 현재 작업 맥락을 복원할 수 있습니다.

또한 로그인 이후 접근해야 하는 영역은 `ProtectedRoute`로 감쌌습니다. 세션이 없으면 로그인 페이지로 redirect하고, 세션 확인 중에는 로딩 화면을 보여줍니다.

---

# 7. 가장 중요한 설계: 상태 책임 분리

## 슬라이드 7. 상태관리 전략

### 화면에 보여줄 내용

```txt
Zustand
→ 로컬 UI 상태
→ sidebar, selected id, draft

TanStack Query
→ 서버 상태
→ workspaces, channels, documents, messages

Yjs
→ 실시간 협업 상태
→ document content, realtime chat, awareness
```

### 발표 대본

이 프로젝트에서 가장 중요하게 설명하고 싶은 부분은 상태관리입니다.

SyncSpace는 상태를 세 가지로 나눴습니다.

첫 번째는 **로컬 UI 상태**입니다. 예를 들어 사이드바가 접혀 있는지, 현재 선택한 채널 ID가 무엇인지, 채팅 입력창에 작성 중인 draft가 무엇인지 같은 상태입니다. 이런 상태는 서버와 직접 관련이 없기 때문에 Zustand로 관리했습니다.

두 번째는 **서버 상태**입니다. 워크스페이스 목록, 채널 목록, 문서 목록, 과거 메시지 히스토리처럼 Supabase에서 가져오는 데이터입니다. 이런 데이터는 로딩, 에러, 캐싱, refetch, mutation 이후 갱신이 필요하기 때문에 TanStack Query로 관리했습니다.

세 번째는 **실시간 협업 상태**입니다. 문서 본문처럼 여러 사용자가 동시에 편집하는 데이터는 단순 서버 캐시로 처리하기 어렵습니다. 그래서 Yjs를 사용해 CRDT 기반으로 동기화했습니다.

결론적으로 이 프로젝트는 **Zustand는 UI 상태, TanStack Query는 서버 상태, Yjs는 협업 상태**라는 기준으로 설계했습니다.

---

# 8. Zustand 설명

## 슬라이드 8. 왜 Zustand를 썼는가

### 화면에 보여줄 내용

```txt
Zustand 사용 예
- authStore
- workspaceUiStore
- sidebarStore
- chatUiStore
- editorUiStore

선택 이유
- 가볍고 단순함
- Provider 없이 사용 가능
- selector 기반 구독
- persist middleware 지원
```

### 발표 대본

Zustand는 로컬 UI 상태를 관리하기 위해 사용했습니다.

예를 들어 `workspaceUiStore`에서는 현재 워크스페이스 ID, 현재 채널 ID, 현재 문서 ID를 저장합니다. `chatUiStore`에서는 채널별 입력 draft를 저장하고, `sidebarStore`에서는 사이드바 접힘 상태를 관리합니다.

제가 이전에는 Recoil을 사용해본 경험이 있습니다. Recoil은 atom과 selector 기반이라 파생 상태를 선언적으로 만들기 좋습니다. 하지만 이 프로젝트의 UI 상태는 복잡한 atom graph보다는 단순한 선택값과 UI 플래그가 많았습니다.

그래서 더 단순한 store 기반의 Zustand가 적합하다고 판단했습니다. 또한 Zustand는 필요한 값만 selector로 구독할 수 있고, persist middleware를 통해 localStorage 저장도 쉽게 처리할 수 있습니다.

---

# 9. TanStack Query 설명

## 슬라이드 9. 왜 TanStack Query를 썼는가

### 화면에 보여줄 내용

```txt
TanStack Query 사용 예
- useWorkspacesQuery
- useChannelsQuery
- useDocumentsQuery
- useMessagesInfiniteQuery

담당 기능
- loading / error
- cache
- staleTime
- refetch
- mutation 이후 invalidate
- infinite query
```

### 발표 대본

TanStack Query는 서버 상태를 관리하기 위해 사용했습니다.

서버에서 가져오는 데이터는 단순히 `useState`에 넣는 것만으로는 부족합니다. 로딩 상태, 에러 상태, 캐싱, 다시 가져오기, mutation 이후 목록 갱신 같은 처리가 필요합니다.

예를 들어 워크스페이스를 생성하면 목록에 즉시 반영하고, 이후 서버 데이터와 다시 동기화해야 합니다. 이때 TanStack Query의 `setQueryData`와 `invalidateQueries`를 사용했습니다.

채팅 메시지 히스토리는 이전 메시지를 계속 불러와야 하기 때문에 `useInfiniteQuery`를 사용했습니다.

즉, TanStack Query는 이 프로젝트에서 Supabase 기반 서버 데이터를 React 컴포넌트에 안정적으로 연결해주는 역할을 합니다.

---

# 10. Recoil과 비교 질문 대비

## 슬라이드 10. Recoil 대신 Zustand + TanStack Query

### 화면에 보여줄 내용

```txt
이전 경험: Recoil
- atom / selector 기반
- React 친화적
- 파생 상태 표현에 강함

현재 선택
- UI 상태: Zustand
- 서버 상태: TanStack Query

이유
- 서버 상태와 UI 상태를 분리하기 위해
- 캐싱/무효화/페이지네이션은 Query가 더 적합
- 단순 UI 상태는 Zustand가 더 가벼움
```

### 발표 대본

제가 예전에 사용했던 Recoil과 비교하면, Recoil은 atom과 selector 기반으로 상태를 잘게 쪼개고 파생 상태를 만들기 좋습니다.

하지만 서버 데이터까지 Recoil selector로 관리하면 캐시 무효화, refetch, mutation 이후 갱신, infinite pagination 같은 기능을 직접 설계해야 합니다.

그래서 이번 프로젝트에서는 서버 상태와 클라이언트 UI 상태를 명확히 분리했습니다.

서버에서 오는 데이터는 TanStack Query가 관리하고, 브라우저 안에서만 의미 있는 UI 상태는 Zustand가 관리합니다.

이렇게 나누면 “이 데이터가 서버에서 온 것인지, 단순 UI 상태인지, 실시간 협업 상태인지”가 명확해져서 유지보수와 디버깅이 쉬워집니다.

---

# 11. 실시간 협업 구조

## 슬라이드 11. 실시간 동기화

### 화면에 보여줄 내용

```txt
DB 목록 변경
Supabase Realtime
→ Query invalidation
→ polling fallback

문서 / 채팅 room
Yjs + y-websocket
→ CRDT 동기화
→ awareness / presence
```

### 발표 대본

실시간 동기화는 두 종류로 나누었습니다.

워크스페이스 목록, 채널 목록, 문서 목록, 메시지 히스토리처럼 DB가 source of truth인 데이터는 Supabase Realtime으로 변경 이벤트를 받고, TanStack Query cache를 invalidate합니다.

다만 브라우저 탭 상태나 네트워크 상황에 따라 이벤트가 누락될 수도 있기 때문에 polling fallback도 함께 두었습니다.

반면 문서 본문과 실시간 채팅 room은 Yjs와 y-websocket으로 처리했습니다. 특히 문서 편집은 여러 사용자가 동시에 같은 내용을 수정할 수 있기 때문에 단순 WebSocket 이벤트만으로는 충돌 해결이 어렵습니다.

Yjs는 CRDT 기반이라 동시 편집 충돌을 자동으로 병합할 수 있고, awareness 기능을 통해 현재 접속자 presence도 구현할 수 있습니다.

---

# 12. 에디터 구현

## 슬라이드 12. Tiptap 기반 공동 편집기

### 화면에 보여줄 내용

```txt
Tiptap
- StarterKit
- Placeholder
- Collaboration(Yjs)

추가 기능
- / 슬래시 명령
- toolbar
- [[문서명]] 링크
- #태그 인사이트
- 문서 목차 rail
```

### 발표 대본

문서 에디터는 Tiptap을 사용했습니다.

Tiptap은 ProseMirror 기반 에디터 프레임워크입니다. 직접 ProseMirror를 사용하는 것보다 React와 연결하기 쉽고, extension 구조가 잘 되어 있습니다.

기본 문서 기능은 StarterKit으로 구성했고, placeholder extension과 collaboration extension을 추가했습니다. Collaboration extension에는 Yjs document를 연결해서 공동 편집이 가능하도록 했습니다.

또한 단순 에디터에서 끝나지 않고, 포트폴리오에서 보여줄 수 있는 기능을 추가했습니다. `/`를 입력하면 슬래시 명령 메뉴가 뜨고, 제목, 리스트, 코드블록, 인용 등을 빠르게 삽입할 수 있습니다.

문서 안에 `[[문서명]]`을 쓰면 문서 링크 후보를 보여주고, `#태그`를 입력하면 우측 rail에서 태그를 정리해서 보여줍니다. 제목 node를 스캔해서 문서 목차도 표시합니다.

---

# 13. 백엔드와 보안

## 슬라이드 13. Supabase와 WebSocket 서버

### 화면에 보여줄 내용

```txt
Supabase
- Auth
- Postgres
- RLS
- Realtime publication

Node.js WebSocket Server
- Yjs room 관리
- workspace membership 검증
- chat persistence
- document snapshot persistence
```

### 발표 대본

Supabase는 인증과 데이터베이스, Row Level Security를 담당합니다.

프론트엔드는 Supabase anon key를 사용하지만, 실제 데이터 접근 권한은 RLS policy로 제한됩니다. 예를 들어 워크스페이스 멤버만 해당 워크스페이스의 채널, 문서, 메시지를 조회할 수 있습니다.

WebSocket 서버는 Node.js로 별도 구현했습니다. 사용자가 WebSocket room에 접속할 때 access token을 확인하고, 해당 사용자가 workspace member인지 검증합니다.

채팅 메시지는 Yjs room에 먼저 반영되고, 백엔드 persistence hook이 Supabase messages 테이블에 저장합니다.

문서 본문은 Supabase documents 테이블에 직접 저장하지 않고, Yjs document snapshot으로 저장합니다. documents 테이블은 제목, 작성자, updatedAt 같은 메타데이터를 담당합니다.

---

# 14. 성능과 사용자 경험

## 슬라이드 14. UX / 성능 포인트

### 화면에 보여줄 내용

```txt
UX
- 채팅과 문서 split workbench
- 모바일 패널 전환
- connection status
- presence bar
- loading / empty / error state

성능
- route-level lazy loading
- vendor manual chunks
- query cache
- selector 기반 상태 구독
```

### 발표 대본

사용자 경험 측면에서는 채팅과 문서가 한 화면에 보이도록 split workbench를 구성했습니다. 데스크톱에서는 좌우 패널을 동시에 보고, 모바일에서는 채팅과 문서 패널을 전환할 수 있게 했습니다.

React 관점에서 보면 이 화면은 상태 변화가 많은 화면입니다. 채팅 입력, 메시지 수신, 문서 편집, presence 변경, 연결 상태 변경이 동시에 일어납니다. 그래서 불필요한 리렌더링을 줄이기 위해 상태 구독 범위를 작게 가져갔습니다. Zustand는 selector로 필요한 값만 구독하고, TanStack Query는 query cache로 중복 fetch를 줄입니다.

라우트 단위 lazy loading도 적용했습니다. 처음 랜딩 페이지에 들어왔을 때 로그인, 워크스페이스, 에디터 관련 코드를 모두 불러오지 않고 필요한 시점에 불러옵니다.

또한 메시지 병합이나 선택된 채널/문서 계산처럼 파생 데이터는 `useMemo`로 관리했습니다. 반대로 slash command 입력 시점처럼 렌더링을 유발할 필요가 없는 transient 값은 `useRef`로 관리했습니다.

Vite 설정에서는 React, Tiptap, Yjs, Supabase/TanStack Query 관련 vendor chunk를 나누어 브라우저 캐시 효율을 높였습니다.

---

# 15. 어려웠던 점과 해결

## 슬라이드 15. 트러블슈팅

### 화면에 보여줄 내용

```txt
어려웠던 점
1. 서버 상태와 실시간 상태 중복
2. 메시지 중복 표시
3. WebSocket 연결 상태 불안정
4. 동시 편집 persistence

해결
- clientId 기반 dedupe
- Query invalidation + polling fallback
- Yjs provider hook 분리
- document snapshot persistence
```

### 발표 대본

구현하면서 어려웠던 점은 서버 상태와 실시간 상태가 겹치는 부분이었습니다.

예를 들어 채팅 메시지는 실시간으로 바로 보여야 하지만, 동시에 DB에도 저장되어야 합니다. 그러면 Yjs에서 온 메시지와 DB 히스토리에서 다시 가져온 메시지가 중복으로 보일 수 있습니다.

이를 해결하기 위해 메시지를 보낼 때 `clientId`를 부여하고, 히스토리 메시지와 실시간 메시지를 합칠 때 `clientId` 또는 `id` 기준으로 중복 제거했습니다.

또한 실시간 DB 이벤트만 믿으면 누락 가능성이 있기 때문에 TanStack Query의 polling fallback도 함께 두었습니다.

WebSocket provider 생성과 cleanup 로직은 공통 hook으로 분리해서 채팅 room과 문서 room에서 같은 패턴을 재사용할 수 있게 했습니다.

---

# 16. 개선하고 싶은 점

## 슬라이드 16. 향후 개선 방향

### 화면에 보여줄 내용

```txt
개선 방향
- Vitest / Testing Library / Playwright 테스트 추가
- shared contract package 분리
- 문서 snapshot 저장소를 R2/S3로 이전
- 큰 채팅방 virtualization
- WebSocket rate limit
- observability metric 추가
```

### 발표 대본

앞으로 개선하고 싶은 부분도 있습니다.

첫 번째는 테스트입니다. 현재는 TypeScript typecheck와 build 검증 중심인데, 이후에는 Vitest로 유틸 함수와 hook을 테스트하고, Playwright로 두 브라우저 간 실시간 협업 시나리오를 검증하고 싶습니다.

두 번째는 타입 계약입니다. 현재 프론트와 백엔드에 계약 타입이 나뉘어 있는데, 이를 pnpm workspace의 shared package로 분리하면 더 안정적으로 관리할 수 있습니다.

세 번째는 운영 관점입니다. 문서 snapshot을 현재 파일 기반으로 저장할 수 있는데, production에서는 S3나 R2 같은 durable storage로 이전하는 것이 좋습니다.

또한 큰 채팅방에서는 virtualization을 적용하고, WebSocket에는 rate limit과 모니터링 metric을 추가하고 싶습니다.

---

# 17. 마무리

## 슬라이드 17. 결론

### 화면에 보여줄 내용

```txt
핵심 요약
- React 기반 실시간 협업 SPA
- 채팅 + 문서 편집 통합 UX
- Zustand / TanStack Query / Yjs 상태 책임 분리
- Supabase + Node.js WebSocket 서버로 인증/권한/실시간 처리
```

### 발표 대본

정리하면 SyncSpace는 채팅과 문서 편집을 한 화면에 통합한 React 기반 실시간 협업 앱입니다.

이 프로젝트에서 가장 중요하게 생각한 부분은 상태관리였습니다.

로컬 UI 상태는 Zustand, 서버 상태는 TanStack Query, 실시간 협업 상태는 Yjs로 나누었습니다. 이 구조 덕분에 각 상태의 source of truth가 명확해지고, 유지보수와 디버깅이 쉬워졌습니다.

또한 Supabase Auth, Postgres, RLS를 통해 인증과 권한을 처리하고, Node.js WebSocket 서버를 통해 Yjs room과 persistence를 관리했습니다.

단순 CRUD 프로젝트가 아니라, React에서 실시간 협업 앱을 만들 때 상태와 동기화를 어떻게 설계할 수 있는지를 보여주는 프로젝트라고 설명할 수 있습니다.

감사합니다.

---

# 부록 A. 1분 압축 발표 대본

안녕하세요. 제가 만든 SyncSpace는 React 기반 실시간 협업 워크벤치입니다.

일반적으로 팀 협업에서는 Slack 같은 채팅 도구와 Notion 같은 문서 도구를 따로 사용합니다. SyncSpace는 이 흐름을 하나로 합쳐서, 왼쪽에서는 채팅을 하고 오른쪽에서는 문서를 공동 편집할 수 있게 만들었습니다.

기술적으로는 React 19, TypeScript, Vite를 사용했고, 라우팅은 React Router로 구성했습니다. 상태관리는 성격에 따라 분리했습니다. 사이드바, 선택된 채널, 입력 draft 같은 로컬 UI 상태는 Zustand가 담당하고, 워크스페이스, 채널, 문서, 메시지 히스토리처럼 서버에서 가져오는 데이터는 TanStack Query가 담당합니다. 여러 사용자가 동시에 편집하는 문서와 실시간 채팅 room은 Yjs로 동기화했습니다.

백엔드는 Node.js WebSocket 서버와 Supabase를 사용했습니다. Supabase는 인증, Postgres, RLS 권한 관리를 담당하고, WebSocket 서버는 Yjs room과 persistence를 관리합니다.

이 프로젝트의 핵심은 단순 기능 구현이 아니라, React 실시간 협업 앱에서 UI 상태, 서버 상태, 협업 상태를 명확히 분리한 아키텍처입니다.

---

# 부록 B. 3분 압축 발표 대본

안녕하세요. SyncSpace는 채팅과 문서 편집을 한 화면에서 처리하는 React 기반 실시간 협업 앱입니다.

프로젝트를 만든 이유는 협업 과정에서 채팅과 문서가 분리되어 결정사항이 흩어지는 문제를 해결하고 싶었기 때문입니다. 그래서 왼쪽에는 채널 채팅, 오른쪽에는 공동 문서 편집기를 배치한 split workbench 구조로 만들었습니다.

프론트엔드는 React 19, TypeScript, Vite 기반입니다. React Router로 워크스페이스, 채널, 문서 URL을 구성했고, 로그인 이후 접근해야 하는 화면은 ProtectedRoute로 보호했습니다.

가장 중요한 설계는 상태관리입니다. 이 프로젝트에서는 상태를 세 가지로 나눴습니다.

첫 번째는 Zustand입니다. Zustand는 사이드바 접힘, 현재 선택한 채널/문서, 채팅 입력 draft 같은 로컬 UI 상태를 관리합니다.

두 번째는 TanStack Query입니다. 워크스페이스 목록, 채널 목록, 문서 목록, 메시지 히스토리처럼 서버에서 가져오는 데이터는 로딩, 에러, 캐시, refetch, mutation 이후 invalidation이 필요하기 때문에 TanStack Query를 사용했습니다.

세 번째는 Yjs입니다. 공동 문서 편집처럼 여러 사용자가 동시에 수정하는 데이터는 단순 서버 상태로 처리하기 어렵습니다. 그래서 CRDT 기반의 Yjs를 사용했고, Tiptap Collaboration extension과 연결했습니다.

Supabase는 Auth, Postgres, RLS를 담당하고, Node.js WebSocket 서버는 Yjs room 관리, workspace membership 검증, 채팅 메시지 persistence, 문서 snapshot persistence를 담당합니다.

결론적으로 SyncSpace는 단순 CRUD가 아니라 React에서 실시간 협업 상태를 어떻게 분리하고 동기화할 수 있는지를 보여주는 프로젝트입니다.

---

# 부록 C. 예상 질문 짧은 답변


## Q. React 프로젝트로서 가장 강조하고 싶은 부분은 무엇인가요?

이 프로젝트는 React를 단순히 UI를 그리는 데만 사용한 것이 아니라, 복잡한 실시간 협업 UI를 컴포넌트, custom hook, provider, router 구조로 나눠 설계한 점을 강조하고 싶습니다. 특히 로컬 UI 상태는 Zustand, 서버 상태는 TanStack Query, 실시간 협업 상태는 Yjs로 분리해서 React 컴포넌트가 필요한 상태만 구독하도록 만들었습니다.

## Q. 컴포넌트 분리는 어떤 기준으로 했나요?

Atomic Design처럼 시각적 크기 기준으로 나누기보다, feature-based 구조로 나눴습니다. 채팅은 `features/chat`, 에디터는 `features/editor`, 워크스페이스는 `features/workspace`에 모았습니다. 각 feature 안에서 UI 컴포넌트, query hook, realtime hook을 함께 관리해 기능 변경 시 관련 코드를 찾기 쉽도록 했습니다.

## Q. Custom Hook을 많이 만든 이유는 무엇인가요?

Supabase 구독, WebSocket 연결, Yjs provider 생성, Tiptap editor 연결처럼 side effect가 많은 앱이기 때문입니다. 이 로직을 컴포넌트에 직접 넣으면 UI 렌더링 책임과 연결 관리 책임이 섞입니다. 그래서 `useYProvider`, `useYDoc`, `useYAwareness`, `useCollaborativeEditor`처럼 hook으로 분리해 컴포넌트는 화면 조합에 집중하도록 했습니다.

## Q. React에서 리렌더링 최적화는 어떻게 했나요?

먼저 상태를 역할별로 분리해 한 상태 변화가 앱 전체 리렌더링으로 번지지 않게 했습니다. Zustand는 selector로 필요한 상태만 구독하고, TanStack Query는 query key 단위로 서버 데이터를 캐싱합니다. 메시지 병합과 정렬 같은 파생 데이터는 `useMemo`를 사용했고, 렌더링에 직접 필요 없는 transient 값은 `useRef`로 관리했습니다. 라우트는 `React.lazy`와 `Suspense`로 code splitting했습니다.

## Q. React Context만으로 구현하지 않은 이유는 무엇인가요?

Context는 provider 하위에 값을 전달하기에는 좋지만, 자주 바뀌는 UI 상태를 모두 넣으면 리렌더링 범위가 넓어질 수 있습니다. SyncSpace는 채팅 입력, presence, 선택 ID처럼 자주 변하는 상태가 많기 때문에 Zustand selector와 TanStack Query cache를 사용하는 편이 더 적합했습니다. Context는 QueryProvider처럼 라이브러리 provider 구성에 사용하고, 앱 상태 자체는 역할별 도구에 맡겼습니다.

## Q. 왜 Zustand를 사용했나요?

Zustand는 사이드바, 선택 ID, 입력 draft 같은 로컬 UI 상태를 가볍게 관리하기 위해 사용했습니다. Redux보다 보일러플레이트가 적고, selector로 필요한 값만 구독할 수 있으며, persist middleware로 localStorage 저장도 쉽게 처리할 수 있습니다.

## Q. 왜 TanStack Query를 사용했나요?

서버에서 가져오는 데이터는 로딩, 에러, 캐싱, refetch, mutation 이후 invalidation이 필요합니다. TanStack Query는 이런 서버 상태 관리 기능을 기본으로 제공하기 때문에 Supabase에서 가져오는 워크스페이스, 채널, 문서, 메시지 히스토리를 관리하기에 적합했습니다.

## Q. Recoil 대신 Zustand를 쓴 이유는 무엇인가요?

Recoil은 atom과 selector 기반으로 파생 상태를 만들기 좋습니다. 다만 이 프로젝트의 로컬 UI 상태는 복잡한 atom graph보다 단순한 store 구조가 더 적합했습니다. 또한 서버 상태는 Recoil selector보다 TanStack Query가 캐싱, refetch, infinite query, mutation invalidation을 더 잘 처리하므로 역할을 분리했습니다.

## Q. 왜 Yjs를 사용했나요?

문서 공동 편집은 여러 사용자가 동시에 같은 문서를 수정하기 때문에 충돌 해결이 필요합니다. 단순 WebSocket 이벤트로 직접 구현하면 복잡하므로, CRDT 기반으로 동시 편집 병합을 처리하는 Yjs를 사용했습니다.

## Q. 왜 Next.js가 아니라 Vite SPA인가요?

SyncSpace의 핵심은 SEO나 SSR보다 로그인 이후의 실시간 협업 경험입니다. 대부분의 기능이 WebSocket과 클라이언트 상호작용 중심이기 때문에 Vite 기반 SPA가 더 단순하고 적합했습니다. WebSocket 서버도 별도 Node.js 서비스로 운영해야 하므로 Next.js의 서버 기능 이점이 크지 않았습니다.

## Q. Supabase anon key가 프론트에 노출되어도 괜찮나요?

Supabase anon key는 클라이언트에서 사용하도록 설계된 공개 키입니다. 중요한 것은 RLS 정책으로 row 접근 권한을 제한하는 것입니다. 반대로 service role key는 RLS를 우회할 수 있으므로 서버 환경 변수로만 관리하고 프론트에는 절대 노출하지 않습니다.
