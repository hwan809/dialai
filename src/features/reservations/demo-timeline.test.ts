import { describe, expect, it } from "vitest";
import { getDemoReservationSnapshot } from "./demo-timeline";

const createdAt = "2026-08-16T14:00:00.000Z";

describe("getDemoReservationSnapshot", () => {
  it.each([
    [0, "queued"],
    [1_200, "dialing"],
    [2_400, "ars"],
    [3_600, "waiting"],
    [4_800, "connected"],
    [6_500, "needs_user_input"],
  ])("%i밀리초 뒤에는 %s 상태를 반환한다", (elapsedMs, status) => {
    const now = new Date(Date.parse(createdAt) + elapsedMs);
    expect(getDemoReservationSnapshot(createdAt, now).status).toBe(status);
  });

  it("사용자 확인 전에는 선택 대기 상태와 전사를 반환한다", () => {
    const now = new Date(Date.parse(createdAt) + 7_000);
    const snapshot = getDemoReservationSnapshot(createdAt, now);
    expect(snapshot.status).toBe("needs_user_input");
    expect(snapshot.transcript).toHaveLength(4);
  });

  it("사용자가 대안 시간을 승인하면 해당 시간으로 예약을 확정한다", () => {
    const requestedAt = "2026-08-17T10:00:00.000Z";
    const response = {
      answeredAt: "2026-08-16T14:00:07.000Z",
      choiceId: "accept_alternative" as const,
      label: "오후 7시 30분으로 예약",
    };
    const now = new Date("2026-08-16T14:00:09.000Z");
    const snapshot = getDemoReservationSnapshot(createdAt, now, requestedAt, response);
    expect(snapshot.outcome?.result).toBe("confirmed");
    expect(snapshot.outcome?.result === "confirmed" && snapshot.outcome.confirmedAt).toBe(
      "2026-08-17T10:30:00.000Z",
    );
    expect(snapshot.transcript).toHaveLength(6);
  });
});
