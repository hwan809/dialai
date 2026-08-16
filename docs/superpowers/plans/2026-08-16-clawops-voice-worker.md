# ClawOps Voice Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume queued reservation jobs in an always-on process, place AI reservation calls through ClawOps, and persist transcripts, structured outcomes, and retryable failures.

**Architecture:** A polling worker atomically claims one Supabase job per slot and delegates the call to a `VoiceGateway`. The production gateway creates one ClawOps Agent and one OpenAI Realtime session per call; tests use a deterministic fake gateway, so no automated test places a real phone call.

**Tech Stack:** Node.js 20+, TypeScript 5, Supabase JS 2.112.3, `@teamlearners/clawops` 0.32.0, `ws` 8+, OpenAI Realtime through ClawOps, Vitest, tsx

**Spec:** `docs/superpowers/specs/2026-08-16-mcp-reservation-calling-design.md`

## Global Constraints

- Complete `docs/superpowers/plans/2026-08-16-mcp-reservation-orchestration.md` first.
- Run the worker in an always-on Node.js environment, never inside a Vercel Route Handler.
- Create one `ClawOpsAgent` per active call and process at most one active call per worker slot.
- Always use `CLAWOPS_FROM_NUMBER`; never accept caller ID from the reservation job.
- Use model `gpt-realtime-2`, voice `marin`, and language `ko` for the MVP.
- Identify the caller as an AI reservation assistant in the first turn.
- Keep ClawOps recording disabled; persist text transcript and structured outcome only.
- Allow at most two total call attempts per reservation.
- Automated tests must mock telephony. A real call requires `RUN_LIVE_CALL=true` and an explicit destination number.

---

### Task 1: Voice Gateway Contract, Prompt, and Failure Policy

**Files:**
- Create: `src/features/voice/gateway.ts`
- Create: `src/features/voice/prompt.ts`
- Create: `src/features/voice/retry-policy.ts`
- Test: `src/features/voice/prompt.test.ts`
- Test: `src/features/voice/retry-policy.test.ts`

**Interfaces:**
- Consumes: `ReservationJob`, `ReservationOutcome`
- Produces: `VoiceGateway`, `VoiceCallResult`, `VoiceCallbacks`, `buildReservationPrompt`, `classifyRetry`

- [ ] **Step 1: Write failing prompt tests**

```ts
import { expect, it } from "vitest";
import { buildReservationPrompt } from "./prompt";

it("discloses that the caller is an AI and includes the full reservation request", () => {
  const prompt = buildReservationPrompt(job);
  expect(prompt).toContain("AI 예약 도우미");
  expect(prompt).toContain(job.placeName);
  expect(prompt).toContain(job.customerName);
  expect(prompt).toContain(String(job.partySize));
  expect(prompt).toContain(job.requestedAt);
  expect(prompt).toContain("record_reservation_outcome");
});

it("tells the agent not to invent confirmation details", () => {
  expect(buildReservationPrompt(job)).toContain("추측하지 마세요");
});
```

- [ ] **Step 2: Write failing retry-policy table tests**

```ts
import { describe, expect, it } from "vitest";
import { classifyRetry } from "./retry-policy";

describe.each([
  ["no-answer", 1, true],
  ["busy", 1, true],
  ["failed", 1, true],
  ["provider_exception", 1, true],
  ["rejected", 1, false],
  ["invalid_number", 1, false],
  ["number_changed", 1, false],
  ["incompatible_destination", 1, false],
  ["no-answer", 2, false],
])("classifyRetry(%s, %i)", (reason, attemptCount, retry) => {
  it(`returns retry=${retry}`, () => {
    expect(classifyRetry(reason, attemptCount, new Date("2026-08-16T00:00:00Z"))).toEqual(
      retry
        ? { retry: true, retryAt: "2026-08-16T00:10:00.000Z" }
        : { retry: false, retryAt: null },
    );
  });
});
```

- [ ] **Step 3: Run tests and verify missing-module failures**

Run: `npm test -- src/features/voice/prompt.test.ts src/features/voice/retry-policy.test.ts`

