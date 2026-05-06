# SyncSpace README 기반 예상 질문과 모범 답변

이 문서는 `README.md`를 보며 발표한 뒤 받을 수 있는 질문과 답변을 정리한 발표 대비 자료다.

답변 원칙:

- 기능보다 **설계 의도**를 먼저 말한다.
- “왜 이 기술을 썼는지”를 상태 책임 분리와 연결한다.
- 모르는 부분은 과장하지 않고 현재 구현 범위와 향후 개선으로 분리한다.

## 1. 프로젝트 전체 질문

### Q0. 발표용 배포 주소는 어디인가요?

발표용 배포 주소는 https://sync-space-green.vercel.app/ 입니다.

README의 라이브 데모 섹션에서 홈, 로그인 화면, API 계약 화면 링크를 바로 열 수 있게 정리했습니다.

### Q1. SyncSpace를 한 문장으로 설명하면 무엇인가요?

SyncSpace는 채팅과 문서 협업을 한 화면에 묶고, Zustand, TanStack Query, Yjs로 상태 책임을 분리한 React 실시간 협업 앱입니다.

단순 CRUD보다 협업 앱에서 자주 생기는 복잡한 상태 문제를 어떻게 나눠서 관리할지 보여주는 포트폴리오입니다.

### Q2. 이 프로젝트에서 가장 강조하고 싶은 부분은 무엇인가요?

가장 강조하고 싶은 부분은 **상태 책임 분리**입니다.

로컬 UI 상태는 Zustand, 서버에서 가져오는 데이터는 TanStack Query, 실시간으로 동기화되는 문서와 채팅 상태는 Yjs가 담당하도록 나눴습니다.

이렇게 분리해서 UI 전환, 서버 캐시, 실시간 협업 상태가 서로 섞이지 않도록 설계했습니다.

### Q3. 왜 채팅과 문서를 한 화면에 배치했나요?

제품 컨셉이 “대화에서 나온 결정을 바로 문서화한다”는 흐름이기 때문입니다.

채팅과 문서를 다른 페이지로 분리하면 사용자가 맥락을 계속 전환해야 합니다. 그래서 Split Workbench 구조로 좌측에는 채팅, 우측에는 문서를 두어 협업 흐름을 한 화면에서 보여주도록 했습니다.

### Q4. 일반적인 CRUD 포트폴리오와 다른 점은 무엇인가요?

일반 CRUD는 서버 데이터를 조회하고 수정하는 흐름이 중심입니다.

SyncSpace는 거기에 더해 실시간 동기화, presence, 협업 문서 편집, WebSocket room, RLS, service-role backend 같은 요소가 들어갑니다.

그래서 단순 화면 구현보다 상태 관리, 데이터 흐름, 프론트/백엔드 경계 설계를 설명할 수 있습니다.

## 2. 상태 관리 질문

### Q5. Zustand, TanStack Query, Yjs를 왜 모두 사용했나요?

세 도구가 담당하는 상태의 성격이 다르기 때문입니다.

Zustand는 사이드바 접힘, 선택된 패널처럼 서버와 상관없는 UI 상태에 적합합니다.

TanStack Query는 워크스페이스, 채널, 문서 목록처럼 서버에서 가져오고 캐싱해야 하는 상태에 적합합니다.

Yjs는 여러 사용자가 동시에 수정하는 문서 내용, 채팅 room, awareness처럼 실시간 동기화가 필요한 상태에 적합합니다.

하나의 도구로 모두 처리하기보다 상태 성격에 맞게 나누는 것이 이 프로젝트의 핵심입니다.

### Q6. 모든 상태를 Zustand에 넣으면 안 되나요?

가능은 하지만 이 프로젝트에는 적합하지 않다고 봤습니다.

서버 데이터까지 Zustand에 직접 넣으면 cache invalidation, loading/error 상태, refetch, stale data 관리 등을 직접 구현해야 합니다.

TanStack Query는 이런 서버 상태 관리 문제를 이미 잘 해결해주기 때문에 서버 상태는 Query에 맡기고, Zustand는 UI 상태에 집중하도록 했습니다.

### Q7. 모든 서버 데이터를 TanStack Query로만 관리하면 안 되나요?

서버에서 가져온 목록이나 히스토리는 TanStack Query가 적합합니다.

