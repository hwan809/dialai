import { createReservationConversationApi } from "@/features/reservations/conversation-api";
import { completeReservationConversation } from "@/features/reservations/conversation-completer";

export const runtime = "nodejs";

const handleConversation = createReservationConversationApi({
  complete: completeReservationConversation,
});

export async function POST(request: Request): Promise<Response> {
  return handleConversation(request);
}
