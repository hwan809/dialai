# DialAI 종합 제품·기술 기획서

> Codex Community Hackathon Seoul for Students 2026 · 23팀
>
> 작성일: 2026-08-16
>
> 문서 상태: 팀 검토안
>
> 한 문장 소개: **웹이나 Codex에서 전화 업무를 맡기면, AI가 실제로 전화를 걸어 처리하고 결과까지 보고하는 전화 대행 에이전트**

## 0. Executive Summary

DialAI는 사용자가 자연어로 목적만 전달하면 요청을 구체화하고, 실제 전화망을 통해 상대방 또는 고객센터와 대화한 뒤, 처리 결과를 구조화해 돌려주는 AI 전화 대행 서비스다.

일반 사용자는 웹앱에서 요청부터 실시간 진행 확인과 결과 조회까지 수행한다. 에이전트 중심 사용자는 Codex CLI에서 “내일 저녁 7시에 식당 4명 예약해줘”라고 말하면, DialAI Skill이 자동으로 활성화되고 원격 MCP 도구가 같은 전화 실행 코어를 호출한다.

제품의 장기 목표는 병원, 통신사, 보험사, 공공기관 등 전화로만 해결되는 업무를 범용적으로 대행하는 것이다. 해커톤 MVP는 기술적 핵심을 가장 짧고 안전하게 증명하기 위해 **식당 예약 한 가지 시나리오**에 집중한다.

MVP 성공 기준은 다음과 같다.

1. 웹 또는 Codex에서 예약 요청을 입력한다.
2. 부족한 예약 정보를 확인한다.
3. 백엔드가 비동기 전화 작업을 생성한다.
4. AI가 서비스 소유 070 번호로 식당에 실제 전화를 건다.
5. AI가 자신을 예약 도우미라고 밝히고 자연스럽게 예약을 시도한다.
6. 통화 결과와 텍스트 전사를 저장한다.
7. 웹 또는 Codex에서 예약 확정·불가·사람 확인 필요 결과를 조회한다.

## 1. 문서 목적과 범위

이 문서는 다음 네 가지를 하나의 기준으로 통합한다.

- 장기 제품 비전과 사용자 가치
- 해커톤에서 구현할 현실적인 MVP 범위
- 웹, API, MCP/Skill, 전화 워커를 잇는 기술 아키텍처
- 구현·검증·배포·발표를 위한 완료 기준

이 문서는 제품·기술 설계의 상위 기준이다. 상세 구현 순서는 아래 기존 문서를 따른다.

- `docs/superpowers/specs/2026-08-16-mcp-reservation-calling-design.md`
- `docs/superpowers/plans/2026-08-16-mcp-reservation-orchestration.md`
- `docs/superpowers/plans/2026-08-16-clawops-voice-worker.md`

## 2. 문제 정의

### 2.1 사용자가 겪는 문제

상담사와 직접 통화해야 하는 업무는 여전히 많지만 연결 비용은 계속 높아지고 있다.

- 상담사 연결까지 5~10분 이상 기다린다.
- 통화가 끊기거나 나중에 다시 전화하라는 안내를 받는다.
- 재통화할 때마다 ARS와 대기 과정을 반복한다.
- 앱이나 웹에서 해결할 수 없는 예외 업무가 남아 있다.
- 예약과 일정 변경처럼 결과는 단순하지만 전달 과정은 길다.

사용자가 원하는 것은 전화를 거는 행위가 아니라 **업무가 완료된 결과**다. 현재 사용자는 단순한 결과를 얻기 위해 자신의 시간과 주의를 전화선에 계속 묶어두어야 한다.

### 2.2 기존 대안의 한계

| 대안 | 한계 |
|---|---|
| 사용자가 직접 전화 | 대기 시간과 반복 작업을 그대로 부담한다. |
| 전화 연결·녹음 앱 | 연결을 돕지만 상담 자체는 대신하지 않는다. |
| 챗봇·FAQ | 예외 업무와 상담사 권한이 필요한 업무를 처리하지 못한다. |
| 온라인 예약 서비스 | 제휴된 사업장만 가능하고 전화 전용 사업장을 포괄하지 못한다. |
| 범용 LLM | 요청을 이해할 수 있지만 실제 전화망에서 행동하지 못한다. |

## 3. 해결책과 제품 포지셔닝

DialAI는 단순한 음성봇이 아니라 **사용자의 목표를 받아 외부 전화 업무를 끝까지 수행하는 실행형 에이전트**다.

핵심 루프는 다음과 같다.

```text
자연어 요청
  → 요청 분석과 부족한 정보 확인
  → 실행 조건과 권한 확인
  → 비동기 전화 작업 생성
  → 전화·ARS·상담 수행
  → 필요 시 사용자 판단 요청
  → 성공 또는 실패 결과 구조화
  → 전체 전사·요약·최종 결과 보고
```

제품의 차별점은 세 가지다.

1. **결과 중심:** 전화 연결이 아니라 예약·변경·문의 완료를 반환한다.
2. **채널 독립성:** 웹 사용자와 Codex CLI 사용자가 같은 실행 코어를 쓴다.
3. **Human-in-the-loop:** AI가 임의로 결정하면 안 되는 순간에 사용자가 개입할 수 있다.

## 4. 타깃 사용자

### 4.1 일반 사용자

- 전화 대기와 반복 연락에 피로를 느끼는 사용자
- 업무 중 직접 통화하기 어려운 직장인과 학생
- 전화 예약이나 일정 변경을 자주 수행하는 사용자
- 음성 통화에 부담을 느끼거나 접근성 지원이 필요한 사용자

주요 인터페이스는 모바일과 데스크톱 웹앱이다.

### 4.2 Heavy Agentic 사용자

