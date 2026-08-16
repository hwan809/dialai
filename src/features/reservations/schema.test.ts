import { describe, expect, it } from "vitest";

import {
  createReservationInputSchema,
  normalizeKoreanPhoneNumber,
} from "./schema";

const valid = {
  idempotencyKey: "demo-request-001",
  destinationPhone: "02-1234-5678",
  placeName: "코덱스 식당",
  customerName: "홍길동",
  partySize: 2,
  requestedAt: "2026-08-17T19:00:00+09:00",
  requestNotes: "창가 자리 선호",
};

describe("createReservationInputSchema", () => {
  it("accepts and normalizes a timezone-qualified request", () => {
    expect(createReservationInputSchema.parse(valid)).toMatchObject({
      requestedAt: "2026-08-17T19:00:00+09:00",
      destinationPhone: "0212345678",
    });
  });

  it("rejects a timestamp without timezone", () => {
    expect(() =>
      createReservationInputSchema.parse({
        ...valid,
        requestedAt: "2026-08-17T19:00:00",
      }),
    ).toThrow();
  });

  it("rejects party sizes outside 1 through 20", () => {
    expect(() =>
      createReservationInputSchema.parse({ ...valid, partySize: 21 }),
    ).toThrow();
  });
});

describe("normalizeKoreanPhoneNumber", () => {
  it("removes separators but preserves the domestic leading zero", () => {
    expect(normalizeKoreanPhoneNumber("010-1234-5678")).toBe("01012345678");
    expect(normalizeKoreanPhoneNumber("02 1234 5678")).toBe("0212345678");
  });

  it("rejects non-Korean and malformed numbers", () => {
    expect(() => normalizeKoreanPhoneNumber("+1 415 555 0100")).toThrow();
    expect(() => normalizeKoreanPhoneNumber("010123")).toThrow();
  });
});
