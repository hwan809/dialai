import { reservationConversationRequestSchema } from "./conversation";
import { finalizeReservationConversation } from "./conversation";
import type { ReservationConversationMessage, ReservationConversationModelOutput } from "./conversation";

export type ReservationConversationCompleter = (
  messages: readonly ReservationConversationMessage[],
) => Promise<ReservationConversationModelOutput>;

export function createReservationConversationApi(dependencies: {
  readonly complete: ReservationConversationCompleter;
}) {
  return async (request: Request): Promise<Response> => {
    let body;
    try {
      body = reservationConversationRequestSchema.parse(await request.json());
    } catch {
      return Response.json({ error: "invalid_conversation_request" }, { status: 400 });
    }

    try {
      const output = await dependencies.complete(body.messages);
      return Response.json(finalizeReservationConversation(output));
    } catch (error) {
      console.error("Reservation conversation generation failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return Response.json({ error: "conversation_generation_failed" }, { status: 502 });
    }
  };
}
