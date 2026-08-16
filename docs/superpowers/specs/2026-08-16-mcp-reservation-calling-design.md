# MCP 예약 전화 SaaS 설계

**작성일:** 2026-08-16  
**상태:** 승인됨  
**대상:** 여러 사용자의 예약 요청을 MCP로 접수하고 ClawOps를 통해 한국 전화망으로 실행하는 SaaS MVP

## 1. 문제와 목표

사용자는 MCP 클라이언트에서 음식점·미용실 등 전화 예약이 필요한 사업장에 예약 전화를 요청하고, 통화가 끝난 뒤 구조화된 결과를 다시 조회할 수 있어야 한다.

MVP의 목표는 다음과 같다.

- 원격 Streamable HTTP MCP 서버로 예약 전화 작업을 접수한다.
- MCP 요청을 실제 통화와 분리해 즉시 `reservationId`와 `queued` 상태를 반환한다.
- Supabase Postgres를 내구성 있는 작업 큐와 결과 저장소로 사용한다.
- 별도 상시 실행 워커가 ClawOps 070 번호로 전화를 걸고 OpenAI Realtime으로 대화한다.
- 테넌트별 API 키, 사용량, 예약과 통화 결과를 분리한다.
- 중복 요청, 부재중, 통화중, 거절, 일시 장애를 예측 가능한 상태로 처리한다.

## 2. 비목표

- 임의의 사용자 010 번호를 발신번호로 표시하지 않는다.
- AiTakeCall, Mac, iPhone 장비팜을 중앙 SaaS의 통화 경로로 사용하지 않는다.
- 첫 구현에서 결제, 관리자 대시보드, 셀프서비스 번호 발급, 다국어를 제공하지 않는다.
- 첫 구현에서 통화 녹음 파일을 저장하지 않는다. 구조화된 결과와 텍스트 전사만 저장한다.
- MCP 요청 연결을 실제 전화가 끝날 때까지 유지하지 않는다.

## 3. 핵심 결정

### 3.1 통화 사업자

ClawOps를 전화망 계층으로 사용한다. 모든 아웃바운드 통화는 계정에 발급된 공용 070 번호로 발신한다. `CLAWOPS_FROM_NUMBER`는 서버 전용 환경변수이며 클라이언트가 발신번호를 선택할 수 없다.

### 3.2 MCP 전송

`@modelcontextprotocol/server` 2.0.0의 `createMcpHandler`를 사용해 `/mcp`에 stateless Streamable HTTP 엔드포인트를 제공한다. Next.js 16.3.1 App Router의 Route Handler가 Web `Request`/`Response`를 그대로 전달한다. MCP 2026-07-28과 SDK의 stateless legacy fallback을 함께 지원한다.

### 3.3 비동기 작업 모델

`create_reservation_call`은 통화를 직접 실행하지 않고 DB에 작업을 생성한다. 작업 워커는 Postgres RPC의 `FOR UPDATE SKIP LOCKED`를 이용해 하나씩 원자적으로 claim한다. 별도 Redis나 큐 제품은 MVP에 추가하지 않는다.

### 3.4 배포 경계

```text
MCP Client
  -> Next.js /mcp Route Handler
  -> tenant authentication + reservation service
  -> Supabase reservation_jobs
  -> Voice Worker (always-on Node.js process)
  -> ClawOps Control/Media WebSocket
  -> OpenAI Realtime
  -> 070 발신 -> 사업장
```

- Next.js 앱은 Vercel에 배포할 수 있다.
- Voice Worker는 Railway, Fly.io, Render, ECS처럼 장시간 WebSocket과 프로세스를 유지할 수 있는 환경에 배포한다.
- Next.js Route Handler 안에서 ClawOps Agent를 실행하지 않는다.

## 4. MCP 도구 계약

### `create_reservation_call`

입력:

