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
| Test | Vitest, Playwright |
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

프론트와 백엔드는 `docs/contracts/API_CONTRACT_FIRST.md`를 기준으로 맞춥니다.

- Supabase table shape
- RLS policy rule
- WebSocket room naming
- REST endpoint contract
- Presence payload

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
│  ├─ src/
│  │  ├─ auth/              # realtime auth guard
│  │  ├─ http/              # HTTP app
│  │  ├─ persistence/       # Supabase adapters
│  │  ├─ realtime/          # chat/doc room setup
│  │  └─ routes/            # REST routes
│  └─ tests/
├─ supabase/               # schema, RLS, seed
├─ e2e/                    # Playwright scenarios
└─ docs/                   # contracts, reports, implementation notes
```

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

## 검증 명령

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm test:e2e
```

인증이 필요한 E2E는 테스트 계정 환경 변수를 사용합니다.

```bash
E2E_USER1_EMAIL=... \
E2E_USER1_PASSWORD=... \
E2E_USER2_EMAIL=... \
E2E_USER2_PASSWORD=... \
E2E_WORKBENCH_URL=http://127.0.0.1:5173/w/... \
pnpm exec playwright test e2e/workbench.spec.ts --project=chromium
```

## 발표에서 강조할 차별점

### 단순 UI 구현이 아니라 상태 설계를 보여준다

많은 React 포트폴리오가 CRUD 중심으로 끝나지만, SyncSpace는 세 종류의 상태를 분리해 실제 협업 앱에서 자주 만나는 복잡도를 다룹니다.

### 실시간 협업을 직접 다룬다

Yjs document room, chat room, awareness, WebSocket persistence adapter를 직접 구성했습니다. 새로고침 없이 다른 브라우저에 채팅과 문서 변경이 반영됩니다.

### 보안과 계약을 같이 고려했다

Supabase RLS, service role server-only 원칙, API contract 문서를 기준으로 프론트와 백엔드 경계를 분리했습니다.

### 리뷰어가 이해하기 쉬운 화면 구조다

워크스페이스 화면은 채팅과 문서를 동시에 보여줍니다. 발표 중 “대화에서 결정하고 바로 문서화한다”는 제품 컨셉을 한 화면에서 설명할 수 있습니다.

## 품질 근거

현재 레포에는 구현 근거와 QA 기록이 문서로 정리되어 있습니다.

- API/UI 현황: `docs/reports/CURRENT_API_AND_UI_REPORT.md`
- UI/UX 감사: `docs/reports/UI_UX_WEB_QUALITY_AUDIT_2026-05-02.md`
- gstack QA 수정 리포트: `docs/reports/GSTACK_ACTUAL_FIX_REPORT_2026-05-03.md`
- gstack 디자인 리뷰: `docs/reports/GSTACK_DESIGN_REVIEW_2026-05-03.md`
- 최종 품질 리포트: `docs/reports/RALPH_HIGHEST_SCORE_REPORT_2026-05-03.md`

최종 확인된 검증 항목:

- TypeScript typecheck 통과
- frontend production build 통과
- backend test 통과
- Playwright public/mobile E2E 통과
- authenticated workbench realtime E2E 통과

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