하지만 문서 편집 내용처럼 여러 사용자가 동시에 수정하는 realtime shared state는 단순한 HTTP cache가 아니라 conflict-free 동기화가 필요합니다.

그래서 실시간 협업 상태는 Yjs가 맡고, TanStack Query는 DB 기반 목록과 히스토리 조회에 집중하도록 분리했습니다.

### Q8. Yjs가 담당하는 상태는 정확히 무엇인가요?

Yjs는 실시간으로 여러 클라이언트가 공유하는 상태를 담당합니다.

이 프로젝트에서는 문서 room의 편집 내용, 채팅 room의 실시간 메시지, awareness 기반 presence가 여기에 해당합니다.

반면 워크스페이스 목록이나 문서 제목 같은 메타데이터는 Supabase DB와 TanStack Query가 담당합니다.

## 3. 실시간 협업 질문

### Q9. 채팅과 문서는 어떻게 실시간 동기화되나요?

브라우저가 Node backend의 WebSocket endpoint에 연결하고, 각 채팅방과 문서방은 Yjs room으로 동기화됩니다.

채팅 room 이름은 `chat:{workspaceId}:{channelId}`이고, 문서 room 이름은 `doc:{workspaceId}:{documentId}`입니다.

같은 room에 들어온 브라우저들은 Yjs update를 통해 변경 사항을 공유합니다.

### Q10. 채팅과 문서를 같은 room으로 묶지 않은 이유는 무엇인가요?

채팅과 문서는 성격이 다른 협업 상태이기 때문입니다.

채팅은 메시지 배열 중심이고, 문서는 editor document 구조 중심입니다.

둘을 분리하면 한쪽 room의 동기화나 persistence 문제가 다른 쪽에 직접 영향을 주지 않습니다. 또한 room 이름만 봐도 어떤 리소스에 연결되는지 명확해집니다.

### Q11. Presence는 어떻게 구현했나요?

Yjs awareness를 기반으로 현재 접속한 사용자의 정보와 상태를 공유합니다.

Presence payload에는 사용자 id, display name, avatar, color, mode, lastSeenAt 같은 정보를 담을 수 있도록 계약을 정했습니다.

이를 통해 같은 workspace나 room에 접속 중인 사용자를 UI에 표시합니다.

### Q12. 새로고침 후 문서 내용은 유지되나요?

문서 Yjs 상태는 backend에서 snapshot으로 저장할 수 있도록 구성했습니다.

로컬 개발에서는 `SYNCSPACE_DOC_PERSISTENCE_DIR`에 snapshot을 저장하고, 운영 환경에서는 Railway Volume 같은 persistent storage를 연결하면 서버 재시작 후에도 문서 상태를 보존할 수 있습니다.

### Q13. 메시지는 실시간으로만 보이나요, 저장도 되나요?

채팅 메시지는 실시간 room에서 동기화되고, backend persistence adapter를 통해 Supabase `messages` 테이블에도 저장됩니다.

그래서 새로 접속한 사용자는 TanStack Query로 메시지 히스토리를 가져오고, 이후 새 메시지는 Yjs/WebSocket을 통해 실시간으로 받는 구조입니다.

## 4. 백엔드와 API 계약 질문

### Q14. Contract-first backend가 무엇인가요?

프론트와 백엔드를 즉흥적으로 붙이지 않고, API 타입, room naming, presence payload, error shape 같은 계약을 먼저 정하는 방식입니다.

SyncSpace에서는 `docs/contracts/API_CONTRACT_FIRST.md`에 계약을 정리하고, 프론트와 백엔드가 그 계약을 기준으로 구현되도록 했습니다.

### Q15. 왜 프론트에서 Supabase를 직접 쓰지 않고 backend API를 거치나요?

모든 작업을 backend API로 거치는 것은 아닙니다.

일반 조회나 사용자 권한 내 작업은 Supabase와 TanStack Query를 사용할 수 있습니다.

하지만 워크스페이스 생성, 초대 참여, 삭제처럼 service-role 권한이 필요하거나 여러 테이블을 원자적으로 다뤄야 하는 작업은 backend API를 거치도록 했습니다.

이렇게 하면 service-role key를 프론트에 노출하지 않고, 권한이 필요한 작업을 서버에서 안전하게 처리할 수 있습니다.

