# SyncSpace

> 채팅에서 결정하고, 같은 워크스페이스의 문서에 바로 정리하는 실시간 협업 워크벤치

SyncSpace는 채널 채팅과 공동 문서 편집을 하나의 화면에 묶은 React 프로젝트입니다. 핵심은 채팅과 문서를 오가며 맥락을 잃지 않도록 **Split Workbench**를 만들고, 상태를 성격에 맞게 분리한 것입니다.

- **Zustand**: 사이드바, 현재 채널/문서, 입력 draft 같은 UI 상태
- **TanStack Query**: 워크스페이스, 채널, 문서, 메시지 히스토리 같은 서버 상태
- **Yjs + y-websocket**: 채팅, 문서 공동 편집, presence 같은 실시간 협업 상태
- **Supabase**: Auth, Postgres, RLS, 서버 상태 realtime invalidation

## Live

- App: https://sync-space-green.vercel.app/

## 주요 기능

- 채팅과 문서를 한 화면에 배치한 **Split Workbench**
- 워크스페이스 안에서 채널/문서를 함께 유지하는 URL 구조
- Yjs 기반 실시간 채팅과 Tiptap 공동 문서 편집
- `[[문서명]]`, `#태그`, `/` 명령을 활용한 문서 작성 흐름
- 문서 링크 클릭 시 전체 reload 없이 workbench 안에서 문서 전환
- 접힘/펼침, tablet rail, mobile drawer를 지원하는 반응형 사이드바

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Routing | React Router 7 |
| State | Zustand, TanStack Query |
| Realtime | Yjs, y-websocket |
| Editor | Tiptap StarterKit, Placeholder, Collaboration |
| Backend | Node.js HTTP/WebSocket server, TypeScript |
| Database/Auth | Supabase Auth, Postgres, RLS |

## 구조 요약

```txt
src/
├─ app/          # providers, router, protected routes
├─ pages/        # route-level pages
├─ features/     # workspace, chat, editor, realtime 등 기능 단위 코드
└─ shared/       # api client, Zustand store, type, util

server/src/
├─ http/         # health, ready, workspace API
├─ realtime/     # Yjs websocket setup
├─ persistence/  # Supabase 기반 저장/관리 로직
└─ auth/         # websocket 인증과 workspace membership 확인

supabase/
├─ schema.sql
├─ rls.sql
└─ seed.sql
```

## 핵심 설계

### 1. 한 화면에서 대화와 문서화

워크스페이스 화면은 사이드바, command bar, 채팅 패널, 문서 패널로 구성됩니다. 채널명과 문서명, 접속 상태는 상단 command bar에 모으고, 패널 안에서는 `채팅`, `문서`라는 역할만 보여줍니다.

### 2. 상태 책임 분리

서버에서 온 데이터는 TanStack Query가 관리하고, 화면 조작 상태는 Zustand가 관리합니다. 실시간 협업 상태는 Yjs room이 소유합니다. 덕분에 컴포넌트가 서버 캐시, UI 상태, WebSocket 동기화를 한곳에서 모두 처리하지 않습니다.

### 3. Room 분리

```txt
chat:{workspaceId}:{channelId}
doc:{workspaceId}:{documentId}
```

채팅과 문서는 데이터 성격이 다르기 때문에 room을 분리했습니다. 다만 사용자에게 보이는 workbench 상단 상태는 개별 room health가 아니라 workspace-level 실시간 작업 가능 상태로 요약합니다.

## 라우팅

```txt
/
/auth/login
/workspaces
/w/:workspaceId
/w/:workspaceId/ch/:channelId
/w/:workspaceId/doc/:documentId
/w/:workspaceId/ch/:channelId/doc/:documentId
/api-contract
```

내부 이동은 React Router `Link`/`NavLink`를 사용합니다. 특히 문서 링크는 현재 채널이 있으면 workbench route를 유지한 채 문서만 전환합니다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:1234`
- Health check: `http://127.0.0.1:1234/health`

인증된 앱 흐름을 확인하려면 Supabase public env가 필요합니다.

```txt
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_API_URL=http://localhost:1234
VITE_WS_URL=ws://localhost:1234
```

`SUPABASE_SERVICE_ROLE_KEY`는 backend 전용입니다. `VITE_` 환경 변수에 넣지 않습니다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | frontend/backend 동시 실행 |
| `pnpm dev:frontend` | Vite dev server 실행 |
| `pnpm dev:backend` | backend watch server 실행 |
| `pnpm typecheck` | TypeScript 검사 |
| `pnpm verify:frontend` | frontend typecheck + build |
| `pnpm verify:backend` | backend lint/typecheck/build |
| `pnpm verify:all` | 전체 검증 |

## 배포

권장 구조는 다음과 같습니다.

```txt
Vercel   → React frontend
Railway  → Node WebSocket backend
Supabase → Auth, Postgres, RLS, Realtime
```

운영 환경에서는 `ALLOWED_ORIGINS`, `WS_AUTH_MODE=supabase`, `VITE_API_URL`, `VITE_WS_URL`, Supabase schema/RLS 적용 여부를 확인해야 합니다.

## 라이선스

Portfolio project.
