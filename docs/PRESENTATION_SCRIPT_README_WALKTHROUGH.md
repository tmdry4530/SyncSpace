# SyncSpace README 기준 발표 대본

이 대본은 현재 루트 `README.md`를 화면에 띄워두고 위에서부터 내려가며 발표하는 흐름을 기준으로 작성했다. 발표의 중심은 **React 앱 구조**, **상태 책임 분리**, **워크벤치 UX**, **실시간 협업 설계**다. Backend는 React 앱을 보조하는 HTTP/WebSocket 인프라로 설명한다.

## 0. 시작 멘트

안녕하세요. 제가 발표할 프로젝트는 **SyncSpace**입니다.

SyncSpace는 **채팅으로 결정하고, 같은 워크스페이스의 문서에 바로 정리하는 React 실시간 협업 워크벤치**입니다.

일반적인 협업 도구에서는 채팅은 채팅대로, 문서는 문서대로 분리되어 있어서 대화에서 나온 결정을 다시 문서로 옮기는 과정이 끊기는 경우가 많습니다. SyncSpace는 이 흐름을 하나의 화면에 묶었습니다.

왼쪽에서는 채널 채팅을 보고, 오른쪽에서는 같은 워크스페이스의 문서를 바로 편집할 수 있습니다. 그래서 이 프로젝트의 핵심은 단순 CRUD가 아니라, **대화와 문서화가 동시에 일어나는 React workbench 구조**입니다.

제가 이 프로젝트에서 가장 강조하고 싶은 부분은 React 앱 안에서 상태를 한곳에 몰아넣지 않고, 상태의 성격에 맞게 나누어 설계했다는 점입니다.

## 1. 프로젝트 개요

README 상단에 정리한 것처럼 SyncSpace는 세 가지 상태를 분리합니다.

첫 번째는 **Zustand**입니다.

Zustand는 사이드바가 접혀 있는지, 현재 선택된 워크스페이스와 채널, 문서가 무엇인지, 채팅 draft가 무엇인지 같은 **로컬 UI 상태**를 담당합니다.

두 번째는 **TanStack Query**입니다.

TanStack Query는 워크스페이스 목록, 채널 목록, 문서 목록, 메시지 히스토리처럼 서버에서 가져오고 캐싱해야 하는 **서버 상태**를 담당합니다.

세 번째는 **Yjs와 y-websocket**입니다.

Yjs는 채팅 room, 문서 room, presence 같은 여러 브라우저 사이에서 동기화되어야 하는 **실시간 협업 상태**를 담당합니다.

여기에 Supabase는 인증, Postgres, RLS, 그리고 서버 상태 변경을 감지하는 realtime invalidation 역할을 합니다.

정리하면, 이 프로젝트는 React에서 다루는 상태를 **UI state, server state, realtime collaboration state**로 나누고, 각각에 맞는 도구를 선택한 구조입니다.

## 2. Live 섹션

README의 Live 섹션에는 배포된 앱 주소가 있습니다.

```txt
https://sync-space-green.vercel.app/
```

발표에서는 README로 구조를 설명한 뒤, 실제 앱 화면에서 워크스페이스에 들어가 채팅과 문서가 한 화면에 배치되는 흐름을 보여주면 됩니다.

## 3. 주요 기능 설명

README의 주요 기능 표를 보면 이 프로젝트의 사용자 경험을 빠르게 볼 수 있습니다.

첫 번째는 **Split Workbench**입니다.

왼쪽에는 채팅, 오른쪽에는 문서가 있고, 두 영역이 같은 워크스페이스 맥락 안에서 동시에 보입니다. 사용자는 채팅에서 나온 결정을 바로 오른쪽 문서에 정리할 수 있습니다.

두 번째는 **Workspace Navigation**입니다.

현재 워크스페이스, 채널, 문서 선택 상태를 URL과 Zustand store로 함께 관리합니다. 그래서 새로고침하거나 링크로 들어와도 사용자가 보고 있던 작업 맥락을 복원할 수 있습니다.

세 번째는 **Channel Chat**입니다.

이전 메시지는 TanStack Query로 서버에서 가져오고, 새 메시지는 Yjs room을 통해 실시간으로 반영합니다. 즉 저장된 히스토리와 실시간 업데이트를 함께 다룹니다.

네 번째는 **Collaborative Editor**입니다.

Tiptap editor와 Yjs Collaboration extension을 연결해서 여러 사용자가 같은 문서를 동시에 편집할 수 있게 했습니다.

다섯 번째는 **Presence Summary**입니다.

