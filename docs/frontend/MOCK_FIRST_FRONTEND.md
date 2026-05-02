# Mock-first Frontend Strategy

## 목적

백엔드가 AI에 의해 구현되는 동안 프론트엔드는 막히지 않아야 한다.
따라서 프론트는 먼저 mock adapter를 기준으로 직접 구현한다.

## 원칙

- UI와 상태관리 학습은 백엔드 완성에 의존하지 않는다.
- API contract만 고정하고, 구현체는 mock에서 Supabase로 교체한다.
- Yjs는 처음에는 local/mock provider로 UX를 먼저 만든 뒤 실제 WS로 연결한다.

## 권장 구조

```txt
src/shared/api/
├─ contracts.ts
├─ mockData.ts
├─ mockClient.ts
├─ supabaseClient.ts
└─ client.ts
```

`client.ts`는 환경변수나 feature flag에 따라 mock/supabase를 선택한다.

```ts
export const apiClient = import.meta.env.VITE_USE_MOCKS === 'true'
  ? mockClient
  : supabaseClient;
```

## Mock 구현 범위

AI에게 맡겨도 되는 것:

- mock data fixture
- delay helper
- fake pagination
- fake error case

사용자가 직접 연결할 것:

- query hook에서 mock client 호출
- loading/empty/error state 렌더링
- optimistic update 흐름 이해

## 개발 순서

1. `contracts.ts` 작성
2. `mockData.ts` 작성
3. `mockClient.ts` 작성
4. 사용자가 query hook 작성
5. UI 연결
6. backend 완료 후 `supabaseClient.ts` 구현체로 교체

## Mock으로 먼저 검증할 수 있는 기능

- 워크스페이스 목록
- 채널 목록
- 문서 목록
- 메시지 히스토리
- 메시지 전송 optimistic UI
- 문서 메타데이터 표시
- 빈 상태/에러 상태
