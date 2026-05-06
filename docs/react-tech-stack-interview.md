# SyncSpace React 기술 스택 설명 및 심층 면접 Q&A

## 문서 목적

이 문서는 SyncSpace 프로젝트를 기술 면접에서 설명하기 위한 자료입니다. 단순히 “무엇을 썼는가”가 아니라, **왜 이 기술을 선택했는지**, **이 선택이 프로젝트 요구사항에 어떤 장점을 주는지**, **대안 라이브러리는 무엇이 있었고 왜 채택하지 않았는지**를 답변할 수 있게 정리했습니다.

SyncSpace는 채팅과 문서 편집을 같은 화면에서 처리하는 실시간 협업 워크벤치입니다. 핵심 프론트엔드 설계 포인트는 다음 한 문장으로 요약할 수 있습니다.

> **Zustand는 로컬 UI 상태, TanStack Query는 서버 상태, Yjs는 실시간 협업 상태를 담당하도록 분리한 React SPA입니다.**

---

## 1. 프로젝트 한눈에 설명하기

### 1분 설명

SyncSpace는 React 19, TypeScript, Vite 기반의 실시간 협업 앱입니다. 사용자는 워크스페이스 안에서 채널 채팅을 하고, 같은 화면 오른쪽에서 Tiptap 기반 문서를 공동 편집할 수 있습니다. Supabase는 인증, Postgres 데이터, RLS 권한 관리를 담당하고, Node.js WebSocket 서버는 Yjs 기반 채팅/문서 room을 관리합니다. 프론트엔드에서는 Zustand, TanStack Query, Yjs를 의도적으로 분리해 로컬 UI 상태, DB 기반 서버 상태, 실시간 CRDT 상태가 서로 섞이지 않도록 설계했습니다.

### 3분 설명

이 프로젝트는 단순 CRUD 앱이 아니라, “실시간 협업 중에 React 상태를 어떻게 나눌 것인가”를 보여주는 포트폴리오 프로젝트입니다.

- **React + Vite**로 빠른 SPA 개발 환경과 정적 배포 구조를 만들었습니다.
- **React Router**로 워크스페이스, 채널, 문서 URL을 명확히 표현하고, 보호 라우트를 통해 로그인 이후 앱 영역을 감쌌습니다.
- **Zustand**는 사이드바 접힘, 현재 선택한 워크스페이스/채널/문서, 채팅 입력 draft 같은 브라우저 UI 상태를 담당합니다.
- **TanStack Query**는 Supabase Postgres에서 조회하는 워크스페이스, 채널, 문서 목록, 메시지 히스토리 같은 서버 상태를 담당합니다.
- **Supabase Realtime + polling fallback**은 DB 목록 변경을 빠르게 반영하고, 이벤트 누락이나 비활성 탭 상황에서도 캐시가 회복되도록 보완합니다.
- **Yjs + y-websocket**은 문서 편집, 채팅 실시간 반영, presence 같은 다중 사용자 동기화 상태를 처리합니다.
- **Tiptap**은 ProseMirror를 React에서 쓰기 쉽게 감싼 에디터 프레임워크이고, Yjs Collaboration 확장과 잘 맞기 때문에 공동 편집 문서 구현에 적합했습니다.

---

## 2. 현재 기술 스택 맵

`package.json` 기준 주요 스택은 다음과 같습니다.

| 영역 | 사용 기술 | 실제 사용 위치 | 선택 이유 |
| --- | --- | --- | --- |
| UI 런타임 | React `^19.2.5`, React DOM `^19.2.5` | `src/main.tsx`, `src/app/App.tsx` | 컴포넌트 기반 UI, Hooks, 생태계, 채팅/에디터 같은 복잡한 화면 조립에 적합 |
| 언어 | TypeScript `^5.9.3` | `tsconfig.json`, 전체 `src/`, `server/` | 계약 타입, API 응답 매핑, strict 옵션으로 런타임 오류 감소 |
| 번들러 | Vite `^8.0.10`, `@vitejs/plugin-react` `^6.0.1` | `vite.config.ts` | 빠른 dev server, React Fast Refresh, SPA 정적 배포, vendor chunk 제어 |
| 라우팅 | React Router DOM `^7.14.2` | `src/app/router/router.tsx` | SPA 라우팅, 중첩 라우트, 보호 라우트, URL로 워크스페이스/채널/문서 상태 표현 |
| 서버 상태 | TanStack Query `^5.100.7` | `src/features/**/queries/*` | 캐싱, stale 관리, mutation 후 invalidate, infinite query |
| 로컬 UI 상태 | Zustand `^5.0.12` | `src/shared/stores/*` | 작은 API, selector 기반 구독, persist middleware, Redux보다 가벼움 |
| 인증/DB | Supabase JS `^2.105.1` | `src/shared/api/supabaseClient.ts`, `supabase/*.sql` | Auth, Postgres, RLS, Realtime을 빠르게 통합 |
| 실시간 협업 | Yjs `^13.6.30`, y-websocket `^3.0.0` | `src/features/realtime/*`, `server/src/realtime/*` | CRDT 기반 충돌 해결, 다중 사용자 문서 편집에 적합 |
| 에디터 | Tiptap `^3.22.5` | `src/features/editor/*` | ProseMirror 기반 확장성, React hook, Yjs Collaboration 확장 |
| 아이콘 | lucide-react `^1.14.0` | 여러 컴포넌트 | 가볍고 일관된 SVG 아이콘, UI 라이브러리 종속 없음 |
| 스타일링 | CSS variables + plain CSS | `src/styles.css` | 디자인 토큰을 직접 통제, Tailwind/CSS-in-JS 없이 번들/추상화 최소화 |
| 백엔드 | Node.js 22, TypeScript, ws | `server/src/*` | WebSocket 장기 연결, Supabase service role 보호, Yjs room persistence |
| 패키지 관리 | pnpm workspace | `pnpm-workspace.yaml`, root/server package | 프론트/서버를 하나의 repo에서 관리, 빠른 설치와 lockfile 일관성 |