워크벤치 상단 command bar에서 워크스페이스 접속 상태와 접속 인원을 요약해 보여줍니다. 이 상태는 개별 채팅 room과 문서 room이 모두 같은 상태여야만 켜지는 값이 아니라, 워크스페이스 화면에서 실시간 작업이 가능한지를 보여주는 요약입니다.

여섯 번째는 **Document Links**입니다.

문서 안에서 `[[문서명]]` 문법을 쓰면 같은 워크스페이스의 문서 링크 후보로 인식합니다. 링크 이동은 React Router의 `Link`를 사용해서 전체 페이지 reload 없이 workbench 안에서 문서만 전환되도록 했습니다.

마지막으로 **Responsive Sidebar**입니다.

사이드바는 펼친 상태, 접힌 상태, tablet 좌측 rail, mobile drawer 상태를 모두 지원합니다. 최근에는 사이드바 톤도 메인 workbench 카드와 맞춰서 밝은 surface 기반 디자인으로 정리했습니다.

## 4. 기술 스택

프론트엔드는 **React 19, TypeScript, Vite 8**을 사용했습니다.

라우팅은 **React Router 7**을 사용합니다.

상태 관리는 앞에서 말한 것처럼 세 가지로 나눴습니다.

- Local UI State는 Zustand
- Server State는 TanStack Query
- Realtime Collaboration은 Yjs와 y-websocket

Editor는 Tiptap StarterKit, Placeholder, Collaboration extension을 사용했습니다.

Backend는 Node.js 기반 HTTP/WebSocket server입니다. WebSocket에는 `ws`, 개발 실행에는 `tsx`, Yjs 서버 연동에는 `@y/websocket-server`를 사용합니다.

데이터베이스와 인증은 Supabase Auth, Postgres, RLS를 사용합니다.

이 프로젝트는 pnpm workspace 형태이고, Node.js는 22.x를 권장합니다.

## 5. 화면 구조

README의 화면 구조 다이어그램을 보면 전체 UI가 어떻게 조립되는지 볼 수 있습니다.

가장 바깥에는 **Workspace Shell**이 있습니다.

Workspace Shell 안에는 세 가지 큰 영역이 있습니다.

첫 번째는 **Workspace Header**입니다.

여기에는 워크스페이스 이름, 초대 코드 액션, 계정과 워크스페이스 이동 액션이 있습니다.

두 번째는 **Sidebar**입니다.

Sidebar에는 워크스페이스 홈, 채널 목록, 문서 목록, 그리고 각각의 생성 버튼이 있습니다. 접힌 상태에서도 채널과 문서 구분이 가능하도록 라벨과 색상을 다르게 했고, tablet 크기에서는 상단 넓은 바가 아니라 좌측 rail로 유지되도록 했습니다.

세 번째는 **Split Workbench**입니다.

Workbench 상단에는 command bar가 있고, 여기서 현재 채널과 문서 이름, 실시간 연결 상태, 접속 인원 요약을 보여줍니다.

그 아래에는 Chat Panel과 Document Panel이 나란히 배치됩니다.

여기서 중요한 점은 패널 내부 header에는 `채팅`, `문서`만 표시하고, 채널명과 문서명, 접속자 정보는 command bar에서 한 번만 보여준다는 것입니다. 이렇게 해서 화면의 정보 계층을 정리했습니다.

## 6. 라우팅 구조

README의 라우팅 섹션에는 주요 경로가 정리되어 있습니다.

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

이 프로젝트에서 중요한 경로는 `/w/:workspaceId/ch/:channelId/doc/:documentId`입니다.

이 경로는 하나의 워크스페이스 안에서 특정 채널과 특정 문서를 동시에 선택한 상태를 나타냅니다.

예를 들어 사용자가 `general` 채널을 보면서 `회의록` 문서를 편집하고 있다면, 이 두 선택이 URL에 함께 들어갑니다. 그래서 링크 공유나 새로고침 후에도 작업 맥락을 유지할 수 있습니다.

또 하나 중요한 점은 내부 이동에는 일반 `<a href>`가 아니라 React Router의 `Link`와 `NavLink`를 사용한다는 것입니다.

이렇게 해야 같은 앱 안에서 문서만 전환할 때 전체 브라우저 reload나 불필요한 remount를 피할 수 있습니다.

## 7. 상태 관리 설계

이 프로젝트의 핵심 설계는 상태 관리 분리입니다.

React UI 안에서 모든 상태를 하나의 전역 store에 넣지 않았습니다.

먼저 **Zustand**는 UI 조작 상태를 담당합니다.