- Codex CLI를 일상 업무 인터페이스로 사용하는 개발자와 파워 유저
- 여러 도구와 MCP 서버를 조합해 개인 자동화를 수행하는 사용자
- 전화 업무를 다른 에이전트 워크플로우의 한 단계로 넣고 싶은 사용자

주요 인터페이스는 Codex Plugin의 Skill과 원격 Streamable HTTP MCP다.

### 4.3 플랫폼·B2B 사용자

- 자사 에이전트에 전화 실행 능력을 추가하려는 SaaS 사업자
- 예약, 고객 확인, 일정 조율을 자동화하려는 운영팀
- 내부 에이전트가 전화 업무를 위임해야 하는 조직

초기 MVP의 직접 대상은 아니지만 동일한 API와 MCP가 확장 기반이 된다.

## 5. 타깃 업무와 우선순위

| 단계 | 영역 | 대표 업무 | 이유 |
|---|---|---|---|
| MVP | 식당 | 신규 예약 | 본인인증과 범용 ARS 없이 실제 전화 가치를 증명하기 쉽다. |
| 1차 확장 | 병원·미용실 | 예약·일정 변경·문의 | 예약 도메인 계약을 재사용할 수 있다. |
| 2차 확장 | 통신사·공과금 | 설치 일정·요금 문의 | ARS, 대기, 계정 확인의 가치가 크다. |
| 3차 확장 | 보험사·공공기관 | 계약·처리 상황 문의 | 높은 가치가 있지만 인증·법무·감사 요구가 크다. |

범용 고객센터 지원은 제품 비전이지만 해커톤 MVP에서는 구현하지 않는다.

## 6. 제품 원칙

1. **실행 전 명확화:** 필수 정보가 없으면 전화를 시작하지 않는다.
2. **외부 행동 전 확인:** 통화 비용 또는 예약 변경을 발생시키기 전에 사용자에게 실행 내용을 보여준다.
3. **AI 정체성 공개:** 상담 상대에게 AI 예약 도우미이며 누구를 대신하는지 알린다.
4. **최소 권한:** 요청을 완료하는 데 필요한 정보와 도구만 사용한다.
5. **추측 금지:** 확정되지 않은 예약 결과를 성공으로 보고하지 않는다.
6. **비동기 우선:** 웹 요청이나 MCP 호출을 통화 종료까지 붙잡아두지 않는다.
7. **채널 간 동일성:** 웹과 MCP의 결과·상태·오류 의미를 동일하게 유지한다.
8. **민감정보 최소화:** MVP에서는 주민등록번호와 금융정보를 수집하지 않는다.

## 7. 사용자 경험

### 7.1 웹앱 흐름

```text
홈 화면
  → “전화로 무엇을 처리할까요?”에 자연어 입력
  → AI가 날짜·시간·인원·예약자명 등 부족한 정보 질문
  → 전화 대상과 요청 조건 확인 카드
  → [전화 시작]
  → queued / dialing / connected 상태 표시
  → 통화 전사와 주요 이벤트 표시
  → 통화 종료
  → 예약 결과 카드 + 요약 + 전체 전사
```

웹 핵심 화면은 다음 네 개다.

1. **요청 작성:** 자연어 입력과 추천 예시
2. **요청 구체화:** 채팅형 질문과 구조화 필드 확인
3. **통화 진행:** 상태, 경과 시간, 전사, 취소 가능 여부
4. **결과:** 확정 내용, 실패 이유, 대안, 전체 기록

### 7.2 Codex CLI 흐름

```text
사용자: 내일 저녁 7시에 코덱스 식당 4명 예약해줘

Codex
  → DialAI Skill 자동 활성화
  → 누락된 예약자명·전화번호·선호사항 확인
  → 실행 조건 요약 및 최종 확인
  → create_reservation_call MCP 호출
  → reservationId와 queued 상태 반환
  → get_reservation_status로 진행 상태 확인
  → 최종 결과와 전사 요약 출력
```

사용자는 Skill 이름이나 MCP 도구 이름을 직접 입력하지 않는다. Skill의 이름과 설명은 “전화해줘”, “예약해줘”, “일정 변경해줘”, “고객센터에 문의해줘” 같은 사용자 목표를 중심으로 작성한다.

### 7.3 장기 범용 흐름

범용 고객센터 단계에서는 다음 흐름을 추가한다.

```text
ARS 탐색
  → DTMF 메뉴 선택
  → 안전한 본인확인 브리지
  → 상담사 연결
  → 대화 중 정책 범위 내 자율 처리
  → 판단 필요 시 사용자 개입 요청
  → 사용자 답변 수신 후 통화 재개
```

## 8. 기능 요구사항

### 8.1 MVP P0

| 기능 | 완료 조건 |
|---|---|
| 예약 요청 구체화 | 식당명, 전화번호, 예약자명, 인원, 시간대가 모두 확보된다. |
| 비동기 작업 생성 | 요청 직후 고유 ID와 `queued` 상태를 반환한다. |
| 실제 전화 발신 | 서비스 소유 070 번호로 지정 식당에 발신한다. |
| 자연스러운 예약 통화 | AI가 정체성을 밝히고 예약 정보를 전달한다. |
| 구조화 결과 | `confirmed`, `unavailable`, `needs_human` 중 하나로 저장한다. |
| 전사 저장 | 최종 음성 발화를 시간 순서대로 저장한다. |
| 웹 결과 조회 | 진행 상태와 최종 결과를 웹에서 확인한다. |
| Codex MCP 조회 | 생성, 조회, 목록, 취소 도구가 동작한다. |
| Codex Skill 자동 활성화 | 사용자가 도구 이름 없이 예약을 요청하면 DialAI 워크플로우를 선택한다. |
| 실패 처리 | 부재중, 통화중, 거절, 잘못된 번호를 구분한다. |
| 중복 방지 | 같은 idempotency key로 중복 전화가 생성되지 않는다. |

