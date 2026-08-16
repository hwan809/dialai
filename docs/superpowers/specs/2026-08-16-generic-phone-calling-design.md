# 범용 MCP 전화 실행 MVP 설계

**작성일:** 2026-08-16  
**상태:** 승인됨  
**대체 대상:** `2026-08-16-mcp-reservation-calling-design.md`의 예약 전용 계약

## 1. 목표

사용자는 MCP 클라이언트에서 전화번호와 자유문장 목적을 전달하고, 시스템은 별도 워커에서 AI 전화를 실행한 뒤 확인된 사실과 요약을 반환한다.

대표 요청은 예약에 한정하지 않는다.

- 영업시간, 주차, 가격, 재고 등 정보 문의
- 음식점·미용실 등 예약 요청
- 변경 또는 취소 가능 여부 확인
- 사람의 판단이 필요하지 않은 단순 전화 업무

MVP는 정형화된 업무 템플릿보다 빠르게 동작하는 범용 목적 기반 계약을 우선한다.

## 2. 비목표

- 결제, 관리자 대시보드, 과금, 캠페인 발신
- 통화 녹음 파일 저장
- 사용자가 발신번호를 선택하는 기능
- 여러 통화를 한 프로세스에서 동시에 처리하는 기능
- 업무 유형별 별도 스키마와 화면
- 통화 중 MCP 연결을 유지하는 동기 실행

## 3. 아키텍처

```text
MCP Client
  -> Next.js /mcp Route Handler
  -> API-key authentication
  -> PhoneCallService
  -> Supabase phone_call_jobs
  -> always-on Voice Worker
  -> ClawOps 070 number
  -> OpenAI Realtime
  -> destination phone
```

MCP 서버는 전화 작업을 저장한 뒤 즉시 `callId`와 `queued` 상태를 반환한다. 실제 통화는 Vercel Route Handler 밖의 상시 실행 Node.js 워커가 수행한다.

## 4. MCP 계약

### `create_phone_call`

```ts
type CreatePhoneCallInput = {
  idempotencyKey: string;       // 테넌트 안에서 고유, 8~128자
  destinationPhone: string;     // 한국 국내 번호, 구분문자 허용
  objective: string;            // 전화로 수행할 목적, 1~1000자
  context?: string;             // AI가 참고할 배경 정보, 최대 2000자
  successCriteria?: string[];   // 확인해야 할 항목, 최대 10개
};

type CreatePhoneCallOutput = {
  callId: string;
  status: PhoneCallStatus;
  createdAt: string;
};
```

동일 테넌트와 `idempotencyKey`의 재호출은 새 전화를 만들지 않고 기존 작업을 반환한다.

### 나머지 도구

- `get_phone_call`: 같은 테넌트의 단일 작업과 결과를 조회한다.
- `list_phone_calls`: 같은 테넌트의 최근 작업을 최대 50개 조회한다.
- `cancel_phone_call`: `queued` 또는 `retry_scheduled` 작업만 취소한다.

모든 성공 응답은 사람이 읽는 `content`와 기계가 읽는 `structuredContent`를 함께 제공한다.

## 5. 상태와 결과

```ts
type PhoneCallStatus =
  | "queued"
  | "dialing"
  | "connected"
  | "retry_scheduled"
  | "completed"
  | "needs_human"
  | "failed"
  | "canceled";

type PhoneCallOutcome =
  | {
      result: "completed";
      summary: string;
      facts: Array<{ label: string; value: string }>;
      needsFollowUp: boolean;
    }
  | {
      result: "needs_human";
      summary: string;
      reason: string;
    };
```

```text
queued -> dialing -> connected -> completed
                           \----> needs_human
       -> retry_scheduled -> dialing
       -> failed
       -> canceled
```

`no-answer`, `busy`, 일시적 provider 실패만 한 번 재시도한다. 총 통화 시도는 최대 두 번이다. 결번·번호 변경·호환되지 않는 목적지는 재시도하지 않는다.

## 6. 저장 모델