Expected: FAIL resolving the new modules.

- [ ] **Step 4: Define the provider-independent gateway**

Create `src/features/voice/gateway.ts`:

```ts
import type { ReservationJob, ReservationOutcome } from "@/features/reservations/types";

export type VoiceCallbacks = {
  onInitiated(providerCallId: string): Promise<void>;
  onConnected(): Promise<void>;
  onTranscript(segment: { role: "assistant" | "user"; text: string; at: string }): Promise<void>;
  onOutcome(outcome: ReservationOutcome): Promise<void>;
};

export type VoiceCallResult = {
  providerCallId: string;
  terminalStatus: "completed" | "no-answer" | "busy" | "rejected" | "canceled" | "failed";
  durationSeconds: number | null;
  answeredBy?: string;
  hangupCause?: string;
  outcome: ReservationOutcome | null;
};

export interface VoiceGateway {
  call(job: ReservationJob, callbacks: VoiceCallbacks): Promise<VoiceCallResult>;
}
```

- [ ] **Step 5: Implement the deterministic prompt and retry policy**

`buildReservationPrompt(job)` must produce Korean instructions that contain this exact behavioral core:

```text
첫 문장에서 고객을 대신해 전화한 AI 예약 도우미라고 밝히세요.
예약 확정, 불가, 사람의 확인 필요 중 하나가 명확해지면 record_reservation_outcome 도구를 정확히 한 번 호출하세요.
상대방이 말하지 않은 날짜, 시간, 가격, 정책을 추측하지 마세요.
결과를 기록한 뒤 간단히 감사 인사를 하고 hang_up 도구로 통화를 종료하세요.
```

Append the job fields as JSON so names and dates do not get interpolated into instruction text ambiguously.

Implement `classifyRetry(reason, attemptCount, now)` so only `no-answer`, `busy`, generic transient `failed`, and `provider_exception` retry when `attemptCount < 2`; return an ISO timestamp exactly ten minutes after `now`.

- [ ] **Step 6: Run the focused tests**

Run: `npm test -- src/features/voice/prompt.test.ts src/features/voice/retry-policy.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit voice-domain behavior**

```bash
git add src/features/voice
git commit -m "feat: define reservation voice gateway"
```

---

### Task 2: ClawOps and OpenAI Realtime Adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/voice/clawops-gateway.ts`
- Test: `src/features/voice/clawops-gateway.test.ts`

**Interfaces:**
- Consumes: `VoiceGateway`, `buildReservationPrompt`, `ReservationOutcome`
- Produces: `ClawOpsVoiceGateway implements VoiceGateway`

- [ ] **Step 1: Install the official ClawOps SDK and WebSocket runtime**

Run:

```bash
npm install @teamlearners/clawops@0.32.0 ws@^8
npm install --save-dev @types/ws
```

- [ ] **Step 2: Write a failing adapter test with a mocked ClawOps module**

Mock `@teamlearners/clawops/agent` so the fake agent captures constructor options, registered tools, event handlers, `call`, `wait`, and `disconnect`.

Assert all of the following:

```ts
expect(agentOptions.from).toBe("07012345678");
expect(agentOptions.recording).toBe(false);
expect(realtimeOptions).toMatchObject({
  model: "gpt-realtime-2",
  voice: "marin",
  language: "ko",
});
expect(registeredToolNames).toContain("record_reservation_outcome");
expect(fakeAgent.call).toHaveBeenCalledWith(job.destinationPhone, {
  timeout: 60,
  machineDetection: "Enable",
});
expect(fakeAgent.disconnect).toHaveBeenCalledOnce();
```

Simulate `call_start`, two `transcript` events, a tool invocation with a confirmed outcome, and `endedStatus = "completed"`; assert `onInitiated` fires with the provider call ID before `wait()`, each remaining callback fires, and the returned result contains the provider call ID and outcome.

Add a second test where `wait()` resolves with `endedStatus = "no-answer"`; assert no outcome is invented and `disconnect()` still runs.