---

## 3. 아키텍처 핵심 결정

### 3.1 상태를 세 계층으로 나눈 이유

SyncSpace의 상태는 성격이 다릅니다.

```txt
Zustand
  - 사이드바 접힘 여부
  - 모바일 패널 열림 여부
  - 현재 선택한 workspace/channel/document
  - 채팅 입력 draft

TanStack Query
  - 워크스페이스 목록
  - 채널 목록
  - 문서 메타데이터 목록
  - 과거 채팅 메시지 페이지네이션

Yjs
  - 현재 채팅 room의 실시간 메시지 배열
  - 현재 문서 room의 공동 편집 상태
  - awareness/presence 상태
```

이렇게 나눈 이유는 다음과 같습니다.

1. **서버 상태와 클라이언트 상태의 생명주기가 다르기 때문입니다.**  
   서버 상태는 캐싱, 재검증, 실패 재시도, 동기화가 중요합니다. 반면 사이드바 접힘 같은 UI 상태는 서버와 무관합니다.

2. **실시간 협업 상태는 일반 REST 캐시와 다르기 때문입니다.**  
   문서 편집은 여러 사용자의 동시 수정이 발생하므로 단순히 “마지막 저장 값”으로 덮어쓰면 충돌이 납니다. Yjs의 CRDT 모델이 필요합니다.

3. **상태 책임이 분리되면 디버깅이 쉬워집니다.**  
   목록이 안 바뀌면 TanStack Query invalidation을 보면 되고, 에디터 동기화가 안 되면 Yjs provider/room을 보면 됩니다.

### 3.2 React Router 중심 SPA 구조

라우터는 `src/app/router/router.tsx`에서 `createBrowserRouter`로 구성되어 있습니다.

- `/` : 랜딩 페이지
- `/auth/login` : 로그인/회원가입
- `/workspaces` : 워크스페이스 목록
- `/w/:workspaceId` : 워크스페이스 shell
- `/w/:workspaceId/ch/:channelId/doc/:documentId` : 채팅과 문서가 결합된 workbench

`ProtectedAppRoute`가 `AppProviders`와 `ProtectedRoute`를 함께 감싸며, 인증이 필요한 앱 영역에만 QueryProvider, AuthBootstrap, 서버 상태 realtime bridge를 적용합니다.

### 3.3 실시간 동기화 전략

SyncSpace의 실시간은 두 종류입니다.

| 실시간 대상 | 사용 방식 | 이유 |
| --- | --- | --- |
| DB 기반 목록 변경 | Supabase Realtime + TanStack Query invalidation + polling fallback | 워크스페이스/채널/문서/메시지 히스토리 목록은 DB가 source of truth |
| 문서/채팅 room 상태 | Yjs + y-websocket | 동시 편집, presence, 채팅 즉시 반영은 CRDT room이 적합 |

채팅은 Yjs 배열에 먼저 push되고, 백엔드 persistence hook이 Supabase `messages` 테이블에 저장합니다. 이후 TanStack Query 히스토리와 Yjs 실시간 메시지를 `clientId` 기준으로 중복 제거합니다.

문서는 Supabase `documents` 테이블에는 메타데이터만 저장하고, 실제 편집 내용은 Yjs document snapshot으로 WebSocket 서버가 관리합니다. 이 구조는 DB row 업데이트 충돌 없이 공동 편집 상태를 다루기 위한 선택입니다.

---

## 4. 왜 이 기술을 썼고, 대안은 왜 쓰지 않았나

### 4.1 React를 쓴 이유

**선택 이유**

- 채팅 패널, 에디터 패널, presence, 사이드바처럼 독립적인 UI를 컴포넌트로 분리하기 좋습니다.
- Hooks로 WebSocket provider, Query, local store를 기능별 custom hook으로 감쌀 수 있습니다.
- Tiptap, TanStack Query, Zustand, React Router 등 필요한 라이브러리 생태계가 풍부합니다.
- SPA로 배포하기 쉬워 Vercel 같은 정적 호스팅과 잘 맞습니다.

**대안과 미채택 이유**

| 대안 | 장점 | 사용하지 않은 이유 |
| --- | --- | --- |
| Vue | SFC와 반응형 모델이 직관적 | 프로젝트 목표가 React 상태 분리와 React 생태계 역량 증명 |
| Svelte | 컴파일 타임 최적화, 적은 보일러플레이트 | Tiptap/Query/Router/Zustand 조합의 React 생태계가 프로젝트 목표에 더 직접적 |
| Next.js | SSR, App Router, 파일 기반 라우팅 | 실시간 협업 SPA가 핵심이고 SEO/SSR 이점이 크지 않음. WebSocket 백엔드도 별도 장기 실행 서비스가 필요 |
| Vanilla JS | 의존성 최소화 | 협업 UI가 복잡해질수록 상태/컴포넌트 구조 유지가 어려움 |

### 4.2 Vite를 쓴 이유

**선택 이유**

- React SPA 개발 서버가 빠르고 HMR 경험이 좋습니다.
- `vite build`로 정적 프론트엔드 배포가 단순합니다.
- `vite.config.ts`에서 Tiptap/Yjs/Supabase/React 관련 vendor chunk를 나눠 초기 로딩과 캐시 전략을 설명할 수 있습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| Create React App | 현재 React 생태계에서 권장도가 낮고 설정 확장성이 부족함 |
| Webpack 직접 설정 | 세밀한 제어는 가능하지만 포트폴리오 SPA에는 설정 비용이 큼 |
| Next.js | SSR/서버 컴포넌트보다 클라이언트 실시간 협업이 핵심이라 Vite SPA가 더 단순 |
| Parcel | 설정은 간단하지만 Vite + React 조합이 더 표준적이고 문서/생태계가 강함 |