### 8.2 MVP P1

- 웹에서 Supabase Realtime 또는 SSE로 상태와 전사를 자동 갱신한다.
- 첫 부재중 또는 통화중에 한해 한 번 재시도한다.
- 예약 불가 시 대체 가능한 시간을 구조화한다.
- 통화 요약 문장을 자동 생성한다.
- DialAI Skill과 MCP 설정을 설치 가능한 Plugin 형태로 패키징한다.

### 8.3 Stretch

- 통화 중 사용자에게 선택지를 제시하고 답변을 전화 세션에 전달한다.
- 고정된 단일 ARS 시나리오에서 DTMF 입력을 수행한다.
- 식당 전화번호 검색 또는 주소 기반 사업장 식별을 추가한다.
- 사용자별 통화 이력과 자주 쓰는 예약자 정보를 제공한다.

### 8.4 Post-MVP

- 범용 ARS 음성 이해와 메뉴 탐색
- 본인확인 전용 안전 브리지
- 병원·통신사·보험사·공공기관 도메인 정책
- OAuth 기반 외부 에이전트 인증
- 다국어 통화
- 음성 개인화와 명시적 동의 기반 Voice Cloning
- 결제, 사용량 제한, 관리자 운영 대시보드

## 9. 전체 시스템 아키텍처

```text
┌────────────────────────── 사용자 채널 ──────────────────────────┐
│                                                                │
│  Next.js Web App                         Codex CLI              │
│  요청·진행·전사·결과                     DialAI Skill           │
│       │                                      │                  │
│       │ HTTPS / Realtime                     │ MCP tools        │
└───────┼──────────────────────────────────────┼──────────────────┘
        │                                      │
        ▼                                      ▼
┌──────────────── Vercel / Next.js Backend for Frontend ─────────┐
│  Web API Route Handlers    /mcp Streamable HTTP Route Handler  │
│           │                         │                           │
│           └──────── Reservation Service ─────┘                  │
│                  인증 · 입력 검증 · idempotency                 │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────── Supabase ────────────────────────────────┐
│ Postgres durable queue · tenants · api_keys · reservation_jobs │
│ call_attempts · transcript · outcome · Realtime events         │
└───────────────────────────┬────────────────────────────────────┘
                            │ atomic claim
                            ▼
┌──────────────── Always-on Voice Worker ────────────────────────┐
│ 상태 머신 · retry · heartbeat · ClawOps adapter                │
│                            │                                   │
│                            ▼                                   │
│ ClawOps 070 / Media WebSocket ↔ OpenAI Realtime Voice Agent   │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
                      실제 식당 전화망
```

### 9.1 핵심 경계

- Next.js는 웹과 MCP의 진입점이며 통화를 직접 실행하지 않는다.
- Supabase Postgres가 MVP의 내구성 있는 큐와 결과 저장소 역할을 겸한다.
- Voice Worker는 장시간 WebSocket과 통화 세션을 유지할 수 있는 별도 프로세스다.
- 웹 API와 MCP는 동일한 `ReservationService`를 호출한다.
- 전화 공급자는 `VoiceGateway` 인터페이스 뒤에 감춰 교체 가능하게 한다.

## 10. 기술 스택

### 10.1 확정 MVP 스택

| 영역 | 기술 | 선택 이유 |
|---|---|---|
| 언어 | TypeScript 5 | 웹, MCP, 워커 계약을 한 타입 체계로 공유한다. |
| 웹 프레임워크 | Next.js 16.3.1 App Router | 현재 저장소 기반이며 웹 UI와 Route Handler를 함께 제공한다. |
| UI | React 19.2.8, Tailwind CSS 4 | 빠른 반응형 UI 구성과 현재 프로젝트 호환성 때문이다. |
| 웹/API 배포 | Vercel | Next.js 배포와 공개 데모 URL 생성이 빠르다. |
| 데이터베이스 | Supabase Postgres | 작업 큐, 결과, 테넌트, 통화 시도를 관계형으로 저장한다. |
| 실시간 UI | Supabase Realtime, 필요 시 SSE | 상태·전사 변경을 웹에 전달한다. |
| LLM·음성 | OpenAI Realtime | 실시간 음성 입출력, 대화, 도구 호출을 한 세션에서 처리한다. |
| 전화망 | ClawOps 070 발신 | 한국 전화망 아웃바운드와 미디어 연결을 담당한다. |
| MCP | Streamable HTTP MCP server | Codex CLI와 다른 에이전트가 원격으로 호출할 수 있다. |
| 입력 검증 | Zod | 웹 API, MCP, 워커 경계의 런타임 입력을 검증한다. |
| 단위·통합 테스트 | Vitest | TypeScript 모듈과 fake adapter를 빠르게 검증한다. |
| Voice Worker 배포 | Railway 우선, Fly.io·Render 대체 | 장시간 실행 프로세스와 WebSocket을 유지한다. |
| 로그 | 구조화 JSON 로그 | 상태 전이와 실패 원인을 검색하고 발표 근거로 사용한다. |

### 10.2 OpenAI 모델 정책

- 음성 세션 모델은 서버 환경변수로 관리한다.
- MVP 최초 검증 모델은 기존 음성 워커 계획의 `gpt-realtime-2`다.
- 계정에서 해당 모델을 사용할 수 없는 경우, 공식 OpenAI 문서에서 해당 프로젝트에 노출된 Realtime 모델로 명시적으로 교체한다.
- 모델 이름은 클라이언트 입력으로 받지 않는다.
- 통화 결과는 모델의 자유형 문장이 아니라 `record_reservation_outcome` 도구 결과로 확정한다.

