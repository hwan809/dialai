import { randomUUID } from "node:crypto";
import { normalizeKoreanPhoneNumber } from "@/features/phone-calls/schema";
import type { PhoneCallJob } from "@/features/phone-calls/types";
import { ClawOpsVoiceGateway } from "@/features/voice/clawops-gateway";

type LiveCallEnvironment = Record<string, string | undefined>;

export function assertLiveCallAllowed(env: LiveCallEnvironment): string {
  if (env.RUN_LIVE_CALL !== "true") throw new Error("실전화는 RUN_LIVE_CALL=true일 때만 실행할 수 있습니다.");
  if (!env.LIVE_CALL_TO) throw new Error("실전화 대상 LIVE_CALL_TO 환경변수가 필요합니다.");
  return normalizeKoreanPhoneNumber(env.LIVE_CALL_TO);
}
function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}
export async function runLiveCallSmoke(env: LiveCallEnvironment = process.env): Promise<void> {
  const destinationPhone = assertLiveCallAllowed(env);
  const gateway = new ClawOpsVoiceGateway({ fromNumber: requireEnvironment("CLAWOPS_FROM_NUMBER"), apiKey: requireEnvironment("CLAWOPS_API_KEY"), accountId: requireEnvironment("CLAWOPS_ACCOUNT_ID"), openAiApiKey: requireEnvironment("OPENAI_API_KEY") });
  const now = new Date().toISOString();
  const job: PhoneCallJob = {
    id: randomUUID(), tenantId: "live-smoke", idempotencyKey: `live-smoke-${randomUUID()}`, destinationPhone,
    objective: "이 통화는 DialAI 연결 확인용 테스트입니다. AI 전화 도우미임을 밝히고 연결을 확인한 뒤 통화를 종료해 주세요.", successCriteria: ["통화 연결 확인"], status: "dialing", attemptCount: 1, nextAttemptAt: null, outcome: null, lastFailureReason: null, transcript: [], createdAt: now, updatedAt: now,
  };
  const result = await gateway.call(job, { onInitiated: async () => undefined, onConnected: async () => undefined, onTranscript: async () => undefined, onOutcome: async () => undefined });
  console.info("Live call smoke finished.", { destinationLastFour: destinationPhone.slice(-4), terminalStatus: result.terminalStatus, durationSeconds: result.durationSeconds, outcome: result.outcome?.result ?? null });
}
if (process.argv[1]?.endsWith("scripts/live-call-smoke.ts")) {
  void runLiveCallSmoke().catch(() => { console.error("Live call smoke failed."); process.exitCode = 1; });
}