### 4.3 React Router를 쓴 이유

**선택 이유**

- 워크스페이스, 채널, 문서 선택을 URL로 표현할 수 있습니다.
- 중첩 라우트로 `WorkspaceShell` 안에 split workbench를 렌더링할 수 있습니다.
- `Navigate`, `Outlet`, `useParams`, `useLocation`으로 보호 라우트와 리다이렉션을 명확히 구현할 수 있습니다.
- route-level lazy loading으로 로그인/워크스페이스/문서 화면을 필요할 때 불러옵니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| TanStack Router | 타입 안정성이 강하지만 프로젝트 복잡도 대비 추가 학습/설정 비용이 있음 |
| Next.js 파일 라우팅 | Next.js 프레임워크 전체를 채택해야 하며 이 프로젝트의 SPA 배포 모델과 다름 |
| Wouter | 가볍지만 보호 라우트, 중첩 라우팅, 대규모 생태계 측면에서 React Router가 안정적 |
| 상태만으로 화면 전환 | URL 공유, 새로고침 복원, 브라우저 히스토리 관리가 약해짐 |

### 4.4 Zustand를 쓴 이유

**선택 이유**

- store 정의가 간단하고 보일러플레이트가 적습니다.
- selector로 필요한 조각만 구독할 수 있어 불필요한 리렌더를 줄일 수 있습니다.
- `persist` middleware로 사이드바, 최근 선택 문서 같은 UI 선호값을 localStorage에 쉽게 저장합니다.
- 서버 상태는 TanStack Query가 담당하므로 Redux처럼 큰 전역 상태 관리가 필요하지 않습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| React Context만 사용 | 값 변경 시 provider 하위가 넓게 리렌더될 수 있고 store 분리가 번거로움 |
| Redux Toolkit | 강력하지만 이 프로젝트의 로컬 UI 상태 규모에는 보일러플레이트가 큼 |
| Recoil/Jotai | atom 모델은 유연하지만 팀/면접 설명에서 Zustand의 단순 store 모델이 더 명확 |
| MobX | 자동 반응성은 강하지만 명시적 상태 흐름을 보여주기에는 Zustand가 더 단순 |

### 4.5 TanStack Query를 쓴 이유

**선택 이유**

- 서버 상태의 로딩, 에러, 캐시, 재검증, retry를 표준화합니다.
- mutation 성공 후 `setQueryData`와 `invalidateQueries`로 UX 즉시 반영과 서버 재검증을 함께 처리합니다.
- 메시지 히스토리는 `useInfiniteQuery`로 cursor 기반 페이지네이션을 구현하기 쉽습니다.
- Supabase Realtime 이벤트를 받았을 때 query key 기준으로 캐시 무효화하기 좋습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| `useEffect` + `useState` 직접 fetch | 캐시, retry, 중복 요청 방지, invalidation을 직접 구현해야 함 |
| Redux Toolkit Query | Redux를 함께 도입해야 하고 현재 전역 상태 규모에는 무거움 |
| SWR | 간단한 fetch 캐시에는 좋지만 mutation/infinite query/query key 체계는 TanStack Query가 더 풍부 |
| Apollo Client | GraphQL 중심 도구라 Supabase REST/query builder 구조와 맞지 않음 |

### 4.6 Supabase를 쓴 이유

**선택 이유**

- Auth, Postgres, RLS, Realtime을 하나의 플랫폼에서 사용할 수 있습니다.
- 프론트는 anon key로 RLS 정책 안에서 안전하게 데이터를 조회하고, 서버는 service role key를 사용해 초대 참여 같은 신뢰 작업을 처리합니다.
- Postgres schema와 RLS SQL을 repo에 두어 데이터 계약을 명시할 수 있습니다.
- 포트폴리오에서 “인증 + 권한 + DB + realtime invalidation”을 빠르게 보여주기 좋습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| Firebase | realtime DB는 강력하지만 SQL/RLS/Postgres 기반 관계 모델 설명에는 Supabase가 더 적합 |
| 직접 Express + PostgreSQL + Auth 구현 | 학습 가치는 있지만 인증/권한/토큰 관리 구현 비용이 커짐 |
| Prisma + PostgreSQL | 서버 중심 CRUD에는 좋지만 프론트에서 RLS 기반 직접 조회와 Supabase Auth 통합 장점이 줄어듦 |
| Hasura | GraphQL 권한/스키마는 강력하지만 프로젝트 규모 대비 운영 복잡도가 큼 |

### 4.7 Yjs를 쓴 이유

**선택 이유**

- CRDT 기반이라 여러 사용자가 동시에 문서를 수정해도 충돌을 자동 병합할 수 있습니다.
- Tiptap Collaboration 확장과 자연스럽게 연결됩니다.
- awareness 기능으로 presence를 구현할 수 있습니다.
- 채팅 room과 문서 room을 같은 WebSocket/Yjs 인프라로 관리할 수 있습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| 단순 WebSocket 이벤트 | 동시 편집 충돌 해결, 오프라인/재동기화 로직을 직접 구현해야 함 |
| Operational Transform 직접 구현 | Google Docs류 알고리즘을 직접 구현하는 비용과 위험이 큼 |
| Automerge | CRDT 라이브러리지만 Tiptap/Yjs 생태계와 예제가 더 직접적 |
| Liveblocks | 완성형 협업 플랫폼이지만 외부 SaaS 의존도가 커지고 백엔드/권한 설계 역량을 보여주기 어려움 |
| Supabase Realtime만 사용 | DB row 변경 이벤트에는 좋지만 rich text 동시 편집 상태 병합에는 부적합 |

### 4.8 Tiptap을 쓴 이유

**선택 이유**

