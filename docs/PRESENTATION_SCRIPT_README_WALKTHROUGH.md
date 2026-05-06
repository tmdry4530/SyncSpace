# SyncSpace README 발표 대본

이 문서는 현재 `README.md`를 화면에 띄워두고 위에서부터 내려가며 발표할 때 사용할 대본이다.

발표의 중심은 **React 프론트엔드 구조**, **상태 관리 분리**, **핵심 React 로직**이다. Backend는 React 앱을 지원하는 인프라로만 짧게 설명한다.

## 0. 시작 멘트

안녕하세요. 제가 발표할 프로젝트는 **SyncSpace**입니다.

SyncSpace는 **채팅으로 결정하고, 같은 화면의 문서에 바로 정리하는 React 실시간 협업 워크벤치**입니다.

채널 채팅과 공동 문서 편집을 하나의 화면에 통합했고, React 앱 안에서 UI 상태, 서버 상태, 실시간 협업 상태를 분리해서 관리한 프로젝트입니다.

제가 이 프로젝트에서 가장 보여주고 싶은 부분은 단순히 화면을 만든 것이 아니라, React 앱에서 상태의 성격을 나누고 각 상태에 맞는 도구를 선택했다는 점입니다.

## 1. 프로젝트 소개

README 상단에 정리한 것처럼 이 프로젝트는 세 가지 상태를 분리합니다.

첫 번째는 **Zustand**입니다.

Zustand는 사이드바 상태, 현재 선택된 워크스페이스나 채널, 패널 상태처럼 서버와 상관없는 local UI state를 담당합니다.

두 번째는 **TanStack Query**입니다.

TanStack Query는 워크스페이스, 채널, 문서, 메시지 히스토리처럼 서버에서 가져오고 캐싱해야 하는 server state를 담당합니다.

세 번째는 **Yjs**입니다.

Yjs는 채팅 room, 문서 room, 공동 편집, awareness처럼 여러 브라우저 사이에서 실시간으로 동기화되어야 하는 realtime state를 담당합니다.

Backend는 이 React 앱이 인증, 저장, WebSocket 동기화를 할 수 있도록 도와주는 보조 인프라로 두었습니다.

## 2. Live 섹션

현재 배포된 주소는 README의 Live 섹션에 있습니다.

메인 앱 주소는 다음입니다.

https://sync-space-green.vercel.app/

로그인 화면과 API Contract 화면도 바로 접근할 수 있게 링크를 정리해두었습니다.

이 발표에서는 README를 기준으로 구조를 먼저 설명하고, 필요하면 배포된 화면에서 실제 workbench 흐름을 확인할 수 있습니다.

## 3. 주요 기능

주요 기능은 React 관점에서 정리했습니다.

첫 번째는 **Split Workbench**입니다.

채팅과 문서를 별도 화면으로 나누지 않고, 하나의 workspace 화면 안에서 좌우 패널로 구성했습니다.

두 번째는 **Channel Chat**입니다.

기존 메시지 히스토리는 서버에서 가져오고, 새 메시지는 realtime update로 반영합니다.

세 번째는 **Collaborative Editor**입니다.

Tiptap editor와 Yjs를 연결해서 여러 브라우저에서 같은 문서를 동시에 편집할 수 있게 했습니다.

네 번째는 **Presence**입니다.

Yjs awareness state를 React UI로 렌더링해서 현재 접속자와 연결 상태를 보여줍니다.

마지막으로 `/` command, `[[문서명]]`, `#태그` 같은 Notion/Obsidian-lite 기능을 editor 위에 추가했습니다.

## 4. 기술 스택

프론트엔드는 **React 19, TypeScript, Vite**를 사용했습니다.

라우팅은 React Router를 사용했고, 상태 관리는 성격에 따라 나눴습니다.

Local UI State는 Zustand, Server State는 TanStack Query, Realtime State는 Yjs와 y-websocket이 담당합니다.

Editor는 Tiptap StarterKit과 Tiptap Collaboration extension을 사용했습니다.

Backend는 Node.js WebSocket server와 Supabase Auth, Postgres, RLS를 사용하지만, 이 프로젝트에서는 React 앱을 지원하는 backend support 역할로 보면 됩니다.

배포는 Vercel frontend, Railway backend, Supabase 구조입니다.

## 5. React 구조

README의 React 구조를 보면 `src` 아래가 크게 네 영역으로 나뉩니다.

`app`은 provider, router, protected route처럼 앱 전체 설정을 담당합니다.

`pages`는 route page를 담당합니다. 즉 URL과 직접 연결되는 화면 단위입니다.

`features`는 실제 기능 로직이 들어가는 곳입니다. workspace, channel, chat, documents, editor, presence, realtime으로 나누었습니다.

`shared`는 api client, store, contract type, utility처럼 여러 feature에서 공유하는 코드를 둔 곳입니다.

여기서 중요한 점은 route page와 기능 로직을 분리했다는 것입니다.

페이지는 화면의 진입점 역할을 하고, 실제 채팅, 에디터, realtime 연결 같은 기능 책임은 `features` 아래에서 관리합니다.

## 6. 상태 관리 설계

이 프로젝트의 가장 중요한 구조는 상태 관리 분리입니다.

React UI 안에서 모든 상태를 한 곳에 넣지 않고, 상태 성격에 따라 나눴습니다.

Zustand는 local UI state를 담당합니다.

예를 들면 sidebar가 접혔는지, 어떤 workspace/channel/document가 선택되었는지, 어떤 pane이 보이는지 같은 상태입니다.

TanStack Query는 server state를 담당합니다.

