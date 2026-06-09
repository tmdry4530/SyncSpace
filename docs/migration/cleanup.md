# Cleanup (Phase 24)

문서 버전: 2026-06-09
대상 / scope: 프로덕션 컷오버가 안정화된 뒤 Supabase/Vercel 잔재를 제거한다.
컷오버(`docs/migration/cutover-runbook.md`) 직후가 아니라 **안정화 윈도우**를 거친 후 진행한다.

## 0. 사전 조건 / preconditions

- 컷오버 후 안정화 윈도우(아래 4절)를 무사히 통과했다.
- Railway-only 스택에서 모든 스모크 테스트 항목이 지속적으로 통과한다.
- 백업/롤백 경로가 더 이상 Supabase에 의존하지 않음을 확인했다.

## 1. 의존성 제거 / remove dependency

루트와 server 워크스페이스에서 `@supabase/supabase-js`를 제거한다.

```bash
pnpm remove @supabase/supabase-js                 # root
pnpm --filter server remove @supabase/supabase-js # server
pnpm install --frozen-lockfile=false              # lockfile 갱신
```

## 2. Supabase 클라이언트 코드 삭제 / delete client code

- 프런트엔드 Supabase 클라이언트 생성/인증 코드 제거(authStore의 Supabase Session/User 경로).
- server의 Supabase service-role 클라이언트 및 messages 영속화의 Supabase 경로 제거
  (app-owned Postgres 경로만 남김).
- `WS_AUTH_MODE`의 `supabase` 분기 및 관련 토큰 검증 코드 제거(`session`만 유지).
- `vite.config.ts`의 `@supabase` manualChunks 항목 정리(번들 청크에서 제외).

## 3. env 제거 / remove env

`docs/migration/env_inventory.md`의 "Legacy" 섹션 변수를 모든 서비스/배포에서 삭제한다.

- api: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- build/frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WS_AUTH_MODE`
- Vercel 프로젝트/배포 훅/도메인 연결 해제 및 프로젝트 보관(archive).
- `.env.example`의 "Supabase (legacy / removed after cutover)" 섹션 삭제.
- 루트 `vercel.json` 제거(또는 보관용으로 이동).

## 4. 레거시 컬럼 정리 / drop legacy column

`messages.user_id`(Supabase auth.users 참조용 레거시 컬럼)는 app-owned 스키마에서
participant 기반으로 대체된다. **즉시 DROP하지 않는다.**

- 먼저 신규 참여자 컬럼으로의 백필이 100% 완료됐고 코드가 더 이상 `user_id`를 읽지 않음을 확인.
- 안정화 후 **별도의 future migration**으로 컬럼을 제거한다 (롤백 가능하도록 단독 마이그레이션):

```sql
-- future migration (안정화 + 미참조 확인 후 단독 적용)
ALTER TABLE public.messages DROP COLUMN IF EXISTS user_id;
```

## 5. grep 체크 / grep checks

잔재가 없는지 확인한다. 출력이 비어야 한다(테스트 픽스처/주석 제외).

```bash
grep -R SUPABASE src server          # 코드 내 SUPABASE 참조
grep -Ri supabase src server         # 대소문자 무시 (import/식별자 포함)
grep -R "VITE_SUPABASE" src          # 프런트 env 참조
grep -R "WS_AUTH_MODE.*supabase" src server  # 레거시 인증 분기
```

- 남은 참조가 있으면 2~3절로 돌아가 제거한다.
- 문서(`docs/`)의 마이그레이션 기록은 의도적으로 남길 수 있다(코드 경로만 정리).

## 6. 안정화 윈도우 / stabilization window

- 컷오버 후 최소 **1~2주**의 안정화 기간을 둔 뒤 본 정리(특히 4절 컬럼 DROP)를 진행한다.
- 기간 동안 `docs/migration/observability.md`의 로그 필터로 에러율/지연을 모니터링한다.
- 이 기간에는 Supabase 프로젝트를 즉시 삭제하지 말고 **읽기 전용으로 보존**해 비상 참조에 대비한다.
- 안정화 완료 후 Supabase 프로젝트를 최종 삭제하고 백업만 보관한다.

## 7. 최종 체크리스트 / final checklist

- [ ] `@supabase/supabase-js` 제거 (root + server), lockfile 갱신
- [ ] Supabase 클라이언트/인증/영속화 코드 삭제
- [ ] `WS_AUTH_MODE` supabase 분기 제거 (session만 유지)
- [ ] Legacy env 제거 (Railway + Vercel + `.env.example`)
- [ ] `vercel.json` 정리, Vercel 프로젝트 보관
- [ ] grep 체크 통과 (출력 없음)
- [ ] `messages.user_id` future migration 작성 (안정화 후 적용)
- [ ] 안정화 윈도우 통과 후 Supabase 프로젝트 최종 삭제
