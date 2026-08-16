import { z } from "zod";

import { createReservationInputSchema } from "./schema";
import type { CreateReservationInput } from "./types";

export const reservationConversationMessageSchema = z.object({
  content: z.string().trim().min(1).max(2_000),
  role: z.enum(["user", "assistant"]),
});

export const reservationConversationRequestSchema = z.object({
  messages: z.array(reservationConversationMessageSchema).min(1).max(40),
});

export const reservationConversationModelOutputSchema = z.object({
  reply: z.string().trim().min(1).max(1_000),
  reservation: z.object({
    customerName: z.string().nullable(),
    destinationPhone: z.string().nullable(),
    partySize: z.number().int().nullable(),
    placeName: z.string().nullable(),
    requestNotes: z.string().nullable(),
    requestedAt: z.string().nullable(),
  }),
});

export type ReservationConversationMessage = z.infer<typeof reservationConversationMessageSchema>;
export type ReservationConversationModelOutput = z.infer<typeof reservationConversationModelOutputSchema>;

export type ReservationConversationResult = {
  readonly input: Omit<CreateReservationInput, "idempotencyKey"> | null;
  readonly missingFields: readonly RequiredReservationField[];
  readonly ready: boolean;
  readonly reply: string;
};

const requiredFields = [
  "placeName",
  "destinationPhone",
  "requestedAt",
  "partySize",
  "customerName",
] as const;

type RequiredReservationField = (typeof requiredFields)[number];

export function finalizeReservationConversation(
  output: ReservationConversationModelOutput,
): ReservationConversationResult {
  const candidate = {
    ...output.reservation,
    idempotencyKey: "chat-validation",
    requestNotes: output.reservation.requestNotes?.trim() || undefined,
  };

  let parsed: ReturnType<typeof createReservationInputSchema.safeParse> | null = null;
  try {
    parsed = createReservationInputSchema.safeParse(candidate);
  } catch {
    // Some schema transforms intentionally throw for malformed phone numbers.
  }

  if (parsed?.success) {
    const input = {
      customerName: parsed.data.customerName,
      destinationPhone: parsed.data.destinationPhone,
      partySize: parsed.data.partySize,
      placeName: parsed.data.placeName,
      ...(parsed.data.requestNotes === undefined ? {} : { requestNotes: parsed.data.requestNotes }),
      requestedAt: parsed.data.requestedAt,
    };
    return { input, missingFields: [], ready: true, reply: output.reply };
  }

  const invalidPaths = new Set(
    parsed?.success === false
      ? parsed.error.issues.map((issue) => issue.path[0]).filter((path): path is string => typeof path === "string")
      : ["destinationPhone"],
  );
  const missingFields = requiredFields.filter((field) => {
    const value = output.reservation[field];
    return value === null || value === "" || invalidPaths.has(field);
  });

  return { input: null, missingFields, ready: false, reply: output.reply };
}