- ProseMirror 기반이라 rich text 문서 모델이 강력합니다.
- React hook인 `useEditor`와 `EditorContent`로 React 컴포넌트에 붙이기 쉽습니다.
- StarterKit, Placeholder, Collaboration 확장을 조합해 빠르게 에디터 기능을 만들 수 있습니다.
- 슬래시 명령, toolbar, 문서 링크, 태그 인사이트 같은 확장을 직접 구현하기 좋습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| textarea/contenteditable 직접 구현 | 제목, 리스트, 코드블록, 협업 편집을 직접 구현해야 해 비용이 큼 |
| ProseMirror 직접 사용 | 가장 강력하지만 React 통합과 확장 구성 보일러플레이트가 큼 |
| Slate | 유연하지만 공동 편집/Yjs 통합은 Tiptap 쪽이 더 바로 쓰기 좋음 |
| Lexical | 성능과 구조가 좋지만 이 프로젝트에서는 Tiptap + Yjs Collaboration 조합이 더 빠른 구현에 적합 |
| Quill | 기본 에디터로는 쉽지만 Notion/Obsidian-lite 확장성과 협업 모델 설명에는 Tiptap이 더 적합 |

### 4.9 plain CSS를 쓴 이유

**선택 이유**

- `src/styles.css`에서 CSS custom properties로 색상, radius, shadow, spacing 기준을 직접 통제합니다.
- 포트폴리오 프로젝트에서 디자인 토큰과 반응형 구조를 숨기지 않고 보여줄 수 있습니다.
- Tailwind 클래스가 과도하게 길어지는 문제나 CSS-in-JS 런타임 비용을 피했습니다.

**대안과 미채택 이유**

| 대안 | 사용하지 않은 이유 |
| --- | --- |
| Tailwind CSS | 빠른 스타일링은 장점이지만 이 프로젝트는 커스텀 workbench UI를 CSS 변수 중심으로 보여주는 것이 더 명확 |
| styled-components / Emotion | 동적 스타일에는 좋지만 런타임 스타일 주입과 추가 의존성이 생김 |
| CSS Modules | 충돌 방지는 좋지만 현재 규모에서는 단일 디자인 시스템 CSS가 더 단순 |
| UI 컴포넌트 라이브러리 | 빠르지만 SyncSpace만의 split workbench/에디터 UI를 직접 구현한 근거가 약해짐 |

---

## 5. React 관련 심층 면접 예상 질문과 모범 답변

### Q1. 이 프로젝트의 React 아키텍처를 한 문장으로 설명해보세요.

**모범 답변**  
SyncSpace는 React Router로 URL 기반 화면 구조를 만들고, Zustand/TanStack Query/Yjs로 상태 책임을 분리한 실시간 협업 SPA입니다. 로컬 UI 상태는 Zustand, DB에서 온 서버 상태는 TanStack Query, 동시 편집과 presence는 Yjs가 담당하도록 나눠서 상태가 섞이지 않게 설계했습니다.

**꼬리 질문 포인트**

- 왜 상태를 하나의 전역 store에 넣지 않았는가?
- 어떤 상태가 source of truth인가?

---

### Q2. React SPA로 만든 이유는 무엇이고, Next.js를 쓰지 않은 이유는 무엇인가요?

**모범 답변**  
SyncSpace의 핵심은 SEO나 서버 렌더링이 아니라 로그인 이후의 실시간 협업 경험입니다. 채팅, 에디터, presence, WebSocket provider는 대부분 클라이언트에서 동작해야 합니다. 그래서 Vite 기반 SPA가 더 단순하고 배포도 정적 프론트 + 별도 WebSocket 백엔드로 명확히 분리됩니다. Next.js를 쓰면 SSR, RSC, API Route 같은 장점은 있지만, 이 프로젝트에서는 WebSocket 장기 연결 서버를 별도로 운영해야 하므로 프레임워크 복잡도가 늘어납니다.

---

### Q3. `React.StrictMode`를 사용하는 이유는 무엇인가요?

**모범 답변**  
`src/main.tsx`에서 `React.StrictMode`로 앱을 감싸고 있습니다. 개발 환경에서 effect나 lifecycle 관련 부작용을 더 빨리 발견하기 위해서입니다. 특히 이 프로젝트는 WebSocket provider, Supabase auth subscription, event listener처럼 cleanup이 중요한 코드가 많습니다. StrictMode에서 effect cleanup이 제대로 되어야 중복 연결, 중복 구독, memory leak을 줄일 수 있습니다.

---

### Q4. `lazy`와 `Suspense`를 라우트에 적용한 이유는 무엇인가요?

**모범 답변**  
라우트별 코드 스플리팅을 위해 적용했습니다. 로그인 페이지, 계약 문서, 워크스페이스, workbench shell은 처음 랜딩 페이지를 볼 때 모두 필요하지 않습니다. `React.lazy`와 `Suspense`로 필요한 라우트에 진입할 때 chunk를 불러오면 초기 번들 부담을 줄일 수 있습니다. `vite.config.ts`의 manualChunks와 함께 vendor chunk 캐싱 전략도 설명할 수 있습니다.

---

### Q5. `ProtectedAppRoute` 구조를 설명해보세요.

**모범 답변**  
`ProtectedAppRoute`는 `AppProviders` 안에 `ProtectedRoute`를 넣는 구조입니다. `AppProviders`는 QueryProvider, AuthBootstrap, 서버 상태 realtime bridge를 제공합니다. `ProtectedRoute`는 auth store의 session과 loading 상태를 보고 로그인하지 않은 사용자를 `/auth/login`으로 보냅니다. 인증이 필요한 앱 영역에만 provider를 적용해 랜딩 페이지는 가볍게 유지하고, 로그인 이후에는 Query와 auth bootstrap이 동작하도록 했습니다.

---

### Q6. `useEffect`에서 `alive` 플래그를 쓰는 이유는 무엇인가요?