`phone_call_jobs`는 요청, 큐 상태, 결과를 함께 저장한다.

- 요청: `destination_phone`, `objective`, `context`, `success_criteria`
- 상태: `status`, `attempt_count`, `next_attempt_at`, lock/heartbeat 필드
- 결과: `outcome jsonb`, `transcript jsonb`, `last_failure_reason`
- 격리: `tenant_id`, `(tenant_id, idempotency_key)` unique
- 감사: `created_at`, `updated_at`, `completed_at`

`phone_call_attempts`는 provider call ID, 시도 번호, 종료 상태, 통화 시간을 저장한다. Supabase RPC는 `FOR UPDATE SKIP LOCKED`로 하나의 작업을 원자적으로 claim한다.

## 7. 인증과 비밀정보

- MCP 요청은 `Authorization: Bearer call_<secret>`을 사용한다.
- DB에는 원문 API 키가 아닌 SHA-256 해시만 저장한다.
- privileged Supabase 키는 `SUPABASE_SECRET_KEY`를 우선하고 `SUPABASE_SERVICE_ROLE_KEY`를 호환용으로 허용한다.
- ClawOps와 OpenAI 키는 서버/워커에서만 읽는다.
- 발신번호는 `CLAWOPS_FROM_NUMBER`만 사용한다.
- 로그에는 비밀값, 전체 전화번호, 전체 자유문장 context를 기록하지 않는다.

## 8. 음성 에이전트

통화마다 별도의 `ClawOpsAgent`와 `OpenAIRealtime` 세션을 만든다.

- model: `gpt-realtime-2`
- voice: `marin`
- language: `ko`
- recording: disabled
- 첫 문장에서 고객을 대신해 전화한 AI 도우미임을 밝힌다.
- `objective`, `context`, `successCriteria`를 데이터 블록으로 전달한다.
- 상대방이 말하지 않은 정보는 추측하지 않는다.
- 목적을 달성하면 `record_call_outcome`을 정확히 한 번 호출한다.
- 결과 기록 후 감사 인사를 하고 `hang_up`으로 종료한다.

통화가 정상 종료됐지만 구조화 결과가 없으면 `needs_human`으로 저장한다.

## 9. 오류 처리

- MCP 입력 오류는 tool-level 오류로 반환하고 작업을 만들지 않는다.
- 인증 실패는 MCP 처리 전 HTTP 401로 반환한다.
- 워커 예외는 실패 사유를 저장한 뒤 정책에 따라 한 번 재시도한다.
- ClawOps의 상세 `hangupCause`는 통화 종료 후 REST 조회로 보완한다. 상세 조회가 실패하면 `endedStatus`만으로 안전하게 처리한다.
- heartbeat가 5분 이상 갱신되지 않은 작업은 stale로 회수하되 총 두 번의 시도 제한을 유지한다.

## 10. 테스트와 완료 조건

- Zod 입력 검증과 전화번호 정규화 단위 테스트
- idempotency와 테넌트 격리 repository/service 테스트
- 실제 MCP client를 사용하는 in-process 통합 테스트
- fake voice gateway를 사용하는 성공·재시도·needs-human 워커 테스트
- ClawOps SDK를 mock한 adapter 테스트
- 자동 테스트에서는 실제 전화를 걸지 않는다.
- `npm test`, `npm run lint`, `npm run build`를 통과한다.
- 마지막 단계에서만 사용자 승인 번호 `010-3613-7215`로 live smoke call을 한 번 실행한다.

## 11. MVP 완료 기준

1. MCP 클라이언트가 범용 전화 작업을 생성하고 즉시 `callId`를 받는다.
2. 워커가 작업을 claim하고 ClawOps/OpenAI Realtime으로 한 통씩 실행한다.
3. 전사, 요약, 확인된 사실, 후속 조치 필요 여부를 조회할 수 있다.
4. 동일 요청 중복 발신과 테넌트 간 데이터 노출이 차단된다.
5. 자동 검증과 승인된 실전화 한 건이 성공한다.
