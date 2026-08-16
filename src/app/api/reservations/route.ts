import { createWebReservationApi } from "@/features/reservations/server-runtime";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createWebReservationApi().create(request);
}