**모범 답변**  
비동기 요청이 끝나기 전에 컴포넌트가 unmount될 수 있기 때문입니다. 예를 들어 auth session을 가져오는 동안 사용자가 페이지를 이동하면, 완료된 Promise가 unmount된 컴포넌트의 상태를 바꾸려고 할 수 있습니다. `alive` 플래그를 cleanup에서 false로 바꾸면 이런 stale update를 막을 수 있습니다. WebSocket이나 Supabase subscription도 cleanup에서 반드시 해제합니다.

---

### Q7. Zustand와 TanStack Query를 같이 쓰는 이유는 무엇인가요?

**모범 답변**  
두 라이브러리가 담당하는 상태의 성격이 다릅니다. Zustand는 브라우저 UI 상태처럼 서버와 무관하고 즉시 바뀌는 상태에 적합합니다. TanStack Query는 서버에서 가져온 데이터처럼 캐싱, stale time, refetch, mutation, error/retry가 필요한 상태에 적합합니다. 모든 상태를 Zustand에 넣으면 서버 캐시 정책을 직접 구현해야 하고, 모든 상태를 TanStack Query에 넣으면 사이드바나 draft 같은 UI 상태까지 query cache에 넣는 부자연스러운 구조가 됩니다.

---

### Q8. Redux Toolkit을 쓰지 않고 Zustand를 쓴 이유는 무엇인가요?

**모범 답변**  
Redux Toolkit은 큰 앱에서 action, reducer, devtools, middleware 체계를 갖추기에 좋습니다. 하지만 SyncSpace의 전역 클라이언트 상태는 사이드바, 선택 ID, draft, presence UI처럼 작은 단위입니다. 서버 상태는 TanStack Query가 이미 담당하고 있기 때문에 Redux의 장점이 크게 필요하지 않았습니다. Zustand는 store 정의가 간단하고 selector로 필요한 값만 구독할 수 있어 이 프로젝트 규모에 더 적합했습니다.

---

### Q9. React Context만으로 전역 상태를 관리하지 않은 이유는 무엇인가요?

**모범 답변**  
Context는 theme, auth provider처럼 read-heavy 값 전달에는 좋지만, 자주 바뀌는 상태를 넣으면 provider 아래 컴포넌트가 넓게 영향을 받을 수 있습니다. SyncSpace는 입력 draft, presence, 선택된 문서 ID처럼 자주 바뀌는 상태가 있습니다. Zustand는 selector 기반 구독으로 필요한 컴포넌트만 업데이트할 수 있고, persist middleware도 쉽게 쓸 수 있어 Context보다 적합했습니다.

---

### Q10. TanStack Query의 query key 설계는 어떻게 되어 있나요?

**모범 답변**  
워크스페이스 관련 query key는 `workspaceKeys`로 모아두었습니다. 예를 들어 전체 목록은 `['workspaces', 'list']`, 특정 워크스페이스의 채널은 `['workspaces', workspaceId, 'channels']`, 문서는 `['workspaces', workspaceId, 'documents']` 형태입니다. 이렇게 계층형 key를 쓰면 mutation 후 특정 목록만 `invalidateQueries`하거나, 전체 workspace 범위를 무효화하기 쉽습니다.

---

### Q11. `staleTime: 1_000`과 `refetchInterval: 1_500`을 둔 이유는 무엇인가요?

**모범 답변**  
이 앱은 협업 앱이라 목록 변경이 빠르게 반영되어야 합니다. Supabase Realtime으로 DB 변경 이벤트를 받아 query invalidation을 하지만, 브라우저 탭이 background 상태이거나 이벤트가 누락될 수 있습니다. 그래서 짧은 polling fallback을 둬서 eventual consistency를 보장했습니다. 다만 이 값은 데모/포트폴리오에 맞춘 공격적인 설정이므로, 실제 대규모 운영에서는 트래픽과 UX를 보고 조정해야 합니다.

---

### Q12. 메시지 목록에서 DB 히스토리와 Yjs 실시간 메시지를 합치는 이유는 무엇인가요?

**모범 답변**  
DB 히스토리는 새로 들어온 사용자가 이전 메시지를 볼 수 있게 하는 source of truth이고, Yjs 메시지는 현재 room에서 즉시 반영되는 실시간 상태입니다. 사용자가 메시지를 보내면 Yjs 배열에 즉시 push되어 UI에 보이고, 백엔드 persistence hook이 Supabase `messages` 테이블에 저장합니다. 이후 DB 히스토리와 Yjs 실시간 배열을 합칠 때 `clientId`나 `id`로 중복 제거해 같은 메시지가 두 번 보이지 않게 했습니다.

---

### Q13. Yjs를 왜 채택했나요? 단순 WebSocket으로도 가능하지 않나요?

**모범 답변**  
단순 채팅만 있으면 WebSocket 이벤트로도 충분할 수 있습니다. 하지만 이 프로젝트에는 공동 문서 편집이 있습니다. 여러 사용자가 동시에 같은 문단을 수정하면 단순 이벤트 브로드캐스트로는 충돌 해결, 순서 보장, 재동기화 로직을 직접 구현해야 합니다. Yjs는 CRDT 기반으로 동시 수정 병합을 처리하고, Tiptap Collaboration과도 잘 맞습니다. 따라서 협업 문서에는 단순 WebSocket보다 Yjs가 더 적합합니다.

---

### Q14. Supabase Realtime만으로 공동 편집을 구현하지 않은 이유는 무엇인가요?

**모범 답변**  
Supabase Realtime은 Postgres row 변경 이벤트를 구독하는 데 적합합니다. 워크스페이스 목록, 채널 목록, 문서 메타데이터 변경을 알려주는 데는 좋습니다. 하지만 rich text 문서의 동시 편집은 row 단위 update로 표현하기 어렵고, 여러 클라이언트가 동시에 저장하면 충돌이 생깁니다. 그래서 DB 변경 이벤트와 CRDT 협업 상태를 분리했습니다.

---

### Q15. Tiptap을 선택한 이유는 무엇인가요?

