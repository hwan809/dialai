import type {
  ReservationOutcome,
  ReservationStatus,
  TranscriptEntry,
  UserCallResponse,
} from "./types";

type DemoResponse = UserCallResponse & {
  readonly answeredAt: string;
};

type DemoSnapshot = {
  readonly outcome: ReservationOutcome | null;
  readonly status: ReservationStatus;
  readonly transcript: readonly TranscriptEntry[];
};

const beforeConfirmation = [
  { at: "00:01", role: "assistant", text: "안녕하세요. 예약 문의로 전화했습니다." },
  { at: "00:03", role: "user", text: "네, 예약 도와드리겠습니다." },
  { at: "00:05", role: "assistant", text: "내일 오후 7시, 두 명 예약 가능할까요?" },
  { at: "00:07", role: "user", text: "오후 7시는 어렵고 오후 7시 30분은 가능합니다." },
] as const satisfies readonly TranscriptEntry[];

export function getDemoReservationSnapshot(
  createdAt: string,
  now: Date,
  requestedAt: string = now.toISOString(),
  response?: DemoResponse,
): DemoSnapshot {
  const elapsedMs = now.getTime() - Date.parse(createdAt);
  if (elapsedMs < 1_200) {
    return emptySnapshot("queued");
  }
  if (elapsedMs < 2_400) {
    return emptySnapshot("dialing");
  }
  if (elapsedMs < 3_600) {
    return emptySnapshot("ars");
  }
  if (elapsedMs < 4_800) {
    return emptySnapshot("waiting");
  }
  if (elapsedMs < 6_500) {
    return { outcome: null, status: "connected", transcript: beforeConfirmation.slice(0, 2) };
  }
  if (response === undefined) {
    return { outcome: null, status: "needs_user_input", transcript: beforeConfirmation };
  }

  const answeredElapsedMs = now.getTime() - Date.parse(response.answeredAt);
  const responseEntry = {
    at: "00:09",
    role: "assistant" as const,
    text:
      response.choiceId === "accept_alternative"
        ? "네, 오후 7시 30분으로 예약해주세요."
        : "확인 감사합니다. 이번에는 예약하지 않겠습니다.",
  };
  if (answeredElapsedMs < 1_500) {
    return {
      outcome: null,
      status: "connected",
      transcript: [...beforeConfirmation, responseEntry],
    };
  }
  if (response.choiceId === "stop_request") {
    return {
      outcome: { alternatives: ["오후 7시 30분"], notes: response.label, result: "unavailable" },
      status: "unavailable",
      transcript: [...beforeConfirmation, responseEntry],
    };
  }

  const confirmedAt = new Date(Date.parse(requestedAt) + 30 * 60 * 1_000).toISOString();
  return {
    outcome: {
      confirmationName: "홍길동",
      confirmedAt,
      notes: "사용자가 확인한 대안 시간으로 예약했습니다.",
      result: "confirmed",
    },
    status: "confirmed",
    transcript: [
      ...beforeConfirmation,
      responseEntry,
      { at: "00:11", role: "user", text: "네, 홍길동 님 성함으로 예약했습니다." },
    ],
  };
}

function emptySnapshot(status: ReservationStatus): DemoSnapshot {
  return { outcome: null, status, transcript: [] };
}
