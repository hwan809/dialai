import { describe, expect, it } from "vitest";

import { getResultContent } from "./result-content";
import type { ReservationJob } from "./types";

const baseJob: ReservationJob = {
  attemptCount: 1,
  createdAt: "2026-08-16T10:00:00.000Z",
  customerName: "홍길동",
  destinationPhone: "0212345678",
  id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
  idempotencyKey: "reservation-result-001",
  lastFailureReason: null,
  outcome: null,
  partySize: 2,
  placeName: "코덱스 식당",
  requestedAt: "2026-08-17T19:00:00+09:00",
  status: "completed",
  transcript: [],
  updatedAt: "2026-08-16T10:01:00.000Z",
};

describe("getResultContent", () => {
  it("후속 조치가 없는 completed 결과는 백엔드 요약과 확인 사실을 성공으로 표시한다", () => {
    const content = getResultContent({
      ...baseJob,
      outcome: {
        facts: [{ label: "예약 시간", value: "오후 7시" }],
        needsFollowUp: false,
        result: "completed",
        summary: "요청한 조건으로 예약이 접수되었습니다.",
      },
    });

    expect(content).toEqual({
      badge: "통화 완료",
      summary: "요청한 조건으로 예약이 접수되었습니다.",
      surfaceTone: "success",
      title: "전화 업무를 완료했습니다",
      tone: "success",
    });
  });

  it("후속 조치가 남은 completed 결과는 경고로 표시한다", () => {
    const content = getResultContent({
      ...baseJob,
      outcome: {
        facts: [],
        needsFollowUp: true,
        result: "completed",
        summary: "예약금 결제가 필요합니다.",
      },
    });

    expect(content).toMatchObject({
      badge: "후속 확인 필요",
      summary: "예약금 결제가 필요합니다.",
      surfaceTone: "warning",
      title: "추가로 확인할 내용이 있습니다",
      tone: "warning",
    });
  });
});