### 10.3 배포 선택 이유

Next.js Route Handler는 공개 웹 API와 MCP 처리에 적합하지만 장시간 음성 WebSocket을 유지하는 전화 워커의 실행 장소로 사용하지 않는다. 워커는 항상 실행 가능한 별도 컨테이너에 두고, 데이터베이스 작업을 원자적으로 claim한다.

## 11. 컴포넌트 책임

### 11.1 Web App

- 자연어 요청 입력
- 부족한 정보 질문 및 구조화 필드 표시
- 실행 전 최종 확인
- 통화 상태와 전사 표시
- 최종 결과·대안·실패 이유 표시

### 11.2 Reservation Service

- 요청 검증과 전화번호 정규화
- idempotency 보장
- 테넌트별 작업 생성·조회·목록·취소
- 웹 API와 MCP가 공유하는 도메인 계약 제공

### 11.3 MCP Server

- Codex와 외부 에이전트에 최소 도구 집합 노출
- Bearer API key 인증
- 도구 입력과 결과를 구조화
- 실제 전화가 끝나기 전에 즉시 응답

### 11.4 DialAI Skill

- 전화·예약 요청을 자연어 의도로 감지
- 부족한 정보를 질문하는 순서 정의
- 외부 행동 전 확인 규칙 적용
- MCP 도구 호출 순서와 실패 복구 방식 안내
- 최종 출력 형식 통일

### 11.5 Voice Worker

- 작업 claim과 heartbeat
- ClawOps 및 OpenAI Realtime 세션 생성
- 통화 이벤트·전사·구조화 결과 저장
- 재시도 정책 실행
- 정상 종료와 stale lock 회수

### 11.6 Voice Gateway

- 전화 공급자 SDK를 도메인 로직에서 분리
- `call(job, callbacks)` 계약으로 발신·연결·전사·종료 이벤트 제공
- fake 구현으로 실제 전화 없이 상태 머신 테스트 가능

## 12. 데이터 모델

### 12.1 MVP 테이블

#### `tenants`

- `id uuid primary key`
- `name text not null`
- `created_at timestamptz not null`

#### `api_keys`

- `id uuid primary key`
- `tenant_id uuid references tenants`
- `key_prefix text not null`
- `key_hash text unique not null`
- `revoked_at timestamptz null`
- `created_at timestamptz not null`

원문 키는 생성 시 한 번만 표시하고 SHA-256 해시만 저장한다.

#### `reservation_jobs`

- 요청: `destination_phone`, `place_name`, `customer_name`, `party_size`, `requested_at`, `request_notes`
- 제어: `status`, `attempt_count`, `next_attempt_at`, `locked_by`, `locked_at`, `heartbeat_at`
- 결과: `outcome jsonb`, `last_failure_reason`, `transcript jsonb`
- 감사: `created_at`, `updated_at`, `completed_at`
- 고유 제약: `(tenant_id, idempotency_key)`

#### `call_attempts`

- `reservation_id`, `attempt_number`
- `provider_call_id`
- `status`, `answered_by`, `hangup_cause`
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`
- 고유 제약: `(reservation_id, attempt_number)`

### 12.2 장기 일반화

MVP에서는 예약 도메인을 `reservation_jobs`로 명시적으로 유지한다. 병원, 통신사, 보험사 등 서로 다른 정책을 실제로 지원하기 전까지 범용 추상화를 서두르지 않는다.

다음 단계에서 공통 필드와 도메인별 payload가 안정화되면 `call_tasks`와 `task_type` 기반 모델로 확장한다.

## 13. 상태 모델

### 13.1 사용자 요청 준비 상태

```text
collecting_information
  → ready_for_confirmation
  → confirmed_by_user
  → queued
```

이 상태는 웹 또는 Skill의 요청 구체화 단계다. 전화 작업은 사용자가 실행을 확인한 뒤에만 생성한다.

### 13.2 전화 작업 상태

```text
queued
  ├→ dialing
  │    ├→ connected
  │    │    ├→ confirmed
  │    │    ├→ unavailable
  │    │    └→ needs_human
  │    ├→ retry_scheduled → dialing
  │    └→ failed
  └→ canceled
```

최종 상태는 `confirmed`, `unavailable`, `needs_human`, `failed`, `canceled`다.

### 13.3 결과 계약

```ts
type ReservationOutcome =
  | {
      result: "confirmed";
      confirmedAt: string;
      confirmationName?: string;
      notes?: string;
    }
  | {
      result: "unavailable";
      alternatives: string[];
      notes?: string;
    }
  | {
      result: "needs_human";
      reason: string;
    };
