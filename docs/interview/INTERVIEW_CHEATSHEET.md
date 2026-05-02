# Interview Cheatsheet

## 핵심 한 문장

SyncSpace에서는 로컬 UI 상태, 서버 상태, 실시간 협업 상태를 명확히 분리했습니다. Zustand는 현재 선택값과 스크롤 위치 같은 UI 상태를 담당하고, TanStack Query는 Supabase에서 가져오는 워크스페이스/채널/문서/메시지 히스토리를 담당하며, Yjs는 문서 내용, 실시간 채팅 스트림, Presence 같은 동기화 상태를 담당합니다.

## 질문 1. 왜 Zustand에 메시지 목록을 넣지 않았나?

메시지 히스토리는 서버에서 페이지네이션으로 가져오는 서버 상태입니다. 캐싱, 재요청, 무한스크롤, stale 처리, invalidation이 필요하므로 TanStack Query가 더 적합합니다. Zustand에는 채팅 입력값, 스크롤 위치, 현재 선택 채널처럼 UI 전용 상태만 둡니다.

## 질문 2. Yjs와 TanStack Query가 둘 다 메시지를 다루면 중복 아닌가?

역할이 다릅니다. TanStack Query는 과거 메시지 히스토리와 영속 데이터 조회를 담당합니다. Yjs는 현재 접속 중인 사용자 사이의 신규 메시지 반영과 실시간 동기화를 담당합니다. 렌더링 단계에서 clientId 또는 id 기준으로 dedupe합니다.

## 질문 3. 왜 백엔드는 AI에게 맡겼나?

이 프로젝트의 목적은 프론트엔드 역량 증명입니다. 백엔드는 필요한 계약과 실시간 인프라를 제공하는 supporting layer로 두고, 핵심 학습 시간은 React 상태관리, UI 구조, 실시간 협업 UX에 집중했습니다.

## 질문 4. 직접 구현한 프론트 핵심은 무엇인가?

- 라우팅과 워크스페이스 shell
- Zustand UI store
- TanStack Query hooks
- 채팅 UI와 스크롤 복원
- Yjs room hook
- Tiptap collaborative editor
- Presence UI

## 질문 5. 가장 어려웠던 부분은?

실시간 상태와 서버 상태의 경계를 정하는 부분입니다. 예를 들어 채팅은 히스토리와 신규 메시지가 서로 다른 경로로 들어오므로, 중복 제거와 정렬, pending 상태 처리가 필요했습니다. 문서 에디터는 Y.Doc과 Tiptap editor lifecycle을 route 전환과 함께 안전하게 정리하는 것이 중요했습니다.