```ts
type CreateReservationInput = {
  idempotencyKey: string;       // 테넌트 안에서 고유, 8~128자
  destinationPhone: string;     // 한국 전화번호, 구분문자 허용
  placeName: string;            // 1~100자
  customerName: string;         // 1~50자
  partySize: number;            // 1~20
  requestedAt: string;          // timezone을 포함한 ISO 8601
  requestNotes?: string;        // 최대 500자
};

type CreateReservationOutput = {
  reservationId: string;
  status: "queued";
  createdAt: string;
};
```

동일 테넌트와 `idempotencyKey`로 다시 호출하면 새 전화를 만들지 않고 기존 작업을 반환한다.

### `get_reservation_status`

입력은 `reservationId`이며, 같은 테넌트의 작업만 반환한다. 결과에는 현재 상태, 요청 정보, 시도 횟수, 구조화된 예약 결과, 최근 실패 사유가 포함된다.

### `list_reservations`

`limit`은 기본 20, 최대 50이다. 최신 생성 순으로 같은 테넌트의 예약만 반환한다.

### `cancel_reservation_call`

`queued` 또는 `retry_scheduled` 상태만 `canceled`로 바꾼다. 이미 `dialing` 이후이면 상태를 변경하지 않고 `cancelable: false`를 반환한다. 실행 중 통화를 MCP 취소 요청으로 강제 종료하는 기능은 MVP 범위가 아니다.

## 5. 상태 모델

```text
queued
  -> dialing
  -> connected
  -> confirmed
  -> unavailable
  -> needs_human

dialing
  -> retry_scheduled -> dialing
  -> failed
  -> canceled (발신 시작 전만)
```

최종 상태는 `confirmed`, `unavailable`, `needs_human`, `failed`, `canceled`다.

- 한 예약은 최대 2번까지 통화를 시도한다.
- `no-answer`, `busy`, ClawOps의 일시적 시스템/망 실패만 한 번 재시도한다.
- `rejected`, `invalid_number`, `number_changed`, `incompatible_destination`은 재시도하지 않는다.
- 재시도 시각은 첫 실패 10분 뒤다.
- 워커가 claim한 뒤 5분 동안 heartbeat를 갱신하지 않으면 stale 작업으로 보고 다시 `queued`로 회수할 수 있다.

## 6. 데이터 모델

### `tenants`

- `id uuid primary key`
- `name text not null`
- `created_at timestamptz not null`

### `api_keys`

- `id uuid primary key`
- `tenant_id uuid references tenants`
- `key_prefix text not null`
- `key_hash text unique not null`
- `revoked_at timestamptz null`
- `created_at timestamptz not null`

원문 API 키는 생성 시 한 번만 표시하고 SHA-256 해시만 저장한다.

### `reservation_jobs`

- 요청 필드: `destination_phone`, `place_name`, `customer_name`, `party_size`, `requested_at`, `request_notes`
- 제어 필드: `status`, `attempt_count`, `next_attempt_at`, `locked_by`, `locked_at`, `heartbeat_at`
- 결과 필드: `outcome jsonb`, `last_failure_reason`, `transcript jsonb`
- 감사 필드: `created_at`, `updated_at`, `completed_at`
- `(tenant_id, idempotency_key)` unique

### `call_attempts`

