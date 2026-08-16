import { z } from "zod";
import { reservationStatuses } from "./types";

const timezoneIso =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const koreanDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function normalizeKoreanPhoneNumber(value: string): string {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^0\d{8,10}$/.test(normalized)) {
    throw new TypeError("한국 국내 전화번호 형식이 아닙니다.");
  }
  return normalized;
}

export function formatKoreanPhoneNumber(value: string): string {
  if (value.startsWith("02") && value.length === 10) {
    return `${value.slice(0, 2)}-${value.slice(2, 6)}-${value.slice(6)}`;
  }
  if (value.length === 11) {
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }
  return value;
}

export function formatKoreanDateTime(value: string): string {
  return koreanDateTimeFormatter.format(new Date(value));
}

export const createReservationInputSchema = z.object({
  customerName: z.string().trim().min(1).max(50),
  destinationPhone: z.string().transform(normalizeKoreanPhoneNumber),
  idempotencyKey: z.string().min(8).max(128),
  partySize: z.number().int().min(1).max(20),
  placeName: z.string().trim().min(1).max(100),
  requestNotes: z.string().trim().max(500).optional(),
  requestedAt: z
    .string()
    .regex(timezoneIso, "timezone을 포함한 ISO 8601 형식이어야 합니다."),
});

const transcriptEntrySchema = z.object({
  at: z.string(),
  role: z.union([z.literal("assistant"), z.literal("user")]),
  text: z.string(),
});

const reservationOutcomeSchema = z.discriminatedUnion("result", [
  z.object({
    confirmationName: z.string().optional(),
    confirmedAt: z.string(),
    notes: z.string().optional(),
    result: z.literal("confirmed"),
  }),
  z.object({
    alternatives: z.array(z.string()),
    notes: z.string().optional(),
    result: z.literal("unavailable"),
  }),
  z.object({ reason: z.string(), result: z.literal("needs_human") }),
]);

export const reservationJobSchema = createReservationInputSchema.extend({
  attemptCount: z.number().int().min(0),
  createdAt: z.string(),
  id: z.string(),
  lastFailureReason: z.string().nullable(),
  outcome: reservationOutcomeSchema.nullable(),
  status: z.enum(reservationStatuses),
  transcript: z.array(transcriptEntrySchema),
  updatedAt: z.string(),
});
