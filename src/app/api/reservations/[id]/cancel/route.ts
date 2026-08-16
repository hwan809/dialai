import { createWebReservationApi } from "@/features/reservations/server-runtime";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return createWebReservationApi().cancel(id);
}
