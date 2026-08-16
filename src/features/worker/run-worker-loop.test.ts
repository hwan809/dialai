import { describe, expect, it, vi } from "vitest";

import type { ClaimedPhoneCall, PhoneCallRepository } from "@/features/phone-calls/repository";
import type { VoiceGateway } from "@/features/voice/gateway";
import { runWorkerLoop } from "./run-worker-loop";

const claimed: ClaimedPhoneCall = {
  id: "call-123", tenantId: "tenant-123", idempotencyKey: "phone-call-request-123", destinationPhone: "01012345678", objective: "영업시간을 확인해 주세요.", status: "dialing", attemptCount: 1, nextAttemptAt: null, outcome: null, lastFailureReason: null, transcript: [], createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", lockedBy: "worker-123", lockedAt: "2026-08-16T00:00:00.000Z",
};
function repository(): PhoneCallRepository { return {
  createOrGet: vi.fn(), get: vi.fn(), list: vi.fn(), cancel: vi.fn(), claimNext: vi.fn(), heartbeat: vi.fn(async () => undefined), markConnected: vi.fn(async () => undefined), startAttempt: vi.fn(async () => undefined), appendTranscript: vi.fn(async () => undefined), saveOutcome: vi.fn(async () => undefined), finish: vi.fn(async () => undefined), failOrRetry: vi.fn(async () => undefined), completeAttempt: vi.fn(async () => undefined), recoverStale: vi.fn(async () => 0),
}; }
describe("runWorkerLoop", () => {
  it("recovers stale work, processes one claimed call, and stops after abortable polling", async () => {
    const repo = repository();
    vi.mocked(repo.claimNext).mockResolvedValueOnce(claimed).mockResolvedValueOnce(null);
    const controller = new AbortController();
    const gateway: VoiceGateway = { call: vi.fn(async (_job, callbacks) => { await callbacks.onInitiated("provider-123"); return { providerCallId: "provider-123", terminalStatus: "completed" as const, durationSeconds: 1, outcome: { result: "completed" as const, summary: "확인했습니다.", facts: [], needsFollowUp: false } }; }) };
    const sleep = vi.fn(async (_ms: number, signal: AbortSignal) => { expect(signal.aborted).toBe(false); controller.abort(); });
    await runWorkerLoop({ workerId: "worker-123", repository: repo, gateway, signal: controller.signal, pollIntervalMs: 250, now: () => new Date("2026-08-16T00:05:00.000Z"), sleep });
    expect(repo.recoverStale).toHaveBeenCalledWith("2026-08-16T00:00:00.000Z");
    expect(gateway.call).toHaveBeenCalledTimes(1);
    expect(repo.claimNext).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250, controller.signal);
  });
});
