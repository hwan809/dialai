import { describe, expect, it } from "vitest";
import {
  createReservationInputSchema,
  formatKoreanDateTime,
  formatKoreanPhoneNumber,
  normalizeKoreanPhoneNumber,
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