### Q16. API error는 어떻게 처리하나요?

프론트 UI가 Supabase나 backend의 원본 에러를 그대로 렌더링하지 않도록 `AppError` 형태로 변환하는 계약을 두었습니다.

`code`, `message`, `details` 구조를 기준으로 UI에서는 사용자에게 필요한 메시지를 보여주고, 내부 세부 정보는 adapter나 logging 영역에서 다루도록 했습니다.

### Q17. room naming을 계약으로 둔 이유는 무엇인가요?

WebSocket room 이름은 프론트와 백엔드가 반드시 동일하게 계산해야 합니다.

한쪽에서 room 이름 규칙이 바뀌면 실시간 동기화가 바로 깨집니다.

그래서 `chat:{workspaceId}:{channelId}`, `doc:{workspaceId}:{documentId}`처럼 deterministic한 규칙을 계약으로 고정했습니다.

## 5. Supabase와 보안 질문

### Q18. Supabase에서는 어떤 기능을 사용했나요?

Supabase Auth, Postgres, RLS를 사용했습니다.

Auth는 로그인과 사용자 세션을 담당하고, Postgres는 워크스페이스, 멤버, 채널, 문서, 메시지 데이터를 저장합니다.

RLS는 사용자가 자신이 속한 워크스페이스 데이터만 접근할 수 있도록 제한하는 역할을 합니다.

### Q19. RLS를 왜 사용했나요?

협업 앱에서는 사용자가 속하지 않은 워크스페이스의 채널, 문서, 메시지를 볼 수 없어야 합니다.

RLS를 사용하면 DB 레벨에서 접근 권한을 강제할 수 있습니다.

프론트엔드에서 숨기는 것만으로는 보안이 충분하지 않기 때문에, 데이터베이스 정책으로도 보호하도록 했습니다.

### Q20. service-role key는 어디에서 사용하나요?

service-role key는 backend server에서만 사용합니다.

프론트엔드에는 절대 노출하지 않습니다.

초대 참여, workspace 생성/삭제, 메시지 persistence처럼 서버가 신뢰된 권한으로 처리해야 하는 작업에서만 사용합니다.

### Q21. WebSocket 연결도 인증하나요?

운영 환경에서는 `WS_AUTH_MODE=supabase`로 설정해서 Supabase access token을 기반으로 WebSocket upgrade를 인증하도록 했습니다.

브라우저 클라이언트는 사용자의 access token을 WebSocket protocol 값으로 전달하고, backend는 해당 사용자가 workspace에 접근 가능한지 확인합니다.

로컬 smoke test에서는 `WS_AUTH_MODE=off`로 둘 수 있지만 운영에서는 Supabase auth mode를 사용하는 것이 기준입니다.

## 6. 프론트엔드 구조 질문

### Q22. React 코드는 어떤 순서로 읽으면 되나요?

먼저 `src/main.tsx`와 `src/app`에서 앱 진입점, provider, router 구조를 확인합니다.

그 다음 `src/pages`에서 route page를 보고, `src/features`에서 workspace, chat, editor, realtime 기능을 나눠 보면 됩니다.

마지막으로 `src/shared`에서 API client, stores, contract type, utility를 확인하면 전체 흐름이 잡힙니다.

자세한 순서는 `docs/REACT_CODE_GUIDE.md`에 정리했습니다.

### Q23. feature 단위로 폴더를 나눈 이유는 무엇인가요?

협업 앱은 workspace, chat, editor, presence, realtime처럼 관심사가 뚜렷하게 나뉩니다.

기능별로 폴더를 나누면 각 기능의 UI, query, hook, realtime 연결을 찾기 쉽고, 발표할 때도 “이 기능은 어디에 있다”를 설명하기 좋습니다.

### Q24. 로컬 UI 상태에는 어떤 것들이 있나요?

사이드바 접힘 상태, active pane, 선택된 workspace/channel/document 같은 UI 조작과 관련된 상태가 있습니다.

이런 상태는 서버에 저장할 필요가 없고, 브라우저 UI 안에서만 의미가 있기 때문에 Zustand로 관리했습니다.

### Q25. 서버 상태에는 어떤 것들이 있나요?

워크스페이스 목록, 채널 목록, 문서 메타데이터, 저장된 메시지 히스토리가 서버 상태입니다.