사이드바 접힘 여부, 현재 선택된 workspace/channel/document, 채팅 입력 draft, presence UI cache 같은 값은 서버 데이터라기보다 화면 조작 상태입니다. 이런 값은 Zustand가 단순하고 빠르게 관리합니다.

다음으로 **TanStack Query**는 서버 상태를 담당합니다.

워크스페이스 목록, 채널 목록, 문서 목록, 저장된 메시지 히스토리처럼 서버에서 가져오고 loading/error/refetch/cache가 필요한 데이터는 TanStack Query가 관리합니다.

마지막으로 **Yjs**는 실시간 협업 상태를 담당합니다.

채팅 메시지의 실시간 반영, 문서 공동 편집, awareness/presence는 여러 브라우저 사이에서 동시에 동기화되어야 하기 때문에 Yjs room이 소유합니다.

이렇게 나누면 React 컴포넌트가 UI state, server cache, WebSocket sync를 한곳에서 모두 처리하지 않아도 됩니다.

## 8. Realtime room 규칙

Realtime room은 채팅과 문서가 분리되어 있습니다.

채팅 room은 다음 형식입니다.

```txt
chat:{workspaceId}:{channelId}
```

문서 room은 다음 형식입니다.

```txt
doc:{workspaceId}:{documentId}
```

채팅과 문서를 같은 room에 넣지 않은 이유는 두 기능의 데이터 구조와 lifecycle이 다르기 때문입니다.

채팅은 메시지 단위 이벤트가 중요하고, 문서는 editor document state가 중요합니다.

그래서 room을 분리하면 채팅과 문서의 동기화 흐름을 독립적으로 관리할 수 있고, 한쪽의 연결이나 데이터 문제가 다른 쪽에 직접 영향을 주지 않게 할 수 있습니다.

다만 사용자에게 보이는 workbench 상단 상태는 개별 room 상태를 모두 엄격하게 합친 값이 아닙니다. 사용자는 “워크스페이스에 접속했는지”를 보고 싶어 하기 때문에, command bar에서는 workspace-level 실시간 작업 가능 상태로 요약합니다.

## 9. 문서 편집 경험

문서 편집은 toolbar 중심이 아니라 Markdown과 shortcut 중심으로 설계했습니다.

처음에는 글쓰기 도구 버튼이 있었지만, Markdown 문법으로 바로 적용되는 흐름과 중복되어 제거했습니다.

현재는 `/` 슬래시 명령을 통해 제목, 목록, 인용, 코드, 구분선 등을 삽입할 수 있습니다.

또 `[[문서명]]` 문법을 쓰면 같은 워크스페이스 안의 문서 링크 후보로 인식합니다.

`#태그`도 knowledge rail에서 수집합니다.

문서 링크를 클릭하면 현재 채널이 있는 경우 workbench route를 유지한 채 문서만 전환합니다. 예를 들어 현재 채널이 선택되어 있으면 `/w/:workspaceId/ch/:channelId/doc/:documentId` 형태로 이동합니다.

이렇게 해서 사용자는 채팅 맥락을 유지하면서 다른 문서로 이동할 수 있습니다.

또 본문 상단 여백과 패널 header를 줄여서, 실제 글쓰기 시작 지점이 화면 위쪽에 더 가깝게 오도록 조정했습니다.

## 10. 프로젝트 구조

README의 프로젝트 구조 섹션을 보면 frontend, backend, Supabase가 어떻게 나뉘는지 알 수 있습니다.

Frontend의 `src/app`은 provider와 router 같은 앱 전체 설정을 담당합니다.

`src/features`는 실제 기능 단위입니다.

예를 들어 `features/chat`에는 ChatPanel, MessageComposer, message query, Yjs chat room이 있고, `features/editor`에는 Tiptap editor, slash command, knowledge rail이 있습니다.

`src/shared`에는 Supabase client, backend client, Zustand store, 공통 type, utility가 있습니다.

Backend의 `server/src`는 auth, http, persistence, realtime, routes로 나뉩니다.

Supabase 폴더에는 schema, RLS, seed SQL이 있습니다.

이 구조는 Atomic Design처럼 UI 크기 기준으로 나눈 구조가 아니라, **기능 도메인 중심 구조**입니다. 채팅을 고치려면 chat feature를 보고, editor를 고치려면 editor feature를 보면 되는 방식입니다.

## 11. Backend 역할

Backend는 React 앱을 보조하는 HTTP/WebSocket 인프라입니다.

HTTP 쪽에는 health check, readiness check, workspace 생성, 삭제, 초대 코드 참여 API가 있습니다.

WebSocket 쪽에는 문서 room과 채팅 room이 있습니다.