**모범 답변**  
Tiptap은 ProseMirror 기반이라 문서 모델이 강력하고, React에서 `useEditor`, `EditorContent`로 통합하기 쉽습니다. StarterKit으로 heading, list, code block 같은 기본 rich text 기능을 빠르게 구성할 수 있고, Collaboration 확장으로 Yjs와 연결됩니다. SyncSpace는 `/` 슬래시 명령, toolbar, `[[문서명]]`, `#태그`, 목차 rail 같은 확장이 필요했기 때문에 단순 textarea보다 Tiptap이 적합했습니다.

---

### Q16. ProseMirror를 직접 쓰지 않은 이유는 무엇인가요?

**모범 답변**  
ProseMirror는 강력하지만 직접 쓰면 schema, plugin, view, state 관리 코드가 많아집니다. 이 프로젝트의 목표는 에디터 엔진 자체를 만드는 것이 아니라 실시간 협업 앱을 구현하는 것입니다. Tiptap은 ProseMirror의 강력함을 유지하면서 React 통합과 extension 구성을 단순화해줍니다.

---

### Q17. `useMemo`를 사용하는 기준은 무엇인가요?

**모범 답변**  
SyncSpace에서는 계산 비용이 있거나 참조 안정성이 필요한 값에 제한적으로 사용합니다. 예를 들어 선택된 channel/document를 목록에서 찾는 로직, Yjs room name/ws URL 생성, 히스토리 메시지와 실시간 메시지를 합쳐 정렬하는 로직은 입력이 바뀔 때만 계산하면 됩니다. 단순한 값까지 무조건 memoization하면 오히려 코드가 복잡해지므로, 파생 데이터나 provider 의존성처럼 의미 있는 곳에만 사용했습니다.

---

### Q18. WebSocket provider를 hook으로 분리한 이유는 무엇인가요?

**모범 답변**  
Yjs 연결은 생성, 연결, 상태 읽기, cleanup, auth token 전달, reconnect 설정이 함께 필요합니다. 이를 컴포넌트에 직접 넣으면 ChatPanel과 EditorPanel이 복잡해집니다. `useYDoc`, `useYProvider`, `useConnectionStatus`, `useYAwareness`로 나누면 채팅 room과 문서 room이 같은 연결 패턴을 재사용할 수 있고, 각 hook의 책임도 명확해집니다.

---

### Q19. `disableBc: true`를 설정한 이유는 무엇인가요?

**모범 답변**  
`useYProvider`에서 같은 브라우저 내 BroadcastChannel shortcut을 끄고 모든 클라이언트가 백엔드 room을 거치도록 했습니다. 데모와 권한 검증 관점에서 “실제로 WebSocket 서버를 통해 동기화된다”는 것을 보장하고, 놓친 업데이트를 `resyncInterval`로 회복할 수 있게 하기 위한 선택입니다.

---

### Q20. 메시지 전송에서 optimistic UI는 어떻게 동작하나요?

**모범 답변**  
메시지를 보내면 먼저 Yjs 배열에 메시지를 push합니다. 이때 `clientId`를 부여합니다. UI는 Yjs 배열을 구독하고 있으므로 즉시 메시지가 보입니다. 백엔드는 Yjs update를 감지해 Supabase `messages`에 저장하고, DB 히스토리가 다시 refetch되면 같은 `clientId`를 기준으로 중복을 제거합니다. 그래서 사용자는 빠른 전송 경험을 얻고, 최종적으로 DB에도 저장됩니다.

---

### Q21. 에러와 로딩 상태는 어떻게 처리했나요?

**모범 답변**  
Query 기반 데이터는 `isLoading`, `error`를 컴포넌트에서 명시적으로 처리합니다. 예를 들어 워크스페이스 목록은 로딩 문구와 오류 메시지를 보여주고, 채널/문서가 없으면 empty state를 보여줍니다. 인증 관련 오류는 Supabase error message를 `toAppError`와 사용자 친화적인 한국어 메시지로 변환합니다. 실시간 연결 상태는 `idle`, `connecting`, `connected`, `disconnected`로 분류해 status pill로 보여줍니다.

---

### Q22. TypeScript strict 옵션을 강하게 둔 이유는 무엇인가요?

