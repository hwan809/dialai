export const reservationStatuses = [
  "queued",
  "dialing",
  "ars",
  "waiting",
  "connected",
  "needs_user_input",
  "retry_scheduled",
  "confirmed",
  "unavailable",
  "needs_human",
  "failed",
  "canceled",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export const terminalReservationStatuses = [
  "confirmed",
  "unavailable",
  "needs_human",
  "failed",
  "canceled",
] as const satisfies readonly ReservationStatus[];

export type ReservationOutcome =
  | {
      readonly result: "confirmed";
      readonly confirmedAt: string;
      readonly confirmationName?: string;
      readonly notes?: string;
    }
  | {
      readonly result: "unavailable";
      readonly alternatives: readonly string[];
      readonly notes?: string;
    }
  | { readonly result: "needs_human"; readonly reason: string };

export type TranscriptEntry = {
  readonly role: "assistant" | "user";
  readonly text: string;
  readonly at: string;
};

export type UserCallResponse = {
  readonly choiceId: "accept_alternative" | "stop_request";
  readonly label: string;
};

export type CreateReservationInput = {
  readonly idempotencyKey: string;
  readonly destinationPhone: string;
  readonly placeName: string;
  readonly customerName: string;
  readonly partySize: number;
  readonly requestedAt: string;
  readonly requestNotes?: string;
};

export type ReservationJob = CreateReservationInput & {
  readonly id: string;
  readonly status: ReservationStatus;
  readonly attemptCount: number;
  readonly outcome: ReservationOutcome | null;
  readonly lastFailureReason: string | null;
  readonly transcript: readonly TranscriptEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return terminalReservationStatuses.some((terminalStatus) => terminalStatus === status);
}
