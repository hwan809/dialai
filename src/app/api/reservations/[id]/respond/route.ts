import { createWebReservationApi } from "@/features/reservations/server-runtime";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return createWebReservationApi().respond();
}
