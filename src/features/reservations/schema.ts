import { z } from "zod";

const timezoneIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeKoreanPhoneNumber(value: string): string {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^0\d{8,10}$/.test(normalized)) {
    throw new Error("한국 국내 전화번호 형식이 아닙니다.");
  }
  return normalized;
}

export const createReservationInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  destinationPhone: z.string().transform(normalizeKoreanPhoneNumber),
  placeName: z.string().trim().min(1).max(100),
  customerName: z.string().trim().min(1).max(50),
  partySize: z.number().int().min(1).max(20),
  requestedAt: z.string().regex(timezoneIso, "timezone을 포함한 ISO 8601 형식이어야 합니다."),
  requestNotes: z.string().trim().max(500).optional(),
});

export const reservationIdSchema = z.object({ reservationId: z.string().uuid() });
export const listReservationsSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) });
