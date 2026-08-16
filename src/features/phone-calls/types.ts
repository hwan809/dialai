export const phoneCallStatuses = [
  "queued",
  "dialing",
  "connected",
  "retry_scheduled",
  "completed",
  "needs_human",
  "failed",
  "canceled",
] as const;

export type PhoneCallStatus = (typeof phoneCallStatuses)[number];

export type PhoneCallOutcome =
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

export type CreatePhoneCallInput = {
  idempotencyKey: string;
  destinationPhone: string;
  objective: string;
  context?: string;
  successCriteria?: string[];
};

export type PhoneCallJob = CreatePhoneCallInput & {
  id: string;
  tenantId: string;
  status: PhoneCallStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  outcome: PhoneCallOutcome | null;
  lastFailureReason: string | null;
  transcript: Array<{ role: "assistant" | "user"; text: string; at: string }>;
  createdAt: string;
  updatedAt: string;
};