```

구조화 결과가 없는 완료 통화는 성공으로 추측하지 않고 `needs_human`으로 처리한다.

## 14. Web API 계약

웹앱은 MCP를 우회 호출하지 않고 같은 서비스 레이어를 직접 사용한다.

| 메서드·경로 | 역할 |
|---|---|
| `POST /api/reservations` | 예약 전화 작업 생성 |
| `GET /api/reservations/:id` | 상태, 결과, 전사 조회 |
| `GET /api/reservations?limit=20` | 최신 작업 목록 조회 |
| `POST /api/reservations/:id/cancel` | 발신 전 작업 취소 |
| `GET /api/reservations/:id/events` | P1 상태·전사 SSE 스트림 |

생성 요청은 다음 필드를 요구한다.

```ts
type CreateReservationInput = {
  idempotencyKey: string;
  destinationPhone: string;
  placeName: string;
  customerName: string;
  partySize: number;
  requestedAt: string; // timezone 포함 ISO 8601
  requestNotes?: string;
};
```

서버는 날짜 형식, 한국 전화번호, 인원 범위, 문자열 길이를 검증한다.

## 15. MCP와 Skill 설계

### 15.1 MCP 도구

| 도구 | 유형 | 역할 |
|---|---|---|
| `create_reservation_call` | 외부 행동 | 예약 전화 작업 생성 후 ID 반환 |
| `get_reservation_status` | 읽기 | 상태·결과·최근 실패 이유 조회 |
| `list_reservations` | 읽기 | 최근 작업 목록 조회 |
| `cancel_reservation_call` | 외부 행동 | 아직 발신하지 않은 작업 취소 |

P1 이후 사용자 개입을 지원할 때 `respond_to_call`을 추가한다. 서로 다른 권한과 부작용을 가진 읽기·쓰기를 하나의 도구에 합치지 않는다.

### 15.2 비동기 원칙

`create_reservation_call`은 전화가 끝날 때까지 기다리지 않는다.

```json
{
  "reservationId": "uuid",
  "status": "queued",
  "createdAt": "2026-08-16T14:00:00+09:00"
}
```

Codex는 반환된 ID로 상태를 조회한다. 이렇게 해야 긴 통화가 MCP 도구 타임아웃이나 CLI 세션에 종속되지 않는다.

### 15.3 Skill 활성화 설명

Skill 설명은 구현 기술이 아니라 사용자 의도를 중심으로 작성한다.

```text
사용자가 식당·병원·사업장에 전화해 예약하거나 일정을 변경하고,
문의 또는 고객센터 업무를 대신 처리해 달라고 요청할 때 사용한다.
실제 전화 전 부족한 정보를 수집하고 사용자 확인을 받은 뒤
DialAI MCP 도구로 작업을 만들고 결과를 조회한다.
```

### 15.4 Codex 설치 형태

MVP는 다음 두 경로를 제공한다.

1. 원격 Streamable HTTP MCP 서버 URL과 Bearer token을 Codex에 등록한다.
2. DialAI Skill과 MCP 설정을 하나의 Codex Plugin으로 패키징한다.

ChatGPT의 공식 Restaurant Reserve 전환 규격은 승인 파트너 대상 베타이므로 MVP 의존성이 아니다. DialAI는 먼저 일반 MCP 도구와 Codex Skill로 동작하고, 파트너 접근 권한이 생길 때 해당 계약을 별도 호환 계층으로 추가한다.

## 16. 음성 에이전트 설계

### 16.1 전화 시작 발화

AI는 통화 시작 직후 다음 정보를 자연스럽게 알린다.

- 자신이 고객을 대신한 AI 예약 도우미라는 사실
- 예약자명
- 예약 인원과 희망 일시
- 추가 선호사항

예시:

> 안녕하세요. 홍길동 님을 대신해 예약을 도와드리는 AI 도우미입니다. 내일 저녁 7시에 네 명 예약이 가능한지 문의드리려고 전화드렸습니다.

### 16.2 대화 정책

- 상대방 말을 끊지 않고 짧은 문장으로 답한다.
- 예약과 직접 관련 없는 질문에는 목적을 다시 설명한다.
- 확정 시간, 이름, 인원은 종료 전에 한 번 재확인한다.
- 가격 약정, 결제, 민감정보 제공은 수행하지 않는다.
- 판단 근거가 없는 대안을 임의로 수락하지 않는다.
- 상대방이 AI 통화를 거절하면 통화를 종료하고 `needs_human`으로 기록한다.

### 16.3 도구 사용

Realtime 에이전트는 `record_reservation_outcome`을 사용해 결과를 확정한다. 통화가 끝났지만 도구가 호출되지 않았다면 워커가 성공을 추론하지 않는다.

### 16.4 ARS와 DTMF

MVP에서는 범용 ARS 탐색을 지원하지 않는다. 전화 대상은 상담원이 직접 응답하는 식당을 우선한다.

Stretch에서 고정된 테스트 ARS 한 개에 대해 `SEND_DTMF` 동작을 증명한다. 범용 ARS는 다음 별도 서브시스템이 필요하다.

- 음성 안내 구간 탐지
- 메뉴 선택 이유와 탐색 이력
- DTMF 입력 확인
- 반복 메뉴와 잘못된 입력 복구
- 상담사 연결 판단

## 17. 통화 중 사용자 개입

### 17.1 제품 비전

AI가 미리 위임받지 않은 선택을 요구받으면 통화를 유지하면서 사용자에게 질문한다.

```text
상담사 질문
  → Agent가 결정 불가 판정
  → call_action_required 이벤트 저장
  → 웹 버튼 또는 Codex 메시지로 사용자 질문
  → 사용자 응답 저장
  → Realtime 세션에 답변 전달
  → 통화 재개
