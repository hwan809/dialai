export const reservationStatuses = [
  "queued",
  "dialing",
  "connected",
  "retry_scheduled",
  "confirmed",
  "unavailable",
  "needs_human",
  "failed",
  "canceled",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export type ReservationOutcome =
  | { result: "confirmed"; confirmedAt: string; confirmationName?: string; notes?: string }
  | { result: "unavailable"; alternatives: string[]; notes?: string }
  | { result: "needs_human"; reason: string };

export type CreateReservationInput = {
  idempotencyKey: string;
  destinationPhone: string;
  placeName: string;
  customerName: string;
  partySize: number;
  requestedAt: string;
  requestNotes?: string;
};

export type ReservationJob = CreateReservationInput & {
  id: string;
  tenantId: string;
  status: ReservationStatus;
  attemptCount: number;
  nextAttemptAt: string;
  outcome: ReservationOutcome | null;
  lastFailureReason: string | null;
  transcript: Array<{ role: "assistant" | "user"; text: string; at: string }>;
  createdAt: string;
  updatedAt: string;
};
