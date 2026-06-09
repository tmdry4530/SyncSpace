# Supabase → Railway Restore Rehearsal (Phase 2)

문서 버전: 2026-06-09
대상 / scope: 프로덕션 컷오버 전에, Supabase `public` 스키마를 Railway **staging** Postgres로
한 번 복원(rehearsal)해 절차·권한·행수(row count)를 검증한다. 프로덕션에는 적용하지 않는다.

## 0. 사전 준비 / prerequisites

- 도구: `pg_dump`, `pg_restore`, `psql` (Postgres 클라이언트 16+ 권장)
- 접속 문자열 2개:
  - `SUPABASE_DB_URL` — Supabase 프로젝트 connection string (Direct connection, not pooler)
  - `RAILWAY_STAGING_URL` — Railway staging Postgres `DATABASE_URL`
- staging DB는 비어 있거나 폐기 가능한 상태여야 한다.

```bash
export SUPABASE_DB_URL="postgres://postgres:<pw>@db.<ref>.supabase.co:5432/postgres"
export RAILWAY_STAGING_URL="postgres://<user>:<pw>@<host>:5432/syncspace_staging"
```

## 1. Supabase public 스키마 덤프 / dump

`auth`, `storage` 등 Supabase 관리 스키마는 제외하고 앱 데이터(`public`)만 덤프한다.

```bash
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner --no-privileges \
  --format=custom \
  --file=supabase_public.dump
```

- `--no-owner --no-privileges`: Railway는 RLS/소유권 모델이 다르므로 소유권·권한을 가져오지 않는다.
- `--format=custom`: `pg_restore`로 선택 복원 가능한 압축 포맷.

## 2. Railway staging로 복원 / restore

```bash
pg_restore \
  --dbname="$RAILWAY_STAGING_URL" \
  --no-owner --no-privileges \
  --clean --if-exists \
  supabase_public.dump
```

- `--clean --if-exists`: 재실행 가능(idempotent)하도록 기존 객체를 먼저 정리한다.
- 복원 후 경고가 나와도(예: 존재하지 않는 role) 데이터가 들어왔는지 다음 단계로 확인한다.

## 3. 행수 검증 / row-count verification

핵심 테이블의 source(Supabase) ↔ target(Railway staging) 행수를 비교한다.

source(Supabase)에서:

```bash
psql "$SUPABASE_DB_URL" -At -c "
SELECT 'workspaces', count(*) FROM public.workspaces
UNION ALL SELECT 'workspace_members', count(*) FROM public.workspace_members
UNION ALL SELECT 'channels', count(*) FROM public.channels
UNION ALL SELECT 'documents', count(*) FROM public.documents
UNION ALL SELECT 'messages', count(*) FROM public.messages
ORDER BY 1;"
```

target(Railway staging)에서 동일 쿼리:

```bash
psql "$RAILWAY_STAGING_URL" -At -c "
SELECT 'workspaces', count(*) FROM public.workspaces
UNION ALL SELECT 'workspace_members', count(*) FROM public.workspace_members
UNION ALL SELECT 'channels', count(*) FROM public.channels
UNION ALL SELECT 'documents', count(*) FROM public.documents
UNION ALL SELECT 'messages', count(*) FROM public.messages
ORDER BY 1;"
```

두 출력이 테이블별로 **정확히 일치**해야 한다. 불일치 시 덤프/복원 옵션과 스키마 필터를 재점검한다.

검증 체크리스트:

- [ ] `workspaces` 행수 일치
- [ ] `workspace_members` 행수 일치
- [ ] `channels` 행수 일치
- [ ] `documents` 행수 일치
- [ ] `messages` 행수 일치

## 4. 스모크 테스트 / smoke test

복원된 staging 데이터에 대해 기본 무결성을 확인한다.

```bash
psql "$RAILWAY_STAGING_URL" -c "
-- FK 무결성: 멤버가 존재하는 워크스페이스를 가리키는지
SELECT count(*) AS orphan_members
FROM public.workspace_members wm
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id
WHERE w.id IS NULL;

-- 메시지가 존재하는 채널을 가리키는지
SELECT count(*) AS orphan_messages
FROM public.messages m
LEFT JOIN public.channels c ON c.id = m.channel_id
WHERE c.id IS NULL;
"
```

- 두 `orphan_*` 값이 모두 `0`이어야 한다.
- 가능하면 staging api 서비스(또는 로컬에서 `DATABASE_URL=$RAILWAY_STAGING_URL`)로 부팅해
  로그인/워크스페이스 목록이 정상 응답하는지 1회 확인한다.

## 5. 정리 / teardown

```bash
rm -f supabase_public.dump
# staging DB는 다음 리허설을 위해 비우거나 그대로 폐기한다.
```

리허설에서 확인된 정확한 옵션/행수/소요 시간을 기록해 두고, 프로덕션 컷오버
(`docs/migration/cutover-runbook.md`)에서 동일 절차를 재사용한다.