```

### 17.2 MVP 범위

해커톤 P0에서는 전화 전 조건을 충분히 구체화해 통화 중 개입 가능성을 줄인다. 통화 중 실시간 개입은 Stretch다. 예상하지 못한 선택이 필요하면 임의로 결정하지 않고 `needs_human`으로 종료해 보고한다.

## 18. 실패·재시도 정책

| 실패 | 사용자 결과 | 재시도 |
|---|---|---|
| 부재중 `no-answer` | 연결되지 않음 | 첫 시도 후 10분 뒤 1회 |
| 통화중 `busy` | 상대방 통화중 | 첫 시도 후 10분 뒤 1회 |
| 상대방 거절 | 전화 수신 거절 | 없음 |
| 잘못된 번호 | 번호 확인 필요 | 없음 |
| AI 통화 거절 | 사람 통화 필요 | 없음, `needs_human` |
| 예약 불가 | 대안 시간과 함께 보고 | 없음 |
| 결과 구조 누락 | 사람이 전사 확인 필요 | 없음, `needs_human` |
| 일시적 공급자 오류 | 기술적 연결 실패 | 최대 1회 |
| 워커 중단 | stale 작업 회수 | 5분 후 재큐잉 가능 |

한 예약의 총 발신 시도는 최대 2회다. 전화 공급자 자체 재시도와 예약 작업 재시도를 분리해 중복 발신을 방지한다.

## 19. 인증·보안·개인정보

### 19.1 MVP 인증

- MCP는 `Authorization: Bearer call_<secret>`을 요구한다.
- 원문 API key는 저장하지 않고 SHA-256 해시만 저장한다.
- 모든 조회와 변경은 `tenant_id`를 조건으로 포함한다.
- 서버 전용 키는 `NEXT_PUBLIC_` 환경변수에 넣지 않는다.
- 클라이언트가 발신번호나 OpenAI 모델을 선택할 수 없다.

### 19.2 웹 인증

해커톤 데모는 제한된 테스트 사용자와 목적지 번호로 운영한다. 제품화 단계에서는 Supabase Auth와 Row Level Security를 사용해 사용자별 작업과 전사를 격리한다.

### 19.3 개인정보 정책

- MVP는 주민등록번호, 계좌번호, 카드번호를 수집하지 않는다.
- 로그에는 전체 전화번호와 자유형 요청 원문을 남기지 않는다.
- 전화번호는 화면과 로그에서 마스킹한다.
- 통화 녹음은 기본 비활성화하고 텍스트 전사만 저장한다.
- 전사 보존 기간과 삭제 기능은 제품화 전에 명시한다.
- 실제 고객센터 확장 전 개인정보 처리, 위임, 녹음 고지, AI 표시 의무를 법률 검토한다.

### 19.4 본인확인 장기 구조

AI가 주민등록번호 같은 민감정보를 직접 저장하고 반복 입력하는 구조를 기본으로 삼지 않는다. 향후에는 다음 원칙을 적용한다.

- 일회성 인증 토큰 또는 사용자 직접 입력 구간
- 통화 중 사용자에게 인증 세션을 안전하게 넘기는 브리지
- 인증 완료 여부만 에이전트에 전달
- 인증 값은 전사·로그·모델 컨텍스트에 남기지 않음

## 20. 관측성과 운영 지표

### 20.1 기술 지표

- `queued → dialing` 대기 시간
- 발신 대비 연결률
- 연결 후 첫 AI 음성까지의 시간
- 통화 평균 길이
- 부재중·통화중·거절·공급자 실패 비율
- 워커 stale lock 회수 횟수
- MCP 도구 성공률과 평균 응답 시간

### 20.2 제품 지표

- 예약 확정률
- `needs_human` 비율
- 요청부터 결과까지의 총 소요 시간
- 사용자가 직접 통화하지 않고 절약한 대기 시간
- 재사용률과 사용자당 월간 전화 작업 수
- 웹 대비 MCP 채널 사용 비율

### 20.3 로그 원칙

모든 로그는 `reservationId`, `attemptNumber`, `workerId`, 상태 전이, 오류 코드를 포함한다. API key, 전체 전화번호, 전체 전사, 민감한 요청 메모는 구조화 로그에서 제외한다.

## 21. 테스트 전략

### 21.1 단위 테스트

- 예약 입력 스키마와 한국 전화번호 정규화
- 상태 전이와 종료 상태
- 재시도 분류
- 결과 스키마
- API key 해시와 tenant 격리

### 21.2 통합 테스트

- MCP client로 create/get/list/cancel 도구 계약 검증
- 웹 API와 서비스 레이어 계약 검증
- Supabase repository idempotency와 atomic claim 검증
- fake `VoiceGateway`로 성공·불가·부재중·결과 누락 시나리오 검증

### 21.3 실제 전화 테스트

- `RUN_LIVE_CALL=true`와 명시적 목적지 번호가 있을 때만 실행한다.
- 팀 소유 테스트 번호 또는 통화 동의를 받은 번호만 사용한다.
- 실제 식당 데모 전 영업 방해가 되지 않도록 한 번의 검증된 시나리오를 사용한다.
- 테스트 결과에는 전체 번호와 개인정보를 남기지 않는다.

### 21.4 완료 전 명령

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

기본 Turbopack 빌드가 실행 환경 제한에 걸릴 경우 공식 Next.js 옵션인 `next build --webpack`으로 애플리케이션 코드와 환경 문제를 분리한다. 최종 배포 환경에서는 기본 빌드 경로를 다시 확인한다.

## 22. 배포 구조

### 22.1 Vercel

- Next.js 웹앱
- Web API Route Handlers
- `/mcp` Streamable HTTP Route Handler
- 전화 공급자와 OpenAI의 Webhook 수신

### 22.2 Supabase

- Postgres 데이터 저장
- 작업 claim RPC
- 제품화 단계의 Auth와 RLS
- 웹 상태 갱신용 Realtime

### 22.3 Voice Worker

- Railway에 상시 프로세스로 배포
- 한 프로세스의 MVP 동시 통화 수는 1
- `SIGINT`, `SIGTERM`에서 세션과 WebSocket을 정상 종료
- 30초 heartbeat와 5분 stale 회수

### 22.4 필수 환경변수

```text
OPENAI_API_KEY
OPENAI_REALTIME_MODEL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CLAWOPS_API_KEY
CLAWOPS_ACCOUNT_ID
CLAWOPS_FROM_NUMBER
VOICE_WORKER_ID
```

비밀값은 Repository, 브라우저 번들, README, Build Log에 포함하지 않는다.

## 23. 해커톤 MVP 범위

### 23.1 반드시 구현

- 식당 예약 요청 한 종류
- 웹에서 요청 생성과 결과 조회
- Codex에서 자연어 요청 후 MCP 생성·조회
- 실제 전화 발신 1회 이상 성공
- OpenAI Realtime 자연어 통화
- 구조화된 예약 결과 저장
- 실패 상태 한 가지 이상 표시
- 공개 웹 URL
- 재현 가능한 실행 방법

### 23.2 구현하면 좋은 것

- 웹 실시간 상태 갱신
- 전체 전사 표시
- 대안 시간 표시
- 부재중 1회 재시도
- 배포 가능한 Plugin 패키지

### 23.3 이번 MVP에서 제외

- 범용 ARS 탐색
- 실제 주민등록번호와 금융정보 처리
- 보험·통신사·공공기관 업무
- 통화 중 강제 취소
- 통화 중 사용자 실시간 개입
- Voice Cloning
- 결제와 요금제
- 셀프서비스 API key 발급 UI
- 범용 사업장 검색 엔진

## 24. 대표 데모 시나리오

### 24.1 웹 데모

1. 사용자가 “내일 저녁 7시에 코덱스 식당 4명 예약해줘”라고 입력한다.
2. AI가 예약자명과 선호사항을 질문한다.
3. 사용자가 조건을 확인하고 전화를 시작한다.
4. 화면이 `queued → dialing → connected`로 바뀐다.
5. 실제 테스트 전화가 연결되고 AI가 예약 대화를 수행한다.
6. 통화가 종료되면 다음 결과 카드가 나타난다.

```text
예약 완료
코덱스 식당
2026년 8월 17일 오후 7시
4명 · 홍길동
요청사항: 조용한 자리 선호
```

### 24.2 Codex CLI 데모

```text
> 내일 저녁 7시에 코덱스 식당 4명 예약해줘

