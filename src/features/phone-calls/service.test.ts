/* eslint-disable @typescript-eslint/no-unused-vars */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CallAttemptUpdate, ClaimedPhoneCall, PhoneCallRepository, TranscriptSegment } from "./repository";
import { PhoneCallService } from "./service";
import type { CreatePhoneCallInput, PhoneCallJob, PhoneCallOutcome } from "./types";

const input: CreatePhoneCallInput = { idempotencyKey: "phone-call-request-001", destinationPhone: "02-1234-5678", objective: "오늘 영업시간과 주차 가능 여부를 확인해 주세요." };

class MemoryRepository implements PhoneCallRepository {
  readonly jobs = new Map<string, PhoneCallJob>();
  lastListLimit: number | undefined;
  async createOrGet(tenantId: string, value: CreatePhoneCallInput): Promise<PhoneCallJob> { const found = [...this.jobs.values()].find((job) => job.tenantId === tenantId && job.idempotencyKey === value.idempotencyKey); if (found) return found; const now = new Date().toISOString(); const job: PhoneCallJob = { ...value, id: randomUUID(), tenantId, status: "queued", attemptCount: 0, nextAttemptAt: now, outcome: null, lastFailureReason: null, transcript: [], createdAt: now, updatedAt: now }; this.jobs.set(job.id, job); return job; }
  async get(tenantId: string, callId: string) { const job = this.jobs.get(callId); return job?.tenantId === tenantId ? job : null; }
  async list(tenantId: string, limit: number) { this.lastListLimit = limit; return [...this.jobs.values()].filter((job) => job.tenantId === tenantId).slice(0, limit); }
  async cancel(tenantId: string, callId: string) { const job = await this.get(tenantId, callId); if (!job || !["queued", "retry_scheduled"].includes(job.status)) return false; this.jobs.set(callId, { ...job, status: "canceled" }); return true; }
  async claimNext(_workerId: string): Promise<ClaimedPhoneCall | null> { return null; }
  async heartbeat(_callId: string, _workerId: string): Promise<void> {}
  async markConnected(_callId: string): Promise<void> {}
  async startAttempt(_callId: string, _attempt: number, _providerCallId: string): Promise<void> {}
  async appendTranscript(_callId: string, _segment: TranscriptSegment): Promise<void> {}
  async saveOutcome(_callId: string, _outcome: PhoneCallOutcome): Promise<void> {}
  async finish(_callId: string, _status: "completed" | "needs_human"): Promise<void> {}
  async failOrRetry(_callId: string, _reason: string, _retryAt: string | null): Promise<void> {}
  async completeAttempt(_callId: string, _attempt: number, _update: CallAttemptUpdate): Promise<void> {}
  async recoverStale(_staleBefore: string): Promise<number> { return 0; }
}

describe("PhoneCallService", () => {
  it("validates and normalizes a newly queued call", async () => { const call = await new PhoneCallService(new MemoryRepository()).create("tenant-a", input); expect(call).toMatchObject({ destinationPhone: "0212345678", status: "queued" }); });
  it("preserves idempotency and tenant isolation", async () => { const service = new PhoneCallService(new MemoryRepository()); const first = await service.create("tenant-a", input); expect((await service.create("tenant-a", input)).id).toBe(first.id); await expect(service.get("tenant-b", first.id)).resolves.toBeNull(); });
  it("caps list requests at fifty", async () => { const repository = new MemoryRepository(); await new PhoneCallService(repository).list("tenant-a", 500); expect(repository.lastListLimit).toBe(50); });
  it("returns authoritative state when a call cannot be canceled", async () => { const repository = new MemoryRepository(); const service = new PhoneCallService(repository); const call = await service.create("tenant-a", input); repository.jobs.set(call.id, { ...call, status: "dialing" }); await expect(service.cancel("tenant-a", call.id)).resolves.toMatchObject({ canceled: false, cancelable: false, job: { status: "dialing" } }); });
});
