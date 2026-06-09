# Observability (Phase 22)

문서 버전: 2026-06-09
대상 / scope: Railway 운영을 위한 구조적 로깅, 요청/태스크 상관관계(correlation),
헬스 엔드포인트 형태, Railway 로그 필터, Postgres 백업 스케줄.

## 1. 구조적 로깅 / structured logging

- 모든 로그는 JSON 한 줄(line-delimited JSON)로 출력한다. `LOG_LEVEL`(error|warn|info|debug)로 제어.
- 공통 필드: `level`, `time`(ISO8601), `msg`, `service`(api|worker|web).
- 민감정보(쿠키 값, AUTH_SECRET, AGENT_TOKEN, DATABASE_URL)는 절대 로깅하지 않는다.

예시 로그 라인:

```json
{"level":"info","time":"2026-06-09T03:14:05.123Z","service":"api","requestId":"req_a1b2c3","method":"POST","path":"/a2a","status":200,"durationMs":42,"msg":"request.completed"}
```

## 2. 요청 ID / request id

- 모든 HTTP 요청에 `requestId`를 부여한다. 인입 헤더(`X-Request-Id`)가 있으면 재사용, 없으면 생성.
- 응답에 `X-Request-Id`를 반영해 클라이언트/프록시(Caddy)와 추적을 연결한다.
- 한 요청에서 발생한 모든 로그 라인에 동일 `requestId`를 포함한다.

## 3. task / context id 바인딩 / correlation

A2A 비동기 잡은 요청 경계를 넘기므로 task·context 식별자로 상관관계를 잇는다.

- api가 task를 생성하면 `taskId`, `contextId`를 로그에 남긴다.
- agent-worker가 같은 task를 처리할 때 동일한 `taskId`/`contextId`/(가능하면)`requestId`를 로깅한다.
- push/SSE 이벤트에도 `taskId`를 포함해 end-to-end로 추적한다.

```json
{"level":"info","time":"2026-06-09T03:14:06.001Z","service":"worker","workerId":"worker-1","taskId":"task_77","contextId":"ctx_12","state":"working","msg":"task.transition"}
```

## 4. 헬스 엔드포인트 / health endpoints

api는 두 엔드포인트를 제공한다. web(Caddy)은 `/health`를 api로 프록시한다.

- `/health` — liveness: 프로세스가 살아있는지(가벼움).
- `/ready` — readiness: 의존성(DB/realtime/worker)까지 준비됐는지. Railway healthcheck는 api에서 `/ready` 사용.

`/ready` JSON 형태 예시:

```json
{
  "status": "ok",
  "service": "api",
  "version": "0.1.0",
  "checks": {
    "database": { "status": "ok", "latencyMs": 6 },
    "realtime": { "status": "ok", "rooms": 12 },
    "worker": { "status": "ok", "lastHeartbeatMs": 1500 }
  }
}
```

- 하나라도 실패하면 `status`는 `degraded` 또는 `error`, HTTP는 503으로 응답한다.
- `worker` 체크는 agent-worker의 최근 heartbeat(예: DB의 worker heartbeat 행) 기준으로 판단한다.

`/health` JSON 형태 예시 (가벼운 liveness):

```json
{ "status": "ok", "service": "api", "time": "2026-06-09T03:14:05.123Z" }
```

## 5. Railway 로그 필터 / log filters

Railway 서비스 로그에서 JSON 필드 기준으로 검색한다 (구조적 로깅 전제).

- 에러만: `level:error`
- 특정 요청 추적: `requestId:req_a1b2c3`
- 특정 task end-to-end (api+worker): `taskId:task_77`
- 워커 인스턴스: `service:worker workerId:worker-1`
- 느린 요청: `path:/a2a` + 앱에서 `durationMs` 임계 초과 시 `level:warn`로 승격해 `slow.request`로 표시.

## 6. Postgres 백업 스케줄 / backup schedule

Railway Postgres 백업 + 보존 정책:

| 주기 | 내용 | 보존 |
|---|---|---|
| **Daily** | 매일 자동 스냅샷(`pg_dump custom`) | 7일 |
| **Weekly** | 주간 풀 백업 | 4주 |
| **Monthly** | 월간 풀 백업(장기 보관) | 6개월 |

- 백업은 off-site(예: 객체 스토리지)로 복사해 단일 장애점을 피한다.
- 분기 1회 복원 리허설로 백업 유효성을 검증한다
  (절차는 `docs/migration/supabase-restore-rehearsal.md`의 `pg_restore` 흐름 재사용).
- 복원 목표: RPO ≤ 24h(daily 기준), RTO는 리허설로 측정해 기록한다.