**모범 답변**  
협업 앱은 API 응답, auth session, optional profile, nullable env, WebSocket status처럼 null/undefined 가능성이 많습니다. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`를 켜면 이런 가능성을 컴파일 타임에 드러낼 수 있습니다. 예를 들어 Supabase row를 domain type으로 매핑하는 함수에서 누락이나 optional 값을 더 신중히 다루게 됩니다.

---

### Q23. `contracts.ts` 파일의 역할은 무엇인가요?

**모범 답변**  
`src/shared/types/contracts.ts`는 프론트가 사용하는 핵심 도메인 타입을 모아둔 계약 파일입니다. `Workspace`, `Channel`, `DocumentMeta`, `ChatMessage`, `AwarenessState`, `AppError` 같은 타입이 여기에 있습니다. 백엔드에도 `server/src/types/contracts.ts`가 있어 API 응답 shape를 맞춥니다. 이상적으로는 별도 shared package로 분리해 프론트/백엔드가 같은 타입을 import하게 개선할 수 있습니다.

---

### Q24. 인증과 권한은 어떻게 처리하나요?

**모범 답변**  
프론트는 Supabase anon key로 로그인 세션을 만들고, RLS 정책에 따라 허용된 데이터만 조회합니다. 백엔드는 service role key를 서버 환경 변수로만 가지고, WebSocket 연결 시 access token을 검증하고 해당 사용자가 workspace member인지 확인합니다. production에서는 `WS_AUTH_MODE=supabase`가 기본이며, service role key가 없으면 서버가 시작되지 않도록 했습니다.

---

### Q25. 프론트에 Supabase anon key가 노출되어도 괜찮나요?

**모범 답변**  
Supabase anon key는 클라이언트에서 쓰도록 설계된 공개 키입니다. 중요한 것은 anon key 자체를 숨기는 것이 아니라, RLS 정책으로 어떤 row를 읽고 쓸 수 있는지 제한하는 것입니다. 반대로 service role key는 RLS를 우회할 수 있으므로 절대 프론트에 노출하면 안 되고, 이 프로젝트에서도 서버 환경 변수로만 사용합니다.

---

### Q26. 이 프로젝트에서 React 성능 최적화는 어떤 것이 있나요?

**모범 답변**

- 라우트 단위 `React.lazy`로 초기 로딩 chunk를 줄였습니다.
- `vite.config.ts`에서 React, Tiptap, Yjs, data vendor chunk를 나누어 캐시 효율을 높였습니다.
- Zustand selector로 필요한 store slice만 구독합니다.
- TanStack Query가 서버 요청 캐시와 중복 요청 관리를 담당합니다.
- 메시지 병합이나 문서 insight 계산처럼 파생 비용이 있는 값은 `useMemo`를 사용합니다.
- 채팅 스크롤은 하단 근처일 때만 자동 이동해 사용자가 과거 메시지를 보는 흐름을 방해하지 않습니다.

---

### Q27. 현재 구조에서 가장 조심해야 할 리렌더 포인트는 무엇인가요?

**모범 답변**  
Yjs awareness와 editor update는 자주 발생할 수 있습니다. presence store를 전역으로 갱신하거나 editor insight를 매 update마다 계산하면 리렌더가 잦아질 수 있습니다. 현재는 필요한 곳에서 상태를 분리하고 `useMemo`로 파생값을 계산하지만, 사용자 수와 문서 크기가 커지면 throttle/debounce, virtualization, selector 최적화, editor plugin 기반 계산으로 개선할 수 있습니다.

---

### Q28. 왜 UI 컴포넌트 라이브러리를 쓰지 않았나요?

**모범 답변**  
이 프로젝트는 채팅과 문서를 나란히 둔 split workbench, editor rail, presence bar처럼 앱 특화 UI가 핵심입니다. MUI나 Ant Design 같은 범용 UI 라이브러리를 쓰면 빠르게 만들 수는 있지만, 포트폴리오에서 직접 설계한 UI 구조와 CSS 토큰을 보여주기 어렵습니다. 그래서 CSS 변수와 plain CSS로 디자인 시스템을 직접 구성했습니다.

---

### Q29. 접근성 측면에서 신경 쓴 부분은 무엇인가요?

**모범 답변**  
인터랙션 요소는 가능한 `button`, `input`, `a` 같은 semantic element를 사용했습니다. 아이콘 버튼에는 `aria-label`을 넣고, 모바일 패널 전환은 `role="tablist"`, `role="tab"`, `aria-selected`를 사용했습니다. 상태 메시지나 오류에는 `role="alert"` 또는 `role="status"`를 사용합니다. 또한 `:focus-visible` 스타일을 정의해 키보드 포커스가 보이도록 했습니다.

---

### Q30. 이 프로젝트의 보안상 중요한 포인트는 무엇인가요?

**모범 답변**

- Supabase RLS로 workspace member만 데이터에 접근하도록 제한합니다.
- service role key는 서버에서만 사용합니다.
- WebSocket upgrade 시 origin과 access token, workspace membership을 확인합니다.
- 초대 코드 참여 API는 Authorization header의 bearer token을 요구합니다.
- CORS allowed origins를 환경 변수로 제한합니다.
- 메시지와 이름 길이는 DB check constraint로 제한합니다.

---

### Q31. 왜 채팅 메시지 persistence를 백엔드에서 처리하나요?

**모범 답변**  
프론트가 직접 DB에 insert할 수도 있지만, 이 프로젝트는 Yjs room에 들어온 메시지를 백엔드 persistence hook이 수집해 저장합니다. 이렇게 하면 실시간 room에서 발생한 이벤트를 서버가 중앙에서 영속화할 수 있고, 중복 저장 방지도 `clientId`/`id` 기준으로 처리할 수 있습니다. 또한 WebSocket 권한 검증과 persistence 책임이 서버에 모여 운영 구조를 설명하기 쉽습니다.

---

### Q32. 문서 본문을 Supabase `documents` 테이블에 저장하지 않는 이유는 무엇인가요?

**모범 답변**  
`documents` 테이블은 제목, workspace ID, 작성자, updatedAt 같은 메타데이터를 저장합니다. 실제 rich text 본문은 Yjs document 상태입니다. 공동 편집 본문을 단순 text/json column에 계속 저장하면 동시에 편집하는 사용자의 변경을 병합하기 어렵습니다. Yjs snapshot을 저장하면 CRDT 상태 자체를 보존할 수 있어 공동 편집 모델과 더 잘 맞습니다.

---

### Q33. polling fallback이 있으면 Supabase Realtime이 필요 없지 않나요?

**모범 답변**  
둘의 목적이 다릅니다. Supabase Realtime은 변경이 발생했을 때 즉시 query invalidation을 할 수 있어 반응성이 좋습니다. polling fallback은 이벤트 누락이나 네트워크/탭 상태 문제로 캐시가 오래 stale해지는 것을 방지합니다. 즉, realtime은 빠른 반영을, polling은 회복력을 담당합니다.

---

### Q34. 이 구조에서 테스트를 추가한다면 어디부터 하겠나요?

**모범 답변**

1. 순수 함수부터 테스트합니다. 예: `roomNames`, `editorInsights`, `dedupe`, error mapping.
2. query/mutation은 Supabase client를 mock해 성공/실패와 cache update를 검증합니다.
3. WebSocket/Yjs는 integration test로 room join, message persistence, document snapshot restore를 검증합니다.
4. Playwright로 로그인, 워크스페이스 생성, 두 브라우저 협업 시나리오를 E2E로 검증합니다.

현재 repo에는 테스트 러너가 별도로 없고 `typecheck`, `vite build`, backend build가 주요 검증 명령입니다. 이후에는 Vitest와 Playwright를 추가하는 것이 자연스럽습니다.

---

### Q35. 이 프로젝트를 더 확장한다면 무엇을 개선하겠나요?

**모범 답변**

- 프론트/백엔드 shared contract를 별도 workspace package로 분리합니다.
- 문서 snapshot persistence를 파일 기반에서 S3/R2 같은 durable object storage로 옮깁니다.
- 메시지/문서 room에 rate limit과 abuse 방어를 추가합니다.
- 큰 채팅방에는 virtualization을 적용합니다.
- editor insight 계산을 throttle하거나 plugin 기반으로 최적화합니다.
- Vitest, Testing Library, Playwright를 추가해 자동화 테스트를 강화합니다.
- production observability를 위해 WebSocket 연결 수, room 수, persistence 실패율 metric을 수집합니다.

---

## 6. 면접에서 강조하면 좋은 “설계 의도” 문장

아래 문장들은 답변 중간에 자연스럽게 넣기 좋습니다.

- “이 프로젝트의 핵심은 실시간 앱에서 모든 상태를 하나로 몰아넣지 않고 성격별로 나눈 것입니다.”
- “서버 상태는 캐시와 재검증이 중요하므로 TanStack Query에 맡겼고, 로컬 UI 상태는 Zustand로 가볍게 관리했습니다.”
- “문서 공동 편집은 단순 WebSocket 이벤트가 아니라 충돌 병합이 필요하기 때문에 Yjs를 선택했습니다.”
- “Supabase Realtime은 DB 변경 감지용이고, Yjs는 협업 room 상태용입니다. 두 실시간 시스템의 책임이 다릅니다.”
- “Next.js 대신 Vite SPA를 선택한 이유는 SEO보다 로그인 이후 WebSocket 중심 상호작용이 핵심이기 때문입니다.”
- “RLS와 WebSocket membership 검증을 모두 둬서 DB 접근과 realtime room 접근을 각각 보호했습니다.”
- “Tiptap을 선택한 이유는 ProseMirror의 강력한 문서 모델을 React와 Yjs에 빠르게 연결할 수 있기 때문입니다.”

---

## 7. 파일 근거로 설명할 때 참고할 위치

| 설명 주제 | 파일 |
| --- | --- |
| React entry, StrictMode | `src/main.tsx` |
| 라우터, lazy loading | `src/app/router/router.tsx` |
| 보호 라우트 | `src/app/router/ProtectedRoute.tsx`, `src/app/router/ProtectedAppRoute.tsx` |
| Provider와 auth bootstrap | `src/app/providers/AppProviders.tsx`, `src/app/providers/QueryProvider.tsx` |
| Zustand store | `src/shared/stores/*.ts` |
| Query key와 server state | `src/features/**/queries/*.ts` |
| Supabase client | `src/shared/api/supabaseClient.ts` |
| 실시간 DB invalidation | `src/features/realtime/useServerStateRealtime.ts` |
| Yjs provider hook | `src/features/realtime/useYProvider.ts` |
| Yjs document 생성 | `src/features/realtime/useYDoc.ts` |
| awareness/presence | `src/features/realtime/useYAwareness.ts`, `src/features/presence/*` |
| 채팅 realtime | `src/features/chat/realtime/useYChatRoom.ts` |
| 채팅 UI와 dedupe | `src/features/chat/components/ChatPanel.tsx` |
| 에디터 realtime | `src/features/editor/realtime/useYEditorRoom.ts` |
| Tiptap editor | `src/features/editor/hooks/useCollaborativeEditor.ts` |
| 슬래시 명령 | `src/features/editor/components/SlashCommandMenu.tsx`, `src/features/editor/components/EditorPanel.tsx` |
| 문서 insight | `src/features/editor/utils/editorInsights.ts` |
| WebSocket 서버 | `server/src/realtime/setupYWebsocket.ts` |
| 채팅 persistence | `server/src/realtime/chatRoom.ts`, `server/src/persistence/messagePersistence.ts` |
| 문서 snapshot persistence | `server/src/realtime/docPersistence.ts` |
| WebSocket auth | `server/src/auth/realtimeAuth.ts` |
| DB schema/RLS | `supabase/schema.sql`, `supabase/rls.sql` |
| Vite vendor chunk | `vite.config.ts` |
| TypeScript strict 설정 | `tsconfig.json`, `server/tsconfig.json` |

---

## 8. 짧은 최종 답변 템플릿

면접에서 “기술 스택을 왜 이렇게 골랐나요?”라고 물으면 다음처럼 답변할 수 있습니다.

> SyncSpace는 실시간 협업 앱이라 상태의 성격을 나누는 것이 가장 중요했습니다. React와 Vite로 SPA를 빠르게 구성하고, React Router로 workspace/channel/document URL을 표현했습니다. 로컬 UI 상태는 Zustand가 담당하고, Supabase에서 가져오는 서버 상태는 TanStack Query가 캐싱과 재검증을 담당합니다. 문서와 채팅의 실시간 동기화는 단순 WebSocket 이벤트보다 충돌 병합이 중요해서 Yjs를 사용했고, 에디터는 Yjs Collaboration과 잘 맞는 Tiptap을 선택했습니다. Supabase는 Auth, Postgres, RLS, Realtime을 한 번에 제공해 포트폴리오 규모에서 인증과 권한을 빠르게 구축할 수 있었습니다. Next.js나 Redux도 선택할 수 있었지만, 이 프로젝트에서는 SEO/SSR이나 대규모 action reducer 구조보다 클라이언트 실시간 협업과 상태 책임 분리가 핵심이어서 Vite SPA, Zustand, TanStack Query, Yjs 조합이 더 적합했습니다.