Codex: 예약자명과 식당 전화번호가 필요합니다.
사용자: 홍길동, 02-1234-5678이야.
Codex: 해당 조건으로 AI 전화 예약을 시작할까요?
사용자: 시작해.
Codex: DialAI로 예약 전화를 접수했습니다. 작업 ID는 ... 입니다.
Codex: 예약이 완료되었습니다. 내일 오후 7시, 4명, 홍길동 이름으로 확정되었습니다.
```

### 24.3 데모 실패 대비

- 실제 전화 스모크 테스트를 발표 전에 완료한다.
- 통화 실패 시 실패 상태와 원인을 보여주는 보조 시나리오를 준비한다.
- 녹화 영상은 실제 배포 화면과 실제 통화 결과를 사용한다.
- 성공하지 않은 기능을 합성 화면으로 완성된 것처럼 표현하지 않는다.

## 25. 팀 분업

| 역할 | 책임 | 통합 산출물 |
|---|---|---|
| Web UX | 요청·진행·결과 화면, 실시간 상태 | 공개 웹 데모 |
| API·MCP | 도메인 계약, Supabase, 인증, MCP 도구 | 작업 생성·조회·취소 |
| Voice | ClawOps, OpenAI Realtime, 워커, 재시도 | 실제 전화 성공 |
| Integration·Insight | E2E 검증, README, Build Log, 발표·영상 | 제출 가능한 증거 |

공유 타입과 상태 이름은 API·MCP 담당이 정의하고, Voice와 Web이 같은 계약을 소비한다. 전화 공급자 연동을 기다리는 동안 Web은 fake 상태 이벤트, Voice는 fake repository로 병렬 개발한다.

## 26. 구현 순서

### Phase 1: 계약과 작업 큐

- 예약 입력과 결과 타입
- 상태 모델
- Supabase migration과 repository
- idempotency와 tenant 격리
- create/get/list/cancel MCP 도구

완료 증거: 실제 전화 없이도 MCP로 작업을 만들고 조회·취소할 수 있다.

### Phase 2: 실제 전화 워커

- `VoiceGateway`와 fake 구현
- ClawOps adapter
- OpenAI Realtime prompt와 결과 도구
- 워커 claim, heartbeat, retry
- opt-in live smoke test

완료 증거: 테스트 번호로 실제 통화하고 구조화 결과를 DB에 저장한다.

### Phase 3: 웹 경험

- 요청 작성과 확인
- 작업 생성
- 진행 상태와 전사
- 결과 카드와 실패 화면

완료 증거: 공개 URL에서 요청부터 결과까지 확인한다.

### Phase 4: Codex Plugin

- 전화 예약 Skill
- 원격 MCP 설정
- 자연어 트리거 시나리오 테스트
- 외부 행동 전 확인 규칙

완료 증거: Codex CLI에서 도구 이름을 말하지 않고 예약 전화가 시작된다.

### Phase 5: 통합과 제출

- E2E 대표 시나리오
- lint, typecheck, test, build
- README와 환경변수 문서
- Build Log
- 발표자료와 데모 영상

## 27. 로드맵

### Stage 0: Hackathon Proof

- 식당 예약
- 웹 + Codex MCP
- 실제 전화와 결과 저장

### Stage 1: Reservation Agent

- 병원·미용실·식당 템플릿
- 실시간 전사
- 사용자 프로필과 이력
- 대안 시간 협상

### Stage 2: Human-in-the-loop

- 통화 중 질문 이벤트
- 웹·Codex 응답 전달
- 통화 유지와 타임아웃 정책
- 사용자 승인 로그

### Stage 3: Customer Center Agent

- 범용 ARS 탐색
- DTMF
- 대기 구간 처리
- 안전한 인증 브리지
- 통신사·공과금 도메인 정책

### Stage 4: Platform

- OAuth와 조직 계정
- 사용량·비용·결제
- 공개 API와 파트너 Plugin
- 관측성·감사·관리자 도구
- 다국어와 국가별 전화망

## 28. Value & Viability

### 28.1 사용자 가치

- 대기 시간과 반복 전화 제거
- 전화 업무를 비동기 작업으로 전환
- 통화 결과를 검색 가능한 텍스트로 보존
- 전화 접근성 개선
- 다른 에이전트 워크플로우에 실제 행동 능력 추가

### 28.2 사업 가치

- 통화 시도 또는 성공 작업 단위 과금
- 개인용 구독과 조직용 사용량 요금제
- 예약·고객센터 SaaS에 전화 실행 API 제공
- 도메인별 고품질 에이전트 템플릿 판매

### 28.3 초기 과금 가설

해커톤 MVP에서는 결제를 구현하지 않는다. 제품화 검증 단계에서는 다음 두 안을 실험한다.

- 개인: 월 구독 + 포함 통화 분수
- API·MCP: 성공 작업 또는 통화 분수 기반 사용량 과금

### 28.4 비용 구조

- 전화망 발신·통화 비용
- Realtime 오디오 토큰 비용
- 워커 실행 비용
- 데이터베이스·로그·전사 저장 비용
- 실패·재시도를 포함한 지원 비용

수익성은 통화당 총 비용, 성공률, 평균 통화 길이를 함께 측정한 뒤 결정한다.

## 29. 성공 지표

### MVP

- 웹과 Codex 양쪽에서 작업 생성 성공
- 실제 전화 E2E 성공 1회 이상
- 구조화 결과 저장 성공률 100%인 데모 시나리오
- 중복 요청 시 추가 발신 0건
- 전체 자동화 테스트와 빌드 통과

### 제품 검증

- 연결된 통화의 업무 완료율
- 사용자가 절약한 평균 시간
- `needs_human` 발생률
- 7일·30일 재사용률
- 작업당 총 원가와 성공 작업당 원가

## 30. 주요 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 전화 연결 불안정 | 데모 실패 | opt-in smoke test, fake gateway, 실패 UI 준비 |
| AI가 결과를 잘못 확정 | 신뢰 훼손 | 구조화 outcome 도구와 종료 전 재확인 |
| 중복 발신 | 비용·민원 | idempotency와 atomic claim |
| 장시간 작업의 서버 종료 | 작업 유실 | 별도 워커, heartbeat, stale 회수 |
| 상대방의 AI 통화 거부 | 처리 실패 | AI 정체성 공개와 `needs_human` 보고 |
| 개인정보 노출 | 법적·신뢰 위험 | MVP 민감정보 제외, 마스킹, 녹음 비활성화 |
| MCP 도구 자동 선택 실패 | CLI 경험 저하 | 목표 중심 Skill·도구 설명과 대표 발화 평가 |
| 범위 과다 | 핵심 미완성 | 식당 예약 P0 고정, ARS·개입·Voice Cloning 제외 |
| 공급자 종속 | 확장 비용 | `VoiceGateway` adapter 경계 유지 |

## 31. 수용 기준

다음 조건을 모두 충족해야 MVP를 완료로 판정한다.

- [ ] 공개 웹 URL에서 예약 전화 작업을 생성할 수 있다.
- [ ] Codex CLI에서 자연어로 DialAI Skill과 MCP 흐름을 시작할 수 있다.
- [ ] 작업 생성 호출은 통화 완료 전에 ID와 `queued`를 반환한다.
- [ ] 서비스 소유 번호로 실제 테스트 전화가 연결된다.
- [ ] AI가 정체성을 밝히고 예약 내용을 전달한다.
- [ ] 통화 결과가 `confirmed`, `unavailable`, `needs_human` 중 하나로 저장된다.
- [ ] 웹과 MCP에서 같은 결과를 조회한다.
- [ ] 동일 idempotency key로 중복 발신하지 않는다.
- [ ] 실패 이유를 사용자가 이해할 수 있는 문장으로 표시한다.
- [ ] API key, 전체 전화번호, 민감정보가 로그와 클라이언트에 노출되지 않는다.
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`, 프로덕션 빌드가 통과한다.
- [ ] README에서 실행 방법, 데모 URL, 발표자료, 영상, Build Log를 찾을 수 있다.