이 데이터들은 Supabase나 backend API에서 가져오고, loading/error/refetch/cache invalidation이 필요하기 때문에 TanStack Query로 관리했습니다.

## 7. 에디터 질문

### Q26. Tiptap을 사용한 이유는 무엇인가요?

Tiptap은 ProseMirror 기반 editor를 React에서 사용하기 편하게 제공하고, extension 구조가 좋아서 slash command, heading, list, code block 같은 기능을 확장하기 좋습니다.

또 Yjs collaboration extension과 함께 사용할 수 있어 실시간 공동 편집을 구현하기에 적합했습니다.

### Q27. Notion/Obsidian-lite라고 표현한 이유는 무엇인가요?

Notion처럼 `/` 슬래시 명령으로 블록을 추가할 수 있고, Obsidian처럼 `[[문서명]]` 문서 링크와 `#태그`를 인식하는 가벼운 지식 관리 기능을 넣었기 때문입니다.

다만 완전한 Notion이나 Obsidian clone이 아니라, 발표에서 협업 문서의 확장 가능성을 보여주기 위한 lite 기능입니다.

### Q28. 문서 링크나 태그는 실제 DB 관계로 저장되나요?

현재 README 기준으로는 문서 본문에서 `[[문서명]]`과 `#태그` 패턴을 인식해 인사이트로 보여주는 기능이 중심입니다.

향후 개선으로 backlink graph나 full-text search를 추가하면 DB 관계나 index 구조를 더 확장할 수 있습니다.

## 8. 배포와 운영 질문

### Q29. 왜 Vercel, Railway, Supabase로 나눠서 배포했나요?

프론트엔드는 Vite React 정적 앱이기 때문에 Vercel이 적합합니다.

반면 backend는 WebSocket 연결을 유지해야 하므로 장기 실행 Node server를 지원하는 Railway 같은 환경이 필요합니다.

Supabase는 인증, Postgres, RLS를 제공하므로 backend storage와 auth layer로 사용했습니다.

### Q30. Vercel만으로는 안 되나요?

정적 프론트엔드는 Vercel에 올릴 수 있지만, SyncSpace backend는 WebSocket upgrade와 Yjs room을 계속 유지해야 합니다.

Vercel의 일반적인 serverless 함수 모델은 장기 WebSocket 서버에 적합하지 않기 때문에 Node backend는 Railway 같은 별도 서비스에 배포하는 구조를 선택했습니다.

### Q31. 배포 후 어떤 것을 확인해야 하나요?

먼저 live URL이 정상으로 열리는지 확인합니다.

그 다음 로그인, workspace 생성, 초대 참여, 채팅 동기화, 문서 동기화, presence 표시를 확인합니다.

또 frontend domain이 바뀌면 backend의 `ALLOWED_ORIGINS`를 함께 업데이트해야 WebSocket origin check에서 막히지 않습니다.

## 9. 검증 질문

### Q32. 어떤 검증 명령을 사용했나요?

README 기준 검증 명령은 다음입니다.

```bash
pnpm typecheck
pnpm verify:frontend
pnpm verify:backend
pnpm verify:all
```

프론트엔드는 타입체크와 production build, 백엔드는 typecheck와 build를 기준으로 검증합니다.

### Q33. 테스트는 어떻게 관리하나요?

공개 README에서는 typecheck와 build 중심의 기준 검증을 안내합니다.

로컬에서는 QA/E2E 산출물과 테스트 결과를 `dogfood-output`, `test-results`, `playwright-report` 같은 디렉터리로 관리하고, 공개 추적 대상에서는 제외했습니다.

### Q34. 실시간 기능은 어떻게 확인했나요?

두 브라우저 또는 브라우저와 시크릿 창을 열고 같은 workspace에 접속해 확인합니다.

한쪽에서 채팅 메시지를 보내거나 문서를 편집했을 때 다른 쪽에 새로고침 없이 반영되는지를 확인합니다.

또 presence와 연결 상태 표시가 바뀌는지도 함께 확인합니다.

## 10. 한계와 향후 개선 질문

### Q35. 현재 프로젝트의 한계는 무엇인가요?

현재는 포트폴리오 발표에 맞춰 핵심 협업 흐름을 구현한 상태입니다.

