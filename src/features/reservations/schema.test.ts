import { describe, expect, it } from "vitest";
import {
  createReservationInputSchema,
  formatKoreanDateTime,
  formatKoreanPhoneNumber,
  normalizeKoreanPhoneNumber,
  reservationJobSchema,
} from "./schema";

const validRequest = {
  customerName: "홍길동",
  destinationPhone: "02-1234-5678",
  idempotencyKey: "demo-request-001",
  partySize: 2,
  placeName: "코덱스 식당",
  requestNotes: "창가 자리 선호",
  requestedAt: "2026-08-17T19:00:00+09:00",
};

describe("createReservationInputSchema", () => {
  it("timezone이 포함된 예약 요청을 허용한다", () => {
    const parsed = createReservationInputSchema.parse(validRequest);

    expect(parsed.requestedAt).toBe(validRequest.requestedAt);
  });

  it("timezone이 없는 예약 시간을 거부한다", () => {
    const request = { ...validRequest, requestedAt: "2026-08-17T19:00:00" };

    expect(() => createReservationInputSchema.parse(request)).toThrow();
  });

  it("1명에서 20명 사이의 인원만 허용한다", () => {
    const request = { ...validRequest, partySize: 21 };

    expect(() => createReservationInputSchema.parse(request)).toThrow();
  });
});

describe("reservationJobSchema", () => {
  it("범용 전화 백엔드의 completed 결과를 허용한다", () => {
    const parsed = reservationJobSchema.parse({
      ...validRequest,
      attemptCount: 1,
      createdAt: "2026-08-16T10:00:00.000Z",
      destinationPhone: "0212345678",
      id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
      lastFailureReason: null,
      outcome: {
        facts: [{ label: "예약 시간", value: "오후 7시" }],
        needsFollowUp: false,
        result: "completed",
        summary: "예약이 접수되었습니다.",
      },
      status: "completed",
      transcript: [],
      updatedAt: "2026-08-16T10:01:00.000Z",
    });

    expect(parsed.outcome).toEqual({
      facts: [{ label: "예약 시간", value: "오후 7시" }],
      needsFollowUp: false,
      result: "completed",
      summary: "예약이 접수되었습니다.",
    });
  });

  it("needs_human 결과의 백엔드 요약을 보존한다", () => {
    const parsed = reservationJobSchema.parse({
      ...validRequest,
      attemptCount: 1,
      createdAt: "2026-08-16T10:00:00.000Z",
      destinationPhone: "0212345678",
      id: "05b3fb0e-261c-4a36-b97c-ed180096005c",
      lastFailureReason: null,
      outcome: {
        reason: "매장이 추가 확인을 요청했습니다.",
        result: "needs_human",
        summary: "예약 담당자 확인이 필요합니다.",
      },
      status: "needs_human",
      transcript: [],
      updatedAt: "2026-08-16T10:01:00.000Z",
    });

    expect(parsed.outcome).toMatchObject({
      result: "needs_human",
      summary: "예약 담당자 확인이 필요합니다.",
    });
  });
});

describe("normalizeKoreanPhoneNumber", () => {
  it("국내 전화번호의 구분자를 제거한다", () => {
    expect(normalizeKoreanPhoneNumber("010-1234-5678")).toBe("01012345678");
    expect(normalizeKoreanPhoneNumber("02 1234 5678")).toBe("0212345678");
  });

  it("해외 번호와 잘못된 번호를 거부한다", () => {
    expect(() => normalizeKoreanPhoneNumber("+1 415 555 0100")).toThrow();
    expect(() => normalizeKoreanPhoneNumber("010123")).toThrow();
  });
});

describe("formatKoreanPhoneNumber", () => {
  it("서울과 휴대전화 번호를 읽기 쉬운 형태로 표시한다", () => {
    expect(formatKoreanPhoneNumber("0212345678")).toBe("02-1234-5678");
    expect(formatKoreanPhoneNumber("01012345678")).toBe("010-1234-5678");
  });
});

describe("formatKoreanDateTime", () => {
  it("서울 시간대로 일시를 표시한다", () => {
    expect(formatKoreanDateTime("2026-08-17T10:00:00.000Z")).toBe(
      "2026년 8월 17일 오후 7:00",
    );
  });
});