- `reservation_id`, `attempt_number`
- `provider_call_id`
- `status`, `answered_by`, `hangup_cause`
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`
- `(reservation_id, attempt_number)` unique

`claim_next_reservation(worker_id)` RPC는 claim 가능한 한 행을 잠그고 `dialing`, `locked_by`, `locked_at`, `heartbeat_at`, 증가된 `attempt_count`를 한 트랜잭션에서 반환한다.

## 7. 인증과 테넌트 격리

- MCP 요청은 `Authorization: Bearer call_<secret>` 헤더를 요구한다.
- 서버는 토큰을 SHA-256 해시하고 활성 `api_keys` 행을 찾아 `tenant_id`를 결정한다.
- 모든 예약 서비스 메서드는 `tenantId`를 명시적으로 받는다.
- 조회·취소 쿼리는 `tenant_id`와 예약 ID를 동시에 조건으로 사용한다.
- `SUPABASE_SERVICE_ROLE_KEY`, ClawOps 키, OpenAI 키는 `NEXT_PUBLIC_` 접두사를 사용하지 않는다.
- 브라우저용 anon client를 privileged MCP/worker 코드에서 재사용하지 않는다.

## 8. 음성 에이전트 동작

통화마다 별도의 `ClawOpsAgent`와 `OpenAIRealtime` 세션을 만든다. ClawOps SDK 0.32.0의 prewarm 구현이 단일 Agent 인스턴스에서 동시 아웃바운드를 가정하지 않으므로, worker slot 하나는 한 번에 통화 하나만 담당한다.

첫 발화는 다음 정보를 포함한다.

- 서비스 이름
- 고객을 대신한 AI 예약 도우미라는 사실
- 예약하려는 고객명, 인원, 희망 일시

에이전트는 `record_reservation_outcome` 도구를 반드시 호출해 다음 중 하나를 기록한다.

```ts
type ReservationOutcome =
  | { result: "confirmed"; confirmedAt: string; confirmationName?: string; notes?: string }
  | { result: "unavailable"; alternatives: string[]; notes?: string }
  | { result: "needs_human"; reason: string };
```

통화 종료 시 구조화된 outcome이 없으면 `needs_human`으로 종료한다. transcript 이벤트는 최종 발화만 순서대로 저장하며 오디오 녹음은 비활성화한다.

## 9. 오류와 재시도

- MCP 입력 오류는 tool-level 오류로 반환하며 작업을 만들지 않는다.
- 인증 실패는 MCP 처리 전 HTTP 401로 반환한다.
- DB 중복 키는 기존 작업 조회로 처리한다.
- 워커는 provider call ID를 받은 뒤 `call_attempts`에 즉시 기록한다.
- 프로세스 종료 시 Agent를 disconnect하고, 미완료 작업은 stale-lock 회수 대상이 된다.
- ClawOps API의 SDK 기본 재시도와 별개로 전화 재시도 정책은 예약 작업 상태 머신이 결정한다.
- 로그에는 API 키 원문, 전체 전화번호, 자유형 요청 메모를 기록하지 않는다.

## 10. 테스트 전략

- Vitest node 환경으로 스키마 검증, 상태 전이, idempotency, 테넌트 격리를 단위 테스트한다.
- MCP SDK client의 custom `fetch`로 실제 네트워크 없이 `/mcp` handler를 통합 테스트한다.
- Voice Worker는 `VoiceGateway` 인터페이스와 fake 구현으로 성공, 부재중, 재시도, 구조화 결과 누락을 테스트한다.
- ClawOps adapter 테스트에서는 SDK 모듈을 mock하고 `agent.call()`, 이벤트, `wait()`, `disconnect()` 호출 순서를 검증한다.
- 실제 전화 스모크 테스트는 `RUN_LIVE_CALL=true`와 목적지 번호를 명시한 경우에만 실행한다.
- 완료 전 `npm test`, `npm run lint`, `npm run build`를 모두 통과시킨다.

## 11. 운영 지표

최소한 다음 값을 구조화 로그 또는 DB 집계로 확인할 수 있어야 한다.

- queued에서 dialing까지 걸린 시간
- 발신 대비 connected 비율
- `no-answer`, `busy`, `rejected`, provider failure 비율
- connected에서 첫 AI 음성까지 걸린 시간
- confirmed, unavailable, needs_human 비율
- 테넌트별 일일 통화 시도 수와 통화 시간

## 12. 구현 분할

구현은 두 계획으로 나눈다.

1. MCP 예약 오케스트레이션: 인증, 데이터 모델, durable queue, MCP 도구와 통합 테스트
2. ClawOps Voice Worker: 작업 claim, OpenAI Realtime 대화, 결과 저장, 재시도와 live smoke test

첫 번째 계획은 전화 provider 없이도 작업 접수·조회·취소를 완성한다. 두 번째 계획은 첫 번째 계획의 저장소 계약을 소비한다.