- [ ] **Step 3: Run the adapter test and verify it fails**

Run: `npm test -- src/features/voice/clawops-gateway.test.ts`

Expected: FAIL resolving `./clawops-gateway`.

- [ ] **Step 4: Implement the ClawOps adapter**

Create a constructor that accepts explicit configuration for testability:

```ts
type ClawOpsVoiceGatewayOptions = {
  fromNumber: string;
  apiKey?: string;
  accountId?: string;
  openAiApiKey?: string;
};
```

The production call path must follow this structure:

```ts
const realtime = new OpenAIRealtime({
  apiKey: this.options.openAiApiKey,
  systemPrompt: buildReservationPrompt(job),
  model: "gpt-realtime-2",
  voice: "marin",
  language: "ko",
  greeting: true,
});

const agent = new ClawOpsAgent({
  apiKey: this.options.apiKey,
  accountId: this.options.accountId,
  from: this.options.fromNumber,
  session: realtime,
  recording: false,
  prewarmEnabled: true,
  builtinTools: [BuiltinTool.HANG_UP, BuiltinTool.SEND_DTMF],
});
```

Register `record_reservation_outcome` with a JSON Schema requiring `result` and fields for all three outcome variants. Parse tool arguments through a Zod discriminated union before assigning `outcome` and calling `callbacks.onOutcome`; return a short Korean acknowledgement to the model.

Register events exactly as follows:

```ts
agent.on("call_start", () => void callbacks.onConnected());
agent.on("transcript", (_call, role: string, text: string) => {
  if ((role === "assistant" || role === "user") && text.trim()) {
    void callbacks.onTranscript({ role, text: text.trim(), at: new Date().toISOString() });
  }
});
```

Then call `agent.call(job.destinationPhone, { timeout: 60, machineDetection: "Enable" })`, immediately await `callbacks.onInitiated(call.callId)`, await `call.wait()`, map `call.endedStatus`, `call.endedDuration`, and the captured outcome into `VoiceCallResult`, and always `disconnect()` in `finally`.

- [ ] **Step 5: Run adapter tests, typecheck, and lint**

Run:

```bash
npm test -- src/features/voice/clawops-gateway.test.ts
npx tsc --noEmit
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the provider adapter**

```bash
git add package.json package-lock.json src/features/voice
git commit -m "feat: connect voice gateway to ClawOps"
```

---

### Task 3: Worker Processor and Reservation State Transitions

**Files:**
- Create: `src/features/worker/process-reservation.ts`
- Create: `src/features/worker/run-worker-loop.ts`
- Test: `src/features/worker/process-reservation.test.ts`
- Test: `src/features/worker/run-worker-loop.test.ts`

**Interfaces:**
- Consumes: `ReservationRepository`, `VoiceGateway`, `classifyRetry`
- Produces: `processReservation`, `runWorkerLoop`, `WorkerClock`

- [ ] **Step 1: Write failing processor tests for the four terminal paths**

Use a fake repository and fake gateway to cover:

```ts
it("persists connected, transcript, confirmed outcome, and attempt completion", async () => {
  gateway.result = {
    providerCallId: "CA123",
    terminalStatus: "completed",
    durationSeconds: 42,
    outcome: { result: "confirmed", confirmedAt: "2026-08-17T19:00:00+09:00" },
  };
  await processReservation(job, deps);
  expect(repo.startAttempt).toHaveBeenCalledWith(job.id, job.attemptCount, "CA123");
  expect(repo.markConnected).toHaveBeenCalledWith(job.id);
  expect(repo.finish).toHaveBeenCalledWith(job.id, "confirmed");
  expect(repo.completeAttempt).toHaveBeenCalledWith(
    job.id,
    job.attemptCount,
    expect.objectContaining({ providerCallId: "CA123", status: "completed" }),
  );
});

it("schedules one retry for a first no-answer", async () => {
  gateway.result = { providerCallId: "CA124", terminalStatus: "no-answer", durationSeconds: 0, outcome: null };
  await processReservation({ ...job, attemptCount: 1 }, deps);
  expect(repo.failOrRetry).toHaveBeenCalledWith(job.id, "no-answer", "2026-08-16T00:10:00.000Z");
});

