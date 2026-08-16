import { z } from "zod";

export function normalizeKoreanPhoneNumber(value: string): string {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^0\d{8,10}$/.test(normalized)) {
    throw new Error("한국 국내 전화번호 형식이 아닙니다.");
  }
  return normalized;
}

export const createPhoneCallInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  destinationPhone: z.string().transform(normalizeKoreanPhoneNumber),
  objective: z.string().trim().min(1).max(1000),
  context: z.string().trim().max(2000).optional(),
  successCriteria: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

export const phoneCallIdSchema = z.object({ callId: z.string().uuid() });

export const listPhoneCallsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});
