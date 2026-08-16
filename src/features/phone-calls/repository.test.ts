import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { CreatePhoneCallInput, PhoneCallJob, PhoneCallOutcome } from "./types";
import { MAX_PHONE_CALL_ATTEMPTS } from "./repository";
import { mapPhoneCallJob } from "./supabase-repository";
import type {
  CallAttemptUpdate,
  ClaimedPhoneCall,
  PhoneCallRepository,
  TranscriptSegment,
} from "./repository";

const input: CreatePhoneCallInput = {
  idempotencyKey: "phone-call-request-001",
  destinationPhone: "0212345678",
  objective: "오늘 영업시간과 주차 가능 여부를 확인해 주세요.",
  context: "고객은 오후에 방문할 예정입니다.",
  successCriteria: ["영업시간", "주차 가능 여부"],
};

class MemoryRepository implements PhoneCallRepository {
  private readonly jobs = new Map<string, PhoneCallJob>();
  private readonly attempts = new Map<string, CallAttemptUpdate>();
  private readonly locks = new Map<string, { workerId: string; heartbeatAt: string }>();

  async createOrGet(tenantId: string, value: CreatePhoneCallInput): Promise<PhoneCallJob> {
    const existing = [...this.jobs.values()].find(
      (job) => job.tenantId === tenantId && job.idempotencyKey === value.idempotencyKey,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const job: PhoneCallJob = {
      ...value,
      id: randomUUID(),
      tenantId,
      status: "queued",
      attemptCount: 0,
      nextAttemptAt: now,
      outcome: null,
      lastFailureReason: null,
      transcript: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async get(tenantId: string, callId: string): Promise<PhoneCallJob | null> {
    const job = this.jobs.get(callId);
    return job?.tenantId === tenantId ? job : null;
  }

  async list(tenantId: string, limit: number): Promise<PhoneCallJob[]> {
    return [...this.jobs.values()].filter((job) => job.tenantId === tenantId).slice(0, limit);
  }

  async cancel(tenantId: string, callId: string): Promise<boolean> {
    const job = await this.get(tenantId, callId);
    if (!job || !["queued", "retry_scheduled"].includes(job.status)) return false;
    this.jobs.set(callId, { ...job, status: "canceled", updatedAt: new Date().toISOString() });
    return true;
  }

  async claimNext(workerId: string): Promise<ClaimedPhoneCall | null> {
    const now = new Date().toISOString();
    const candidate = [...this.jobs.values()].find(
      (job) =>
        ["queued", "retry_scheduled"].includes(job.status) &&
        job.nextAttemptAt !== null &&
        job.nextAttemptAt <= now &&
        job.attemptCount < MAX_PHONE_CALL_ATTEMPTS,
    );
    if (!candidate) return null;
    const claimed: ClaimedPhoneCall = {
      ...candidate,
      status: "dialing",
      attemptCount: candidate.attemptCount + 1,
      lockedBy: workerId,
      lockedAt: now,
      updatedAt: now,
    };
    this.jobs.set(claimed.id, claimed);
    this.locks.set(claimed.id, { workerId, heartbeatAt: now });
    return claimed;
  }

  async heartbeat(callId: string, workerId: string): Promise<void> {
    this.requireJob(callId);
    const lock = this.locks.get(callId);
    if (lock?.workerId !== workerId) throw new Error("lock owner mismatch");
    this.locks.set(callId, { workerId, heartbeatAt: new Date().toISOString() });
  }

  async markConnected(callId: string): Promise<void> {
    this.update(callId, { status: "connected" });
  }

  async startAttempt(callId: string, attemptNumber: number, providerCallId: string): Promise<void> {
    this.attempts.set(`${callId}:${attemptNumber}`, { providerCallId, status: "started" });
  }

  async appendTranscript(callId: string, segment: TranscriptSegment): Promise<void> {
    const job = this.requireJob(callId);
    this.jobs.set(callId, { ...job, transcript: [...job.transcript, segment] });
  }

  async saveOutcome(callId: string, outcome: PhoneCallOutcome): Promise<void> {
    this.update(callId, { outcome });
  }

  async finish(callId: string, status: "completed" | "needs_human"): Promise<void> {
    this.update(callId, { status });
  }

  async failOrRetry(callId: string, reason: string, retryAt: string | null): Promise<void> {
    const job = this.requireJob(callId);
    this.jobs.set(callId, {
      ...job,
      status:
        retryAt && job.attemptCount < MAX_PHONE_CALL_ATTEMPTS ? "retry_scheduled" : "failed",
      nextAttemptAt:
        retryAt && job.attemptCount < MAX_PHONE_CALL_ATTEMPTS ? retryAt : null,
      lastFailureReason: reason,
      updatedAt: new Date().toISOString(),
    });
    this.locks.delete(callId);
  }

  async completeAttempt(
    callId: string,
    attemptNumber: number,
    update: CallAttemptUpdate,
  ): Promise<void> {
    this.attempts.set(`${callId}:${attemptNumber}`, update);
  }

  async recoverStale(staleBefore: string): Promise<number> {
    let count = 0;
    for (const [callId, job] of this.jobs) {
      if (
        !["dialing", "connected"].includes(job.status) ||
        !this.locks.get(callId) ||
        this.locks.get(callId)!.heartbeatAt >= staleBefore
      ) {
        continue;
      }
      count += 1;
      this.jobs.set(callId, {
        ...job,
        status: job.attemptCount < MAX_PHONE_CALL_ATTEMPTS ? "retry_scheduled" : "failed",
        nextAttemptAt: new Date().toISOString(),
        lastFailureReason: "worker heartbeat timed out",
        updatedAt: new Date().toISOString(),
      });
      this.locks.delete(callId);
    }
    return count;
  }

  private requireJob(callId: string): PhoneCallJob {
    const job = this.jobs.get(callId);
    if (!job) throw new Error("phone call not found");
    return job;
  }

  private update(callId: string, changes: Partial<PhoneCallJob>): void {
    this.jobs.set(callId, { ...this.requireJob(callId), ...changes, updatedAt: new Date().toISOString() });
  }
}

describe("PhoneCallRepository contract", () => {
  it("returns the original job for a repeated tenant idempotency key", async () => {
    const repo = new MemoryRepository();
    const first = await repo.createOrGet("tenant-a", input);
    const second = await repo.createOrGet("tenant-a", input);

    expect(second.id).toBe(first.id);
    expect(await repo.list("tenant-a", 20)).toHaveLength(1);
  });

  it("isolates matching idempotency keys between tenants", async () => {
    const repo = new MemoryRepository();
    const a = await repo.createOrGet("tenant-a", input);
    const b = await repo.createOrGet("tenant-b", input);

    expect(b.id).not.toBe(a.id);
    await expect(repo.get("tenant-a", b.id)).resolves.toBeNull();
  });

  it("only cancels queued or retry-scheduled calls", async () => {
    const repo = new MemoryRepository();
    const call = await repo.createOrGet("tenant-a", input);

    await expect(repo.cancel("tenant-a", call.id)).resolves.toBe(true);
    await expect(repo.cancel("tenant-a", call.id)).resolves.toBe(false);
  });

  it("never claims a third attempt after two retryable failures", async () => {
    const repo = new MemoryRepository();
    const call = await repo.createOrGet("tenant-a", input);
    const first = await repo.claimNext("worker-a");
    await repo.failOrRetry(first!.id, "busy", new Date().toISOString());
    const second = await repo.claimNext("worker-a");
    await repo.failOrRetry(second!.id, "busy", new Date().toISOString());

    expect(await repo.claimNext("worker-a")).toBeNull();
    expect(await repo.get("tenant-a", call.id)).toMatchObject({
      status: "failed",
      nextAttemptAt: null,
    });
  });

  it("fails stale calls already at the attempt limit instead of requeueing them", async () => {
    const repo = new MemoryRepository();
    const call = await repo.createOrGet("tenant-a", input);
    const first = await repo.claimNext("worker-a");
    await repo.failOrRetry(first!.id, "no-answer", new Date().toISOString());
    await repo.claimNext("worker-a");
    await repo.heartbeat(call.id, "worker-a");

    expect(await repo.recoverStale(new Date(Date.now() + 1_000).toISOString())).toBe(1);
    expect((await repo.get("tenant-a", call.id))?.status).toBe("failed");
  });
});

describe("Supabase phone call row mapping", () => {
  it("preserves generic objective, context, and success criteria from a database row", () => {
    expect(
      mapPhoneCallJob({
        id: "47a11e62-96f6-4ef8-9239-a229433d9f59",
        tenant_id: "tenant-a",
        idempotency_key: "phone-call-request-001",
        destination_phone: "0212345678",
        objective: "영업시간과 주차 여부를 문의한다.",
        context: "오후 방문 예정",
        success_criteria: ["영업시간", "주차"],
        status: "queued",
        attempt_count: 0,
        next_attempt_at: "2026-08-16T06:00:00.000Z",
        outcome: null,
        transcript: [{ role: "assistant", text: "안녕하세요", at: "2026-08-16T06:00:01.000Z" }],
        last_failure_reason: null,
        created_at: "2026-08-16T06:00:00.000Z",
        updated_at: "2026-08-16T06:00:00.000Z",
      }),
    ).toMatchObject({
      idempotencyKey: "phone-call-request-001",
      destinationPhone: "0212345678",
      objective: "영업시간과 주차 여부를 문의한다.",
      context: "오후 방문 예정",
      successCriteria: ["영업시간", "주차"],
      status: "queued",
      transcript: [{ role: "assistant", text: "안녕하세요", at: "2026-08-16T06:00:01.000Z" }],
    });
  });
});