문서 block drag handle, 실제 task-list node, full-text search, backlink graph, markdown import/export 같은 고급 문서 기능은 향후 개선으로 남겨두었습니다.

### Q36. 성능 측면에서 개선할 부분은 무엇인가요?

SPA 구조와 React runtime 특성상 초기 로딩 성능을 더 끌어올리려면 SSR이나 prerender 기반 landing shell을 고려할 수 있습니다.

README에도 향후 개선 방향으로 SSR 또는 prerender 기반 Lighthouse Performance 개선을 적어두었습니다.

### Q37. 운영 환경에서 가장 주의해야 할 점은 무엇인가요?

첫 번째는 service-role key를 절대 frontend에 노출하지 않는 것입니다.

두 번째는 frontend domain 변경 시 backend `ALLOWED_ORIGINS`를 맞춰야 한다는 점입니다.

세 번째는 문서 snapshot을 보존하려면 Railway Volume 같은 persistent storage를 연결해야 한다는 점입니다.

## 11. 압박 질문 대비

### Q38. Yjs를 쓰면 TanStack Query가 필요 없는 것 아닌가요?

역할이 다릅니다.

Yjs는 실시간 shared document를 동기화하는 데 강점이 있고, TanStack Query는 서버 데이터 조회, 캐싱, loading/error/refetch를 관리하는 데 강점이 있습니다.

워크스페이스 목록이나 문서 메타데이터까지 모두 Yjs로 관리하면 DB 조회, 권한, 페이지 진입 시 초기 데이터 관리가 복잡해집니다.

그래서 두 도구를 경쟁 관계가 아니라 역할 분리 관계로 사용했습니다.

### Q39. Supabase Realtime만 쓰면 Yjs가 필요 없지 않나요?

Supabase Realtime은 DB row 변경을 구독하는 데 적합합니다.

하지만 여러 사용자가 같은 문서 본문을 동시에 편집할 때는 conflict resolution과 shared document model이 중요합니다.

Yjs는 CRDT 기반 협업 문서 동기화에 특화되어 있어서 editor collaboration에는 더 적합하다고 판단했습니다.

### Q40. 직접 구현한 부분과 라이브러리에 맡긴 부분의 경계는 무엇인가요?

Yjs, Tiptap, TanStack Query 같은 복잡한 문제를 해결하는 라이브러리는 적극 활용했습니다.

대신 어떤 상태를 어떤 도구에 맡길지, room naming을 어떻게 계약화할지, Supabase RLS와 backend service-role 경계를 어떻게 나눌지 같은 애플리케이션 아키텍처는 직접 설계했습니다.

### Q41. 프로젝트가 너무 복잡한 것 아닌가요?

단순 CRUD 포트폴리오라면 복잡할 수 있습니다.

하지만 이 프로젝트의 목적은 실시간 협업 앱에서 발생하는 복잡도를 보여주는 것입니다.

그래서 복잡도를 없애기보다 상태 종류별로 나누고, contract-first 문서와 폴더 구조로 설명 가능하게 만드는 데 집중했습니다.

### Q42. 본인이 가장 많이 배운 부분은 무엇인가요?

실시간 협업 기능을 넣으면 단순히 WebSocket을 연결하는 것보다 상태 경계를 정하는 것이 더 중요하다는 점을 배웠습니다.

서버에서 가져온 상태, 로컬 UI 상태, 여러 사용자가 동시에 수정하는 shared state를 구분하지 않으면 작은 기능 변경도 복잡해집니다.

그래서 이 프로젝트를 통해 React 앱에서 상태를 성격별로 분리하는 설계 감각을 많이 배웠습니다.

## 12. 마지막 요약 답변

### Q43. 마지막으로 이 프로젝트를 어떻게 기억해주면 좋을까요?

SyncSpace는 채팅과 문서를 한 화면에 묶은 실시간 협업 앱입니다.

하지만 더 중요한 포인트는 Zustand, TanStack Query, Yjs를 각각 로컬 UI 상태, 서버 상태, 실시간 협업 상태에 배치해 협업 앱의 복잡도를 구조적으로 나눴다는 점입니다.

이 프로젝트를 통해 저는 React 화면 구현뿐 아니라 상태 설계, realtime sync, backend contract, RLS 기반 권한 설계까지 함께 고려할 수 있다는 것을 보여주고 싶었습니다.