문서 WebSocket은 다음 형태입니다.

```txt
ws://<server>/doc/:workspaceId/:documentId
```

채팅 WebSocket은 다음 형태입니다.

```txt
ws://<server>/chat/:workspaceId/:channelId
```

중요한 점은 `SUPABASE_SERVICE_ROLE_KEY` 같은 민감한 키를 frontend에 넣지 않는다는 것입니다.

워크스페이스 생성, 초대 참여, 삭제처럼 service-role 권한이 필요한 작업은 backend에서 처리합니다.

만약 service-role key가 없는 local 환경이라면 일부 기능은 비활성화되고, 서버 로그에 해당 경고가 표시됩니다.

## 12. 로컬 실행

로컬 실행은 세 단계입니다.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev`를 실행하면 frontend와 backend가 함께 실행됩니다.

Frontend는 다음 주소에서 열립니다.

```txt
http://127.0.0.1:5173
```

Backend는 다음 주소에서 실행됩니다.

```txt
http://127.0.0.1:1234
```

Health check는 다음 주소입니다.

```txt
http://127.0.0.1:1234/health
```

인증이 필요한 실제 앱 흐름을 사용하려면 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_WS_URL` 같은 frontend 환경 변수가 필요합니다.

## 13. 명령어와 검증

주요 명령어는 README의 표에 정리되어 있습니다.

개발 서버는 다음 명령으로 실행합니다.

```bash
pnpm dev
```

프론트만 실행하려면 다음을 사용합니다.

```bash
pnpm dev:frontend
```

백엔드만 실행하려면 다음을 사용합니다.

```bash
pnpm dev:backend
```

검증은 보통 아래 세 가지를 기준으로 합니다.

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
```

`pnpm typecheck`는 루트와 workspace 패키지의 TypeScript 검사를 수행합니다.

`pnpm verify:frontend`는 frontend typecheck와 Vite production build를 확인합니다.

`pnpm verify:backend`는 backend lint, typecheck, build를 확인합니다.

UI 변경의 경우에는 여기에 더해 브라우저에서 직접 확인합니다. 이 프로젝트에서는 사이드바나 workbench 같은 시각 변경을 agent-browser 스크린샷으로 검증해 왔습니다.

## 14. 배포 구조

권장 배포 구조는 세 가지로 나뉩니다.

첫 번째는 **Vercel**입니다.

Vercel은 Vite React frontend를 배포합니다.

두 번째는 **Railway**입니다.

Railway는 WebSocket 연결을 유지해야 하는 Node.js backend를 실행합니다.

세 번째는 **Supabase**입니다.

Supabase는 Auth, Postgres, RLS, Realtime을 담당합니다.

운영 환경에서는 `ALLOWED_ORIGINS`를 실제 frontend origin으로 제한하고, `WS_AUTH_MODE=supabase`로 WebSocket 인증을 활성화해야 합니다.

또 `SUPABASE_SERVICE_ROLE_KEY`는 반드시 backend 환경에만 저장해야 합니다.

## 15. 구현상 주의점

README 마지막에는 구현상 주의점을 정리했습니다.

첫 번째, 내부 route 이동에는 `<a href>` 대신 React Router `Link`나 `NavLink`를 사용해야 합니다.

두 번째, workbench command bar는 workspace-level 상태 요약만 담당하고, 개별 room health는 pane 내부 관심사로 둡니다.

세 번째, sidebar의 collapsed, tablet, mobile 규칙은 `WorkspaceShell` class와 CSS media query가 함께 제어합니다.

네 번째, 문서 editor는 toolbar 중심이 아니라 Markdown과 slash command 중심입니다.

이 주의점들은 최근 실제 UI 피드백을 해결하면서 정리된 기준입니다.

## 16. 마무리 멘트

정리하면, SyncSpace는 채팅과 문서 협업을 하나의 화면에 묶은 React 실시간 협업 앱입니다.

이 프로젝트에서 가장 중요한 설계는 상태 책임 분리입니다.

Zustand는 local UI state, TanStack Query는 server state, Yjs는 realtime collaboration state를 담당합니다.

그 위에 React Router를 통해 workspace, channel, document 문맥을 URL로 유지하고, Tiptap과 Yjs를 연결해서 문서 공동 편집을 구현했습니다.

결과적으로 SyncSpace는 단순히 화면을 만든 프로젝트가 아니라, 실제 협업 앱에서 필요한 **라우팅, 상태 관리, 실시간 동기화, editor integration, responsive workbench UI**를 함께 다룬 React 프로젝트입니다.
