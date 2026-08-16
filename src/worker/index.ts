import { randomUUID } from "node:crypto";

import { SupabasePhoneCallRepository } from "@/features/phone-calls/supabase-repository";
import { ClawOpsVoiceGateway } from "@/features/voice/clawops-gateway";
import { abortableSleep, runWorkerLoop } from "@/features/worker/run-worker-loop";

type VoiceWorkerEnvironment = { clawOpsApiKey: string; clawOpsAccountId: string; clawOpsFromNumber: string; openAiApiKey: string };

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

export function readVoiceWorkerEnvironment(): VoiceWorkerEnvironment {
  requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SECRET_KEY?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  }
  return {
    clawOpsApiKey: requireEnvironment("CLAWOPS_API_KEY"),
    clawOpsAccountId: requireEnvironment("CLAWOPS_ACCOUNT_ID"),
    clawOpsFromNumber: requireEnvironment("CLAWOPS_FROM_NUMBER"),
    openAiApiKey: requireEnvironment("OPENAI_API_KEY"),
  };
}

export async function startWorker(): Promise<void> {
  const config = readVoiceWorkerEnvironment();
  const controller = new AbortController();
  const workerId = process.env.VOICE_WORKER_ID?.trim() || randomUUID();
  const parsedPollInterval = Number(process.env.VOICE_POLL_INTERVAL_MS ?? "1000");
  const pollIntervalMs = Number.isFinite(parsedPollInterval) && parsedPollInterval > 0 ? parsedPollInterval : 1000;
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await runWorkerLoop({
      workerId,
      repository: new SupabasePhoneCallRepository(),
      gateway: new ClawOpsVoiceGateway({ fromNumber: config.clawOpsFromNumber, apiKey: config.clawOpsApiKey, accountId: config.clawOpsAccountId, openAiApiKey: config.openAiApiKey }),
      signal: controller.signal,
      pollIntervalMs,
      now: () => new Date(),
      sleep: abortableSleep,
      onStatusChange: (job, status) => console.info("Phone call worker status transition.", {
        phoneCallId: job.id,
        status,
        attempt: job.attemptCount,
        destinationLastFour: job.destinationPhone.slice(-4),
      }),
      onCallError: (job) => console.error("Phone call worker persisted a provider failure.", { phoneCallId: job.id, attempt: job.attemptCount, destinationLastFour: job.destinationPhone.slice(-4) }),
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (process.argv[1]?.endsWith("src/worker/index.ts")) {
  void startWorker().catch(() => { console.error("Phone call worker could not start."); process.exitCode = 1; });
}
