import type { ClaimedPhoneCall, PhoneCallRepository } from "@/features/phone-calls/repository";
import type { VoiceGateway } from "@/features/voice/gateway";
import { processPhoneCall, type ProcessPhoneCallDependencies } from "./process-phone-call";

export type WorkerClock = {
  now(): Date;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
};

export type WorkerLoopDependencies = WorkerClock & {
  workerId: string;
  repository: PhoneCallRepository;
  gateway: VoiceGateway;
  signal: AbortSignal;
  pollIntervalMs: number;
  onCallError?: (job: ClaimedPhoneCall, error: unknown) => void;
  onStatusChange?: ProcessPhoneCallDependencies["onStatusChange"];
  process?: (job: ClaimedPhoneCall, deps: ProcessPhoneCallDependencies) => Promise<void>;
};

const STALE_AFTER_MS = 5 * 60_000;
const STALE_RECOVERY_INTERVAL_MS = 60_000;

export async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, ms);
    const abort = () => finish();
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      resolve();
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function runWorkerLoop(deps: WorkerLoopDependencies): Promise<void> {
  const processor = deps.process ?? processPhoneCall;
  let lastRecoveryAt = 0;
  while (!deps.signal.aborted) {
    const now = deps.now();
    if (lastRecoveryAt === 0 || now.getTime() - lastRecoveryAt >= STALE_RECOVERY_INTERVAL_MS) {
      await deps.repository.recoverStale(new Date(now.getTime() - STALE_AFTER_MS).toISOString());
      lastRecoveryAt = now.getTime();
    }
    if (deps.signal.aborted) return;
    const job = await deps.repository.claimNext(deps.workerId);
    if (!job) {
      await deps.sleep(deps.pollIntervalMs, deps.signal);
      continue;
    }
    try {
      await processor(job, {
        repository: deps.repository,
        gateway: deps.gateway,
        now: deps.now,
        onStatusChange: deps.onStatusChange,
      });
    } catch (error) {
      deps.onCallError?.(job, error);
    }
  }
}
