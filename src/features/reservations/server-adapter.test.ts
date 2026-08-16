import { describe, expect, it } from "vitest";

import type { PhoneCallJob } from "@/features/phone-calls/types";

import { toPhoneCallInput, toReservationJob } from "./server-adapter";
import type { CreateReservationInput } from "./types";

const reservation: CreateReservationInput = {
  customerName: "홍길동",
  destinationPhone: "0212345678",
  idempotencyKey: "reservation-20260817-001",
  partySize: 2,
  placeName: "코덱스 식당",
  requestedAt: "2026-08-17T19:00:00+09:00",
  requestNotes: "창가 자리를 선호합니다.",
};

describe("toPhoneCallInput", () => {
  it("예약 정보를 범용 전화 목적과 복원 가능한 context로 변환한다", () => {
    const call = toPhoneCallInput(reservation);

    expect(call).toEqual({
      context: JSON.stringify({
        kind: "restaurant_reservation",
        reservation: {
          customerName: "홍길동",
          partySize: 2,
          placeName: "코덱스 식당",
          requestedAt: "2026-08-17T19:00:00+09:00",
          requestNotes: "창가 자리를 선호합니다.",
        },
      }),
      destinationPhone: "0212345678",
      idempotencyKey: "reservation-20260817-001",
      objective: "코덱스 식당에 2026-08-17T19:00:00+09:00, 2명, 홍길동 이름으로 예약을 확정해 주세요.",
      successCriteria: [
        "요청한 일시와 인원으로 예약이 확정되었는지 확인",
        "예약자명이 홍길동으로 등록되었는지 확인",
        "확정 여부와 매장이 안내한 주의사항을 사실로 기록",
      ],
    });
  });
});

describe("toReservationJob", () => {
  it("범용 전화의 완료 결과와 전사를 프론트 계약으로 그대로 전달한다", () => {
    const call: PhoneCallJob = {
      ...toPhoneCallInput(reservation),
      attemptCount: 1,
      createdAt: "2026-08-16T10:00:00.000Z",
      id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
      lastFailureReason: null,
      nextAttemptAt: null,
      outcome: {
        facts: [
          { label: "예약 시간", value: "2026년 8월 17일 오후 7시" },
          { label: "예약자", value: "홍길동" },
        ],
        needsFollowUp: false,
        result: "completed",
        summary: "요청한 조건으로 예약이 확정되었습니다.",
      },
      status: "completed",
      tenantId: "tenant-web",
      transcript: [
        { at: "2026-08-16T10:00:03.000Z", role: "assistant", text: "예약 문의로 전화했습니다." },
        { at: "2026-08-16T10:00:07.000Z", role: "user", text: "예약되었습니다." },
      ],
      updatedAt: "2026-08-16T10:00:08.000Z",
    };

    expect(toReservationJob(call)).toEqual({
      ...reservation,
      attemptCount: 1,
      createdAt: "2026-08-16T10:00:00.000Z",
      id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
      lastFailureReason: null,
      outcome: call.outcome,
      status: "completed",
      transcript: call.transcript,
      updatedAt: "2026-08-16T10:00:08.000Z",
    });
  });

  it.each([
    ["queued", "queued"],
    ["dialing", "dialing"],
    ["connected", "connected"],
    ["retry_scheduled", "retry_scheduled"],
    ["completed", "completed"],
    ["needs_human", "needs_human"],
    ["failed", "failed"],
    ["canceled", "canceled"],
  ] as const)("백엔드 %s 상태를 프론트 %s 상태로 매핑한다", (phoneStatus, reservationStatus) => {
    const call: PhoneCallJob = {
      ...toPhoneCallInput(reservation),
      attemptCount: 0,
      createdAt: "2026-08-16T10:00:00.000Z",
      id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
      lastFailureReason: null,
      nextAttemptAt: null,
      outcome: null,
      status: phoneStatus,
      tenantId: "tenant-web",
      transcript: [],
      updatedAt: "2026-08-16T10:00:00.000Z",
    };

    expect(toReservationJob(call).status).toBe(reservationStatus);
  });
});
