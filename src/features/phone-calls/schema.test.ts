import { describe, expect, it } from "vitest";

import {
  createPhoneCallInputSchema,
  listPhoneCallsSchema,
  normalizeKoreanPhoneNumber,
  phoneCallIdSchema,
} from "./schema";

const valid = {
  idempotencyKey: "demo-call-001",
  destinationPhone: "02-1234-5678",
  objective: "  오늘 영업시간과 주차 가능 여부를 확인해 주세요.  ",
  context: "  고객은 오후에 방문할 예정입니다.  ",
  successCriteria: ["  영업시간 확인  ", "주차 가능 여부 확인"],
};

describe("createPhoneCallInputSchema", () => {
  it("accepts a generic call objective and normalizes its text inputs", () => {
    expect(createPhoneCallInputSchema.parse(valid)).toEqual({
      idempotencyKey: "demo-call-001",
      destinationPhone: "0212345678",
      objective: "오늘 영업시간과 주차 가능 여부를 확인해 주세요.",
      context: "고객은 오후에 방문할 예정입니다.",
      successCriteria: ["영업시간 확인", "주차 가능 여부 확인"],
    });
  });

  it("rejects empty or overlong objectives", () => {
    expect(() =>
      createPhoneCallInputSchema.parse({ ...valid, objective: "   " }),
    ).toThrow();
    expect(() =>
      createPhoneCallInputSchema.parse({ ...valid, objective: "a".repeat(1001) }),
    ).toThrow();
  });

  it("rejects invalid optional context and success criteria", () => {
    expect(() =>
      createPhoneCallInputSchema.parse({ ...valid, context: "a".repeat(2001) }),
    ).toThrow();
    expect(() =>
      createPhoneCallInputSchema.parse({ ...valid, successCriteria: ["   "] }),
    ).toThrow();
    expect(() =>
      createPhoneCallInputSchema.parse({
        ...valid,
        successCriteria: Array.from({ length: 11 }, () => "확인 항목"),
      }),
    ).toThrow();
    expect(() =>
      createPhoneCallInputSchema.parse({
        ...valid,
        successCriteria: ["a".repeat(201)],
      }),
    ).toThrow();
  });

  it("requires idempotency keys between 8 and 128 characters", () => {
    expect(() =>
      createPhoneCallInputSchema.parse({ ...valid, idempotencyKey: "short" }),
    ).toThrow();
    expect(() =>
      createPhoneCallInputSchema.parse({
        ...valid,
        idempotencyKey: "a".repeat(129),
      }),
    ).toThrow();
  });
});

describe("normalizeKoreanPhoneNumber", () => {
  it("removes permitted separators while preserving the domestic leading zero", () => {
    expect(normalizeKoreanPhoneNumber("010-1234-5678")).toBe("01012345678");
    expect(normalizeKoreanPhoneNumber("02 1234 5678")).toBe("0212345678");
  });

  it("rejects non-Korean and malformed numbers", () => {
    expect(() => normalizeKoreanPhoneNumber("+1 415 555 0100")).toThrow();
    expect(() => normalizeKoreanPhoneNumber("010123")).toThrow();
  });
});

describe("phone-call query schemas", () => {
  it("accepts a UUID call id and defaults list limits to 20", () => {
    expect(phoneCallIdSchema.parse({ callId: "47a11e62-96f6-4ef8-9239-a229433d9f59" })).toEqual({
      callId: "47a11e62-96f6-4ef8-9239-a229433d9f59",
    });
    expect(listPhoneCallsSchema.parse({})).toEqual({ limit: 20 });
  });

  it("rejects invalid call ids and out-of-range list limits", () => {
    expect(() => phoneCallIdSchema.parse({ callId: "not-a-uuid" })).toThrow();
    expect(() => listPhoneCallsSchema.parse({ limit: 0 })).toThrow();
    expect(() => listPhoneCallsSchema.parse({ limit: 51 })).toThrow();
  });
});
