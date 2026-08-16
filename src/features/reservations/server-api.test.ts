import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import type { CancelPhoneCallResult } from "@/features/phone-calls/service";
import type { CreatePhoneCallInput, PhoneCallJob } from "@/features/phone-calls/types";

import { createReservationApi } from "./server-api";

const tenantId = "debc18be-3552-4b1d-a852-a96121f7f7b0";
const validRequest = {
  customerName: "홍길동",
  destinationPhone: "02-1234-5678",
  idempotencyKey: "reservation-api-001",
  partySize: 2,
  placeName: "코덱스 식당",
  requestedAt: "2026-08-17T19:00:00+09:00",
  requestNotes: "창가 자리 선호",
};

class MemoryPhoneCalls {
  readonly jobs = new Map<string, PhoneCallJob>();

  async create(jobTenantId: string, input: CreatePhoneCallInput): Promise<PhoneCallJob> {
    const now = "2026-08-16T10:00:00.000Z";
    const job: PhoneCallJob = {
      ...input,
      attemptCount: 0,
      createdAt: now,
      id: randomUUID(),
      lastFailureReason: null,
      nextAttemptAt: now,
      outcome: null,
      status: "queued",
      tenantId: jobTenantId,
      transcript: [],
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async get(jobTenantId: string, callId: string): Promise<PhoneCallJob | null> {
    const job = this.jobs.get(callId);
    return job?.tenantId === jobTenantId ? job : null;
  }

  async cancel(jobTenantId: string, callId: string): Promise<CancelPhoneCallResult> {
    const job = await this.get(jobTenantId, callId);
    if (job === null) return { canceled: false, cancelable: false, job: null };
    if (job.status !== "queued" && job.status !== "retry_scheduled") {
      return { canceled: false, cancelable: false, job };
    }
    const canceled = { ...job, status: "canceled" as const };
    this.jobs.set(callId, canceled);
    return { canceled: true, cancelable: false, job: canceled };
  }
}

describe("reservation API", () => {
  let phoneCalls: MemoryPhoneCalls;
  let api: ReturnType<typeof createReservationApi>;

  beforeEach(() => {
    phoneCalls = new MemoryPhoneCalls();
    api = createReservationApi({ phoneCalls, tenantId });
  });

  it("유효한 예약 요청을 큐에 넣고 프론트 작업 계약으로 반환한다", async () => {
    const response = await api.create(new Request("http://localhost/api/reservations", {
      body: JSON.stringify(validRequest),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ...validRequest,
      destinationPhone: "0212345678",
      status: "queued",
    });
    expect(phoneCalls.jobs.size).toBe(1);
  });

  it("잘못된 예약 입력은 전화 작업을 만들지 않고 400을 반환한다", async () => {
    const response = await api.create(new Request("http://localhost/api/reservations", {
      body: JSON.stringify({ ...validRequest, partySize: 0 }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_reservation_request" });
    expect(phoneCalls.jobs.size).toBe(0);
  });

  it("없는 예약 작업은 404를 반환한다", async () => {
    const response = await api.get(randomUUID());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "reservation_not_found" });
  });

  it("잘못된 예약 작업 ID는 400을 반환한다", async () => {
    const response = await api.get("not-a-call-id");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_reservation_id" });
  });

  it("대기 중인 예약 전화 작업을 취소한다", async () => {
    const created = await api.create(new Request("http://localhost/api/reservations", {
      body: JSON.stringify(validRequest),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));
    const job = await created.json() as { id: string };

    const response = await api.cancel(job.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: job.id, status: "canceled" });
  });

  it("실시간 사용자 응답은 백엔드가 지원하지 않음을 명시한다", async () => {
    const response = await api.respond();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "live_response_not_supported" });
  });
});