it("fails a rejected call without retry", async () => {
  gateway.result = { providerCallId: "CA125", terminalStatus: "rejected", durationSeconds: 0, outcome: null };
  await processReservation(job, deps);
  expect(repo.failOrRetry).toHaveBeenCalledWith(job.id, "rejected", null);
});

it("marks a completed conversation without an outcome as needs_human", async () => {
  gateway.result = { providerCallId: "CA126", terminalStatus: "completed", durationSeconds: 30, outcome: null };
  await processReservation(job, deps);
  expect(repo.saveOutcome).toHaveBeenCalledWith(job.id, {
    result: "needs_human",
    reason: "통화는 연결되었지만 구조화된 예약 결과가 없습니다.",
  });
  expect(repo.finish).toHaveBeenCalledWith(job.id, "needs_human");
});
```

- [ ] **Step 2: Write a failing loop test with an abort signal**

Use an injected `sleep`, clock, and abort controller. Make `claimNext` return one job then `null`; assert the job is processed once, stale recovery runs before polling, and abort stops the loop without another claim.

- [ ] **Step 3: Run the tests and verify missing implementations**

Run: `npm test -- src/features/worker/process-reservation.test.ts src/features/worker/run-worker-loop.test.ts`

Expected: FAIL resolving the new modules.

- [ ] **Step 4: Implement one-job processing with persistence callbacks**

Use this signature:

```ts
export async function processReservation(
  job: ClaimedReservation,
  deps: {
    repository: ReservationRepository;
    gateway: VoiceGateway;
    now(): Date;
  },
): Promise<void>
```

Before calling, start a 30-second heartbeat interval. The `VoiceCallbacks` must directly call `startAttempt`, `markConnected`, `appendTranscript`, and `saveOutcome`; `onInitiated(providerCallId)` calls `startAttempt(job.id, job.attemptCount, providerCallId)`. Clear the interval in `finally`.

After `VoiceGateway.call` resolves:

- Always call `completeAttempt`.
- If `terminalStatus !== "completed"`, classify `hangupCause ?? terminalStatus` so invalid-number causes cannot be retried, then call `failOrRetry`.
- If completed with a structured outcome, call `finish` with the outcome result.
- If completed without outcome, save and finish `needs_human` with the exact reason from the test.
- If the gateway throws before returning a provider result, call `failOrRetry(job.id, "provider_exception", retryAtOrNull)` and rethrow only after persistence succeeds.

- [ ] **Step 5: Implement the abortable polling loop**

Use this signature:

```ts
export async function runWorkerLoop(deps: {
  workerId: string;
  repository: ReservationRepository;
  gateway: VoiceGateway;
  signal: AbortSignal;
  pollIntervalMs: number;
  now(): Date;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}): Promise<void>
```

At startup call `recoverStale` with five minutes before `now`. Re-run stale recovery once per minute. If no job is claimed, call the injected abortable `sleep`; if a job is claimed, await `processReservation` before claiming another so each process has concurrency one.

- [ ] **Step 6: Run worker tests and the full suite**

Run:

```bash
npm test -- src/features/worker/process-reservation.test.ts src/features/worker/run-worker-loop.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit the worker state machine**

```bash
git add src/features/worker
git commit -m "feat: process queued reservation calls"
```

---

### Task 4: Worker Executable, Safe Live Smoke Test, and Deployment Runbook

