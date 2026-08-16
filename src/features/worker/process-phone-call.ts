import type { ClaimedPhoneCall, PhoneCallRepository } from "@/features/phone-calls/repository";
import type { PhoneCallOutcome } from "@/features/phone-calls/types";
import type { VoiceGateway } from "@/features/voice/gateway";
import { classifyRetry } from "@/features/voice/retry-policy";

type IntervalHandle = ReturnType<typeof setInterval>;

export type ProcessPhoneCallDependencies = {
  repository: PhoneCallRepository;
  gateway: VoiceGateway;
  now(): Date;
  setInterval?: (callback: () => void, ms: number) => IntervalHandle;
  clearInterval?: (handle: IntervalHandle) => void;
  onStatusChange?: (job: ClaimedPhoneCall, status: "dialing" | "connected" | "retry_scheduled" | "completed" | "needs_human" | "failed") => void;
};

const missingOutcome: PhoneCallOutcome = {
  result: "needs_human",
  summary: "통화가 완료되었지만 확인 가능한 구조화된 결과가 없습니다.",
  reason: "AI가 통화 결과를 기록하지 않아 담당자의 확인이 필요합니다.",
};

export async function processPhoneCall(job: ClaimedPhoneCall, deps: ProcessPhoneCallDependencies): Promise<void> {
  const setIntervalFn = deps.setInterval ?? setInterval;
  const clearIntervalFn = deps.clearInterval ?? clearInterval;
  let providerCallId: string | null = null;
  let outcomePersisted = false;
  const heartbeat = setIntervalFn(() => {
    void deps.repository.heartbeat(job.id, job.lockedBy).catch(() => undefined);
  }, 30_000);
  deps.onStatusChange?.(job, "dialing");

  try {
    let result;
    try {
      result = await deps.gateway.call(job, {
        onInitiated: async (callId) => {
          providerCallId = callId;
          await deps.repository.startAttempt(job.id, job.attemptCount, callId);
        },
        onConnected: async () => {
          await deps.repository.markConnected(job.id);
          deps.onStatusChange?.(job, "connected");
        },
        onTranscript: (segment) => deps.repository.appendTranscript(job.id, segment),
        onOutcome: async (outcome) => {
          outcomePersisted = true;
          await deps.repository.saveOutcome(job.id, outcome);
        },
      });
    } catch (error) {
      if (providerCallId) {
        await deps.repository.completeAttempt(job.id, job.attemptCount, {
          providerCallId,
          status: "provider_exception",
        });
      }
      const decision = classifyRetry("provider_exception", job.attemptCount, deps.now());
      await deps.repository.failOrRetry(job.id, "provider_exception", decision.retryAt);
      deps.onStatusChange?.(job, decision.retry ? "retry_scheduled" : "failed");
      throw error;
    }

    await deps.repository.completeAttempt(job.id, job.attemptCount, {
      providerCallId: result.providerCallId,
      status: result.terminalStatus,
      ...(result.answeredBy ? { answeredBy: result.answeredBy } : {}),
      ...(result.hangupCause ? { hangupCause: result.hangupCause } : {}),
      ...(result.durationSeconds === null ? {} : { durationSeconds: result.durationSeconds }),
    });

    if (result.terminalStatus !== "completed") {
      const reason = result.hangupCause ?? result.terminalStatus;
      const decision = classifyRetry(reason, job.attemptCount, deps.now());
      await deps.repository.failOrRetry(job.id, reason, decision.retryAt);
      deps.onStatusChange?.(job, decision.retry ? "retry_scheduled" : "failed");
      return;
    }
    if (result.outcome) {
      if (!outcomePersisted) await deps.repository.saveOutcome(job.id, result.outcome);
      await deps.repository.finish(job.id, result.outcome.result);
      deps.onStatusChange?.(job, result.outcome.result);
      return;
    }
    await deps.repository.saveOutcome(job.id, missingOutcome);
    await deps.repository.finish(job.id, "needs_human");
    deps.onStatusChange?.(job, "needs_human");
  } finally {
    clearIntervalFn(heartbeat);
  }
}
