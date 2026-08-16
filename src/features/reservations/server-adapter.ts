import type { CreatePhoneCallInput, PhoneCallJob } from "@/features/phone-calls/types";
import { z } from "zod";

import type { CreateReservationInput, ReservationJob } from "./types";

const reservationContextSchema = z.object({
  kind: z.literal("restaurant_reservation"),
  reservation: z.object({
    customerName: z.string(),
    partySize: z.number().int(),
    placeName: z.string(),
    requestedAt: z.string(),
    requestNotes: z.string().optional(),
  }),
});

export function toPhoneCallInput(input: CreateReservationInput): CreatePhoneCallInput {
  return {
    context: JSON.stringify({
      kind: "restaurant_reservation",
      reservation: {
        customerName: input.customerName,
        partySize: input.partySize,
        placeName: input.placeName,
        requestedAt: input.requestedAt,
        ...(input.requestNotes === undefined ? {} : { requestNotes: input.requestNotes }),
      },
    }),
    destinationPhone: input.destinationPhone,
    idempotencyKey: input.idempotencyKey,
    objective: `${input.placeName}에 ${formatReservationTime(input.requestedAt)}, ${input.partySize}명, ${input.customerName} 이름으로 예약 가능한지 바로 묻고 예약을 확정해 주세요.`,
    successCriteria: [
      "요청한 일시와 인원으로 예약이 확정되었는지 확인",
      `예약자명이 ${input.customerName}으로 등록되었는지 확인`,
      "확정 여부와 매장이 안내한 주의사항을 사실로 기록",
    ],
  };
}

function formatReservationTime(requestedAt: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "long",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date(requestedAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const minute = value("minute");
  const minuteText = minute === "00" ? "" : ` ${Number(minute)}분`;

  return `${value("year")}년 ${value("month")} ${value("day")}일 ${value("dayPeriod")} ${value("hour")}시${minuteText}`;
}

export function toReservationJob(call: PhoneCallJob): ReservationJob {
  const context = parseReservationContext(call.context);

  return {
    ...context.reservation,
    attemptCount: call.attemptCount,
    createdAt: call.createdAt,
    destinationPhone: call.destinationPhone,
    id: call.id,
    idempotencyKey: call.idempotencyKey,
    lastFailureReason: call.lastFailureReason,
    outcome: call.outcome,
    status: call.status,
    transcript: call.transcript,
    updatedAt: call.updatedAt,
  };
}

function parseReservationContext(context: string | undefined) {
  if (context === undefined) {
    throw new ReservationAdapterError("예약 전화 context가 없습니다.");
  }

  try {
    return reservationContextSchema.parse(JSON.parse(context));
  } catch {
    throw new ReservationAdapterError("예약 전화 context를 읽을 수 없습니다.");
  }
}

export class ReservationAdapterError extends Error {
  readonly name = "ReservationAdapterError";
}
