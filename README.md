# SyncSpace

> React 기반 실시간 협업 워크벤치

채팅에서 나온 결정사항을 같은 워크스페이스의 문서에 바로 정리하는 협업 앱입니다. 채널 채팅과 공동 문서 편집을 하나의 화면에 배치하고, UI 상태·서버 상태·실시간 협업 상태를 분리해서 구현했습니다.

## 배포 주소

- **Vercel**: https://sync-space-green.vercel.app/

## 기획 의도

대부분의 협업 흐름은 채팅에서 논의하고, 결정된 내용을 다시 문서로 옮기는 식으로 분리됩니다. 이 과정에서 맥락이 끊기거나 정리가 누락될 수 있습니다.

SyncSpace는 채팅과 문서를 같은 작업 화면에 두어, 대화 중 나온 내용을 바로 문서화할 수 있는 workbench를 목표로 만들었습니다.

## 핵심 기능

### Workbench

- 채팅 패널과 문서 패널을 한 화면에 배치
- 상단 command bar에서 현재 채널, 현재 문서, 실시간 상태를 요약
- 패널 내부는 `채팅`, `문서` 역할만 표시해 정보 중복 제거

### Workspace Navigation

- 워크스페이스 안에서 채널과 문서를 동시에 선택
- URL에 `workspaceId`, `channelId`, `documentId`를 담아 새로고침 후에도 맥락 복원
- 사이드바 접힘, tablet rail, mobile drawer 지원

### Realtime Collaboration

- Yjs 기반 채팅 room과 문서 room 분리
- Tiptap Collaboration으로 공동 문서 편집
- Supabase Realtime + polling fallback으로 서버 목록 변경 반영

### Document Writing

- `/` 슬래시 명령으로 제목, 목록, 인용, 코드, 구분선 입력
- `[[문서명]]` 문법으로 같은 워크스페이스 문서 링크 연결
- `#태그`와 제목을 분석해 knowledge rail에 표시
- 내부 문서 이동은 React Router `Link`로 처리해 전체 reload 방지

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Routing | React Router 7 |
| UI State | Zustand |
| Server State | TanStack Query |
| Realtime | Yjs, y-websocket |
| Editor | Tiptap StarterKit, Placeholder, Collaboration |
| Backend | Node.js HTTP/WebSocket server |
| Database/Auth | Supabase Auth, Postgres, RLS |
| Deploy | Vercel, Railway, Supabase |

## 아키텍처

```txt
┌───────────────────────────────────────────────────────────┐
│                        React App                          │
├───────────────────────────────────────────────────────────┤
│  WorkspaceShell                                           │
│  ├─ Sidebar        워크스페이스/채널/문서 이동              │
│  ├─ CommandBar     현재 채널·문서·실시간 상태 요약          │
│  └─ SplitWorkbench                                        │
│     ├─ ChatPanel   메시지 히스토리 + Yjs chat room          │
│     └─ EditorPanel Tiptap + Yjs document room              │
├───────────────────────┬───────────────────────────────────┤
│ Zustand               │ TanStack Query                     │
│ UI 상태               │ 서버 목록/메시지 캐시               │
├───────────────────────┴───────────────────────────────────┤
│ Yjs / y-websocket    실시간 채팅·문서·presence 동기화        │
├───────────────────────────────────────────────────────────┤
│ Node Backend          HTTP API + WebSocket upgrade          │
├───────────────────────────────────────────────────────────┤
│ Supabase              Auth + Postgres + RLS + Realtime      │
└───────────────────────────────────────────────────────────┘
```

### Workbench 흐름

1. 사용자가 워크스페이스에 진입한다.
2. 사이드바에서 채널과 문서를 선택한다.
3. URL이 `/w/:workspaceId/ch/:channelId/doc/:documentId` 형태로 갱신된다.
4. ChatPanel은 `chat:{workspaceId}:{channelId}` room에 연결된다.
5. EditorPanel은 `doc:{workspaceId}:{documentId}` room에 연결된다.
6. 사용자는 채팅을 보면서 오른쪽 문서에 바로 정리한다.

## 핵심 구현 포인트

### 1. 상태 책임 분리

모든 상태를 하나의 전역 store에 넣지 않고 성격에 따라 분리했습니다.

```txt
Zustand         sidebar, current channel/document, draft
TanStack Query  workspaces, channels, documents, messages
Yjs             chat room, document room, awareness
```

이 구조 덕분에 컴포넌트가 UI 조작, 서버 캐시, WebSocket 동기화를 한꺼번에 처리하지 않습니다.

### 2. 채널과 문서를 함께 유지하는 라우팅

채널과 문서를 별도 페이지로 완전히 분리하지 않고, workbench route 안에서 함께 유지합니다.

```txt
/w/:workspaceId/ch/:channelId/doc/:documentId
```

문서를 바꿔도 채널 맥락이 유지되고, 채널을 바꿔도 현재 문서를 유지할 수 있습니다.

### 3. Chat room / Doc room 분리

```txt
chat:{workspaceId}:{channelId}
doc:{workspaceId}:{documentId}
```

채팅은 메시지 중심이고 문서는 편집 문서 상태 중심이기 때문에 room을 분리했습니다. 대신 사용자에게 보이는 workbench 상단 상태는 workspace-level 실시간 작업 가능 상태로 요약합니다.

### 4. 문서 링크는 Router Link로 이동

`[[문서명]]`으로 감지된 문서 링크는 일반 `<a href>`가 아니라 React Router `Link`로 이동합니다.

```tsx
<Link to={routes.workbench(workspaceId, channelId, documentId)}>
  문서 제목
</Link>
```

이렇게 해서 문서 이동 시 전체 페이지 reload나 불필요한 remount를 피하고, workbench 맥락을 유지합니다.

### 5. Markdown-first editor

문서 편집은 toolbar보다 Markdown과 shortcut 중심으로 설계했습니다.

- `/` 명령으로 블록 삽입
- `[[문서명]]`으로 문서 연결
- `#태그`로 문맥 표시
- knowledge rail에서 제목, 링크, 태그 요약

## 실행 방법

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

## 검증 명령

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm verify:all
```

## 라이선스

Portfolio project.
