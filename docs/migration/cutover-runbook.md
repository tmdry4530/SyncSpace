# Production Cutover Runbook (Phase 19-20)

문서 버전: 2026-06-09
대상 / scope: Supabase+Vercel → Railway-only 프로덕션 컷오버. 리허설
(`docs/migration/supabase-restore-rehearsal.md`)이 성공한 뒤 실행한다.

전제: Railway에 web / api / agent-worker / Postgres 서비스가 프로비저닝되어 있고,
모든 env가 `docs/migration/env_inventory.md` 기준으로 세팅 준비됨.

> 모든 명령의 접속 문자열은 환경에 맞게 export 해서 사용한다.
> `SUPABASE_DB_URL`(source), `RAILWAY_DB_URL`(target prod).

## 0. 컷오버 윈도우 / maintenance window

- 사용자 영향 최소 시간대로 점검 창을 공지한다 (예: 30~60분).
- 점검 페이지 또는 공지 배너를 활성화한다.
- 롤백 담당/실행 담당/검증 담당 역할을 사전 지정한다.

## 1. 쓰기 동결 / write freeze

목표: 덤프 시작 ~ DNS 컷오버 사이에 source(Supabase)에 신규 쓰기가 들어오지 않게 한다.

- 프런트엔드를 읽기 전용/점검 모드로 전환하거나 Vercel 배포를 점검 페이지로 교체.
- (옵션) Supabase에서 앱 역할의 write를 차단하거나 API 게이트를 닫는다.
- 동결 시각을 기록한다(이후 행수 기준점).

## 2. Supabase 덤프 / dump

```bash
pg_dump "$SUPABASE_DB_URL" \
  --schema=public --no-owner --no-privileges \
  --format=custom --file=prod_public.dump
```

source 기준 행수 스냅샷을 남긴다:

```bash
psql "$SUPABASE_DB_URL" -At -c "
SELECT 'workspaces', count(*) FROM public.workspaces
UNION ALL SELECT 'workspace_members', count(*) FROM public.workspace_members
UNION ALL SELECT 'channels', count(*) FROM public.channels
UNION ALL SELECT 'documents', count(*) FROM public.documents
UNION ALL SELECT 'messages', count(*) FROM public.messages
ORDER BY 1;" | tee source_counts.txt
```

## 3. Railway 복원 / restore

```bash
pg_restore \
  --dbname="$RAILWAY_DB_URL" \
  --no-owner --no-privileges \
  --clean --if-exists \
  prod_public.dump
```

## 4. 마이그레이션 적용 / migrate

app-owned 스키마(app_users, auth_sessions, participants, agents, tasks, events,
artifacts, yjs_document_snapshots 등)를 적용한다.

```bash
DATABASE_URL="$RAILWAY_DB_URL" pnpm db:migrate
```

## 5. 백필 / backfill

Supabase Auth 사용자 → app_users, 기존 멤버 → participants 등 데이터 변환을 수행한다.
(백필 스크립트는 server 측 구현을 사용한다. 예: `pnpm --filter server db:seed`로 기본
에이전트/시스템 참여자 시드.)

```bash
DATABASE_URL="$RAILWAY_DB_URL" pnpm db:seed   # 시스템/에이전트 참여자, 기본 데이터
# (사용자/멤버 백필 스크립트가 있으면 여기서 실행)
```

## 6. 검증 / verify

```bash
DATABASE_URL="$RAILWAY_DB_URL" pnpm db:verify
```

- 마이그레이션 적용 상태 + 데이터 정합성 통과 확인.
- 행수 재확인: target의 `workspaces/workspace_members/channels/documents/messages`가
  `source_counts.txt`와 일치하는지 비교한다.

## 7. env 세팅 / set env

`docs/migration/env_inventory.md` 기준으로 web / api / agent-worker 서비스 변수를
모두 확정한다 (`DATABASE_URL`, `AUTH_SECRET`, `SESSION_COOKIE_*`, `AGENT_TOKEN_PEPPER`,
`PUBLIC_APP_URL`, `A2A_*`, `WS_AUTH_MODE=session`, `SYNCSPACE_DOC_PERSISTENCE_MODE=postgres`,
web의 `API_INTERNAL_URL` 등). api·worker·web 재배포로 반영한다.

## 8. 스모크 테스트 / smoke test (DNS 전환 전, Railway URL로)

Railway가 부여한 임시 도메인으로 다음을 모두 통과해야 한다:

- [ ] **로그인** — 세션 쿠키 발급 및 인증 유지
- [ ] **워크스페이스 목록** — 백필된 워크스페이스가 보임
- [ ] **채팅** — 메시지 전송/수신, 새로고침 후에도 영속
- [ ] **문서 편집 + 새로고침 영속** — 편집 후 reload 시 내용 유지 (postgres 스냅샷)
- [ ] **@planner 태스크** — @planner 멘션으로 task 생성/응답
- [ ] **A2A `message:send`** — task 생성 응답 수신
- [ ] **A2A `tasks/{id}`** — 생성된 task 상태 조회
- [ ] **A2A `message:stream`** — SSE로 상태 전이 스트림 수신
- [ ] **push 웹훅** — 등록된 push 엔드포인트로 이벤트 전달 확인
- [ ] **/health, /ready** — JSON 200 (database/realtime/worker ok)

## 9. DNS 컷오버 / DNS cutover

- 프로덕션 도메인을 Railway web 서비스로 전환 (CNAME/A 레코드).
- Railway에서 커스텀 도메인 + TLS 발급 확인.
- 짧은 TTL로 미리 낮춰두면 전파/롤백이 빠르다.
- 전환 후 실도메인으로 8단계 스모크 테스트 핵심 항목을 재확인한다.

## 10. 점검 해제 / unfreeze

- 점검 배너/읽기 전용 모드 해제.
- 사용자에게 완료 공지.
- `docs/migration/observability.md`의 로그 필터로 에러율을 모니터링한다.

## 11. 롤백 / rollback plan

스모크 테스트 실패 또는 치명적 오류 시:

1. **DNS → Vercel**: 도메인을 다시 Vercel(기존 프런트)로 되돌린다 (TTL 짧게 유지했으므로 빠름).
2. **Supabase 동결 해제 / unfreeze Supabase**: 1단계 쓰기 동결을 풀어 기존 스택을 정상화한다.
3. 컷오버 윈도우 중 Railway에 들어온 신규 쓰기는 없거나(동결 유지) 무시 가능하다.
   동결 후 Supabase 쓰기를 재개했다면 그 사이 데이터 델타를 별도 정리한다.
4. 실패 원인을 기록하고 리허설/런북을 보완한 뒤 재시도 일정을 잡는다.

## 12. 정리 / cleanup

```bash
rm -f prod_public.dump source_counts.txt
```

안정화 후 Supabase/Vercel 제거는 `docs/migration/cleanup.md`(Phase 24)를 따른다.