워크스페이스 목록, 채널 목록, 문서 목록, 저장된 메시지 히스토리처럼 서버에서 가져오고 cache, loading, error, refetch가 필요한 데이터입니다.

Yjs는 realtime collaboration state를 담당합니다.

채팅 update, 문서 update, awareness처럼 여러 브라우저가 동시에 공유해야 하는 상태입니다.

이렇게 나누면 컴포넌트가 UI 상태, 서버 캐시, WebSocket 동기화 책임을 한 곳에서 모두 처리하지 않아도 됩니다.

## 7. 핵심 React 로직 — Workspace Workbench

Workspace 화면은 sidebar와 split workbench로 구성됩니다.

Sidebar에는 channel list와 document list가 있고, 오른쪽 workbench에는 Chat Panel과 Document Panel이 동시에 보입니다.

핵심은 channel과 document를 완전히 다른 페이지로 분리하지 않았다는 점입니다.

같은 workspace context 안에서 채팅과 문서를 동시에 유지하기 때문에, 사용자는 채팅 맥락을 보면서 바로 문서를 편집할 수 있습니다.

이 구조가 SyncSpace의 제품 컨셉인 “대화에서 결정하고 바로 문서화한다”와 연결됩니다.

## 8. 핵심 React 로직 — Chat Panel

Chat Panel은 세 가지 흐름을 합칩니다.

첫 번째는 TanStack Query로 이전 메시지 히스토리를 가져오는 흐름입니다.

두 번째는 Yjs chat room으로 새 메시지를 실시간 반영하는 흐름입니다.

세 번째는 composer 입력과 전송 상태를 React UI에 반영하는 흐름입니다.

즉, 채팅은 단순히 WebSocket 메시지만 보여주는 것이 아니라, 서버에 저장된 히스토리와 실시간 update를 함께 다루는 구조입니다.

## 9. 핵심 React 로직 — Document Editor

Document Editor는 Tiptap editor와 Yjs document를 연결합니다.

먼저 현재 document room에 해당하는 Yjs document를 생성하고, Tiptap Collaboration extension이 그 Yjs document와 연결됩니다.

사용자가 editor에서 내용을 수정하면 update가 같은 room의 다른 client에게 전파됩니다.

또 editor document를 분석해서 heading, `[[문서명]]`, `#태그`를 insight rail에 표시합니다.

그래서 이 editor는 단순 텍스트 입력창이 아니라, 협업 편집과 문서 인사이트를 함께 보여주는 React 컴포넌트입니다.

## 10. 핵심 React 로직 — Presence

Presence는 Yjs awareness state를 React component에서 읽어 표시합니다.

현재 접속자, 사용자 색상, 현재 모드, 연결 상태 같은 정보를 UI에 반영합니다.

이 기능은 협업 앱에서 “나 혼자 쓰는 화면이 아니라 다른 사용자와 같은 공간에 있다”는 느낌을 주기 위해 넣었습니다.

## 11. Realtime room 규칙

채팅과 문서는 서로 다른 room을 사용합니다.

채팅 room은 다음 형식입니다.

```txt
chat:{workspaceId}:{channelId}
```

문서 room은 다음 형식입니다.

```txt
doc:{workspaceId}:{documentId}
```

room을 분리한 이유는 채팅과 문서가 데이터 구조와 동기화 흐름이 다르기 때문입니다.

채팅은 메시지 중심이고, 문서는 editor document 중심입니다. 따라서 별도 room으로 나누면 두 기능의 lifecycle과 장애 범위를 분리할 수 있습니다.

## 12. Backend 역할 요약

Backend는 이 프로젝트의 중심이라기보다 React 앱을 지원하는 역할입니다.

HTTP API는 workspace 생성, 초대 참여, 삭제처럼 service-role 권한이 필요한 작업을 처리합니다.

WebSocket Server는 Yjs chat room과 document room 연결을 담당합니다.

Persistence는 채팅 메시지와 문서 snapshot 저장을 담당합니다.

Supabase는 Auth, Postgres, RLS를 제공합니다.

중요한 점은 service-role key 같은 민감한 값은 frontend에 노출하지 않고 backend에서만 사용한다는 것입니다.

## 13. 실행과 검증

실행은 README에 있는 것처럼 세 단계입니다.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Frontend는 `http://127.0.0.1:5173`, Backend는 `http://127.0.0.1:1234`에서 실행됩니다.

검증 명령은 다음입니다.

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm verify:all
```

React 프로젝트 관점에서는 `pnpm typecheck`와 `pnpm verify:frontend`를 우선 확인합니다.

## 14. 배포 구조

배포 구조는 Vercel frontend, Railway backend, Supabase입니다.

Vercel은 Vite React 정적 frontend를 배포합니다.

Railway는 WebSocket을 유지해야 하는 Node backend를 실행합니다.

Supabase는 Auth, Postgres, RLS를 담당합니다.

현재 frontend 배포 주소는 다음입니다.

https://sync-space-green.vercel.app/

## 15. 마무리 멘트

정리하면, SyncSpace는 채팅과 문서 협업을 한 화면에 묶은 React 실시간 협업 앱입니다.

제가 이 프로젝트에서 보여주고 싶은 핵심은 React 앱에서 상태를 성격별로 나누는 설계입니다.

Zustand는 local UI state, TanStack Query는 server state, Yjs는 realtime collaboration state를 담당하도록 분리했습니다.

이를 통해 단순 CRUD가 아니라, 실제 협업 앱에서 필요한 UI 구조, server cache, realtime sync, editor integration을 함께 다룬 React 프로젝트를 만들었습니다.
