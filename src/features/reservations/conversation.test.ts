import { describe, expect, it } from "vitest";

import { finalizeReservationConversation } from "./conversation";

describe("finalizeReservationConversation", () => {
  it("모든 필수 정보가 유효할 때만 전화 확인 입력을 만든다", () => {
    const result = finalizeReservationConversation({
      reply: "필요한 정보를 모두 확인했어요. 아래 내용을 확인해주세요.",
      reservation: {
        customerName: "홍길동",
        destinationPhone: "02-1234-5678",
        partySize: 2,
        placeName: "코덱스 식당",
        requestNotes: "창가 자리",
        requestedAt: "2026-08-17T19:00:00+09:00",
      },
    });

    expect(result.ready).toBe(true);
    expect(result.input).toEqual({
      customerName: "홍길동",
      destinationPhone: "0212345678",
      partySize: 2,
      placeName: "코덱스 식당",
      requestNotes: "창가 자리",
      requestedAt: "2026-08-17T19:00:00+09:00",
    });
    expect(result.missingFields).toEqual([]);
  });

  it("전화번호가 불완전하면 확인 상태로 전환하지 않는다", () => {
    const result = finalizeReservationConversation({
      reply: "매장 전화번호를 알려주세요.",
      reservation: {
        customerName: "홍길동",
        destinationPhone: "1234",
        partySize: 2,
        placeName: "코덱스 식당",
        requestNotes: null,
        requestedAt: "2026-08-17T19:00:00+09:00",
      },
    });

    expect(result.ready).toBe(false);
    expect(result.input).toBeNull();
    expect(result.missingFields).toContain("destinationPhone");
  });

  it("아직 수집하지 않은 항목을 빠짐없이 반환한다", () => {
    const result = finalizeReservationConversation({
      reply: "어느 매장에 전화할까요?",
      reservation: {
        customerName: null,
        destinationPhone: null,
        partySize: null,
        placeName: null,
        requestNotes: null,
        requestedAt: null,
      },
    });

    expect(result.ready).toBe(false);
    expect(result.missingFields).toEqual([
      "placeName",
      "destinationPhone",
      "requestedAt",
      "partySize",
      "customerName",
    ]);
  });
});
