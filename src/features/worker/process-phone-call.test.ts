import { describe, expect, it, vi } from "vitest";

import type { ClaimedPhoneCall, PhoneCallRepository } from "@/features/phone-calls/repository";
import type { PhoneCallOutcome } from "@/features/phone-calls/types";
import type { VoiceGateway } from "@/features/voice/gateway";

import { processPhoneCall } from "./process-phone-call";

const job: ClaimedPhoneCall = {
  id: "call-123", tenantId: "tenant-123", idempotencyKey: "phone-call-request-123",
  destinationPhone: "01012345678", objective: "내일 영업시간을 확인해 주세요.",
  context: "오후 방문 예정입니다.", successCriteria: ["영업시간"], status: "dialing",
  attemptCount: 1, nextAttemptAt: null, outcome: null, lastFailureReason: null, transcript: [],
  createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z",
  lockedBy: "worker-123", lockedAt: "2026-08-16T00:00:00.000Z",
};

function repository(): PhoneCallRepository {
  return {
    createOrGet: vi.fn(), get: vi.fn(), list: vi.fn(), cancel: vi.fn(), claimNext: vi.fn(),
    heartbeat: vi.fn(async () => undefined), markConnected: vi.fn(async () => undefined),
    startAttempt: vi.fn(async () => undefined), appendTranscript: vi.fn(async () => undefined),
    saveOutcome: vi.fn(async () => undefined), finish: vi.fn(async () => undefined),
    failOrRetry: vi.fn(async () => undefined), completeAttempt: vi.fn(async () => undefined),
    recoverStale: vi.fn(async () => 0),
  };
}

const completedOutcome: PhoneCallOutcome = {
  result: "completed", summary: "내일 오후 6시까지 영업한다고 확인했습니다.",
  facts: [{ label: "영업시간", value: "오후 6시까지" }], needsFollowUp: false,
};

describe("processPhoneCall", () => {
  it("persists the call lifecycle and completes a structured outcome", async () => {
    const repo = repository();
    const gateway: VoiceGateway = { call: vi.fn(async (_job, callbacks) => {
      await callbacks.onInitiated("provider-123");
      await callbacks.onConnected();
      await callbacks.onTranscript({ role: "assistant", text: "안녕하세요.", at: "2026-08-16T00:00:01.000Z" });
      await callbacks.onOutcome(completedOutcome);
      return { providerCallId: "provider-123", terminalStatus: "completed" as const, durationSeconds: 42, outcome: completedOutcome };
    }) };
    const setInterval = vi.fn((callback: () => void) => { callback(); return "heartbeat" as never; });
    const clearInterval = vi.fn();

    await processPhoneCall(job, { repository: repo, gateway, now: () => new Date("2026-08-16T00:00:00.000Z"), setInterval, clearInterval });

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(repo.heartbeat).toHaveBeenCalledWith("call-123", "worker-123");
    expect(repo.startAttempt).toHaveBeenCalledWith("call-123", 1, "provider-123");
    expect(repo.markConnected).toHaveBeenCalledWith("call-123");
    expect(repo.appendTranscript).toHaveBeenCalledWith("call-123", { role: "assistant", text: "안녕하세요.", at: "2026-08-16T00:00:01.000Z" });
    expect(repo.saveOutcome).toHaveBeenCalledWith("call-123", completedOutcome);
    expect(repo.completeAttempt).toHaveBeenCalledWith("call-123", 1, { providerCallId: "provider-123", status: "completed", durationSeconds: 42 });
    expect(repo.finish).toHaveBeenCalledWith("call-123", "completed");
    expect(clearInterval).toHaveBeenCalledWith("heartbeat");
  });

  it("uses the detailed hangup cause before a generic failed status", async () => {
    const repo = repository();
    const gateway: VoiceGateway = { call: vi.fn(async () => ({ providerCallId: "provider-124", terminalStatus: "failed" as const, durationSeconds: 0, hangupCause: "invalid_number", outcome: null })) };
    await processPhoneCall(job, { repository: repo, gateway, now: () => new Date("2026-08-16T00:00:00.000Z") });
    expect(repo.completeAttempt).toHaveBeenCalledWith("call-123", 1, { providerCallId: "provider-124", status: "failed", hangupCause: "invalid_number", durationSeconds: 0 });
    expect(repo.failOrRetry).toHaveBeenCalledWith("call-123", "invalid_number", null);
  });

  it("retries one first unanswered call", async () => {
    const repo = repository();
    const gateway: VoiceGateway = { call: vi.fn(async () => ({ providerCallId: "provider-125", terminalStatus: "no-answer" as const, durationSeconds: 0, outcome: null })) };
    await processPhoneCall(job, { repository: repo, gateway, now: () => new Date("2026-08-16T00:00:00.000Z") });
    expect(repo.failOrRetry).toHaveBeenCalledWith("call-123", "no-answer", "2026-08-16T00:10:00.000Z");
  });

  it("saves a clear Korean human-review outcome when a completed call has no result", async () => {
    const repo = repository();
    const gateway: VoiceGateway = { call: vi.fn(async () => ({ providerCallId: "provider-126", terminalStatus: "completed" as const, durationSeconds: 30, outcome: null })) };
    await processPhoneCall(job, { repository: repo, gateway, now: () => new Date("2026-08-16T00:00:00.000Z") });
    expect(repo.saveOutcome).toHaveBeenCalledWith("call-123", {
      result: "needs_human", summary: "통화가 완료되었지만 확인 가능한 구조화된 결과가 없습니다.", reason: "AI가 통화 결과를 기록하지 않아 담당자의 확인이 필요합니다.",
    });
    expect(repo.finish).toHaveBeenCalledWith("call-123", "needs_human");
  });

  it("persists a provider exception as the first retryable failure", async () => {
    const repo = repository();
    const gateway: VoiceGateway = { call: vi.fn(async (_job, callbacks) => { await callbacks.onInitiated("provider-127"); throw new Error("provider unavailable"); }) };
    await expect(processPhoneCall(job, { repository: repo, gateway, now: () => new Date("2026-08-16T00:00:00.000Z") })).rejects.toThrow("provider unavailable");
    expect(repo.completeAttempt).toHaveBeenCalledWith("call-123", 1, { providerCallId: "provider-127", status: "provider_exception" });
    expect(repo.failOrRetry).toHaveBeenCalledWith("call-123", "provider_exception", "2026-08-16T00:10:00.000Z");
  });
});