**Files:**
- Create: `src/worker/index.ts`
- Create: `scripts/live-call-smoke.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `scripts/live-call-smoke.test.ts`

**Interfaces:**
- Consumes: `SupabaseReservationRepository`, `ClawOpsVoiceGateway`, `runWorkerLoop`
- Produces: `npm run worker`, guarded `npm run smoke:call`

- [ ] **Step 1: Write a failing smoke-test guard test**

Extract `assertLiveCallAllowed(env)` and test:

```ts
it("requires both the explicit opt-in and a destination", () => {
  expect(() => assertLiveCallAllowed({ RUN_LIVE_CALL: "false", LIVE_CALL_TO: "01012345678" })).toThrow();
  expect(() => assertLiveCallAllowed({ RUN_LIVE_CALL: "true" })).toThrow();
  expect(assertLiveCallAllowed({ RUN_LIVE_CALL: "true", LIVE_CALL_TO: "01012345678" })).toBe("01012345678");
});
```

- [ ] **Step 2: Run the guard test and verify it fails**

Run: `npm test -- scripts/live-call-smoke.test.ts`

Expected: FAIL resolving `./live-call-smoke`.

- [ ] **Step 3: Implement the worker executable with graceful shutdown**

`src/worker/index.ts` must validate `CLAWOPS_API_KEY`, `CLAWOPS_ACCOUNT_ID`, `CLAWOPS_FROM_NUMBER`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` before starting. Construct one repository and one gateway, derive `workerId` from `VOICE_WORKER_ID ?? randomUUID()`, and abort the loop on `SIGINT` or `SIGTERM`.

Do not log secrets or the full destination phone number. Log `reservationId`, status transitions, attempt number, and the last four destination digits only.

- [ ] **Step 4: Implement the opt-in live call script**

`assertLiveCallAllowed` must reject unless `RUN_LIVE_CALL === "true"`, normalize `LIVE_CALL_TO`, and return the normalized number. The executable must create a synthetic reservation directed only to that number, print a final redacted result, and disconnect in all paths.

Add scripts:

```json
{
  "scripts": {
    "worker": "tsx src/worker/index.ts",
    "smoke:call": "tsx scripts/live-call-smoke.ts"
  }
}
```

Move `tsx` from `devDependencies` to `dependencies` because the production worker command uses it.

- [ ] **Step 5: Document worker environment and deployment separation**

Append to `.env.example`:

```dotenv
# ClawOps/OpenAI server-only voice worker configuration
CLAWOPS_API_KEY=sk_...
CLAWOPS_ACCOUNT_ID=AC...
CLAWOPS_FROM_NUMBER=07012345678
OPENAI_API_KEY=sk-...
VOICE_WORKER_ID=worker-local-1
VOICE_POLL_INTERVAL_MS=1000

# Live call smoke test is disabled unless explicitly set to true
RUN_LIVE_CALL=false
LIVE_CALL_TO=
```

Update `README.md` with two separately deployable processes: `npm run dev` for the Next.js MCP server and `npm run worker` for the always-on worker. State that increasing concurrency means starting additional worker slots only after the ClawOps plan supports the corresponding concurrent lines.

- [ ] **Step 6: Run all non-live verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 and no phone call is placed.

- [ ] **Step 7: Run one explicitly authorized live smoke call**

Only after the operator supplies a destination they control or have permission to call, run:

```bash
RUN_LIVE_CALL=true LIVE_CALL_TO=01000000000 npm run smoke:call
```

Replace `01000000000` with the explicitly approved number. Expected: the phone rings from `CLAWOPS_FROM_NUMBER`, the first speech identifies the AI reservation assistant, transcript events appear in redacted logs, and the process exits after hangup.

- [ ] **Step 8: Commit the runnable voice worker**

```bash
git add src/worker scripts/live-call-smoke.ts scripts/live-call-smoke.test.ts package.json package-lock.json .env.example README.md
git commit -m "feat: run ClawOps reservation worker"
```

## Plan 2 Completion Gate

Before calling the feature complete, verify all of the following:

- Automated tests never create a real ClawOps call.
- A worker claims no more than one job at a time.
- A completed call with no structured outcome becomes `needs_human`.
- First `no-answer` and `busy` schedule one retry; second attempts and non-retryable reasons become `failed`.
- The first AI turn discloses that it is an AI reservation assistant.
- Full phone numbers and secret values are absent from logs.
- `npm test`, `npm run lint`, and `npm run build` pass.
- One operator-authorized live call succeeds from the assigned 070 number before demo day.