## 32. 발표용 핵심 메시지

### 문제

> 사람들은 업무를 처리하고 싶은 것이지, ARS와 대기음에 시간을 쓰고 싶은 것이 아니다.

### 해결

> DialAI에 목적만 말하면 AI가 필요한 정보를 확인하고 실제로 전화해 결과까지 가져온다.

### 차별성

> 일반 사용자는 웹에서, 에이전트 사용자는 Codex에서 같은 전화 실행 능력을 사용한다.

### 기술 증명

> 자연어 요청이 비동기 전화 작업으로 변환되고, OpenAI Realtime 음성 에이전트가 실제 통화를 수행한 뒤 구조화 결과를 반환한다.

## 33. 공식 참고 자료

- OpenAI Realtime SIP: <https://developers.openai.com/api/docs/guides/realtime-sip>
- OpenAI Realtime server controls: <https://developers.openai.com/api/docs/guides/realtime-server-controls>
- OpenAI Realtime with tools: <https://developers.openai.com/api/docs/guides/realtime-mcp>
- OpenAI Plugin architecture: <https://developers.openai.com/plugins/concepts/plugins>
- OpenAI Plugin skills: <https://developers.openai.com/plugins/concepts/skills>
- OpenAI MCP tool design: <https://developers.openai.com/plugins/plan/tools>
- OpenAI restaurant reservation conversion spec: <https://developers.openai.com/plugins/guides/restaurant-reservation-conversion-spec>
- Codex MCP configuration: <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>
