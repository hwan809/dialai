import type { CreatePhoneCallInput, PhoneCallJob, PhoneCallOutcome } from "./types";

export const MAX_PHONE_CALL_ATTEMPTS = 2;

export type ClaimedPhoneCall = PhoneCallJob & {
  lockedBy: string;
  lockedAt: string;
};

export type TranscriptSegment = {
  role: "assistant" | "user";
  text: string;
  at: string;
};

export type CallAttemptUpdate = {
  providerCallId?: string;
  status: string;
  answeredBy?: string;
  hangupCause?: string;
  durationSeconds?: number;
};

export interface PhoneCallRepository {
  createOrGet(tenantId: string, input: CreatePhoneCallInput): Promise<PhoneCallJob>;
  get(tenantId: string, callId: string): Promise<PhoneCallJob | null>;
  list(tenantId: string, limit: number): Promise<PhoneCallJob[]>;
  cancel(tenantId: string, callId: string): Promise<boolean>;
  claimNext(workerId: string): Promise<ClaimedPhoneCall | null>;
  heartbeat(callId: string, workerId: string): Promise<void>;
  markConnected(callId: string): Promise<void>;
  startAttempt(callId: string, attemptNumber: number, providerCallId: string): Promise<void>;
  appendTranscript(callId: string, segment: TranscriptSegment): Promise<void>;
  saveOutcome(callId: string, outcome: PhoneCallOutcome): Promise<void>;
  finish(callId: string, status: "completed" | "needs_human"): Promise<void>;
  failOrRetry(callId: string, reason: string, retryAt: string | null): Promise<void>;
  completeAttempt(callId: string, attemptNumber: number, update: CallAttemptUpdate): Promise<void>;
  recoverStale(staleBefore: string): Promise<number>;
}
