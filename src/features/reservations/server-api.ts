import type { CancelPhoneCallResult } from "@/features/phone-calls/service";
import type { CreatePhoneCallInput, PhoneCallJob } from "@/features/phone-calls/types";
import { z } from "zod";

import { createReservationInputSchema } from "./schema";
import { toPhoneCallInput, toReservationJob } from "./server-adapter";

export interface ReservationPhoneCalls {
  cancel(tenantId: string, callId: string): Promise<CancelPhoneCallResult>;
  create(tenantId: string, input: CreatePhoneCallInput): Promise<PhoneCallJob>;
  get(tenantId: string, callId: string): Promise<PhoneCallJob | null>;
}

const callIdSchema = z.string().uuid();

export function createReservationApi(dependencies: {
  readonly phoneCalls: ReservationPhoneCalls;
  readonly tenantId: string;
}) {
  const { phoneCalls, tenantId } = dependencies;

  const getCallId = (callId: string): string | Response => {
    const parsed = callIdSchema.safeParse(callId);
    return parsed.success
      ? parsed.data
      : Response.json({ error: "invalid_reservation_id" }, { status: 400 });
  };

  return {
    cancel: async (unknownCallId: string) => {
      const callId = getCallId(unknownCallId);
      if (callId instanceof Response) return callId;

      const result = await phoneCalls.cancel(tenantId, callId);
      return result.job === null
        ? Response.json({ error: "reservation_not_found" }, { status: 404 })
        : Response.json(toReservationJob(result.job));
    },
    create: async (request: Request) => {
      let input;
      try {
        input = createReservationInputSchema.parse(await request.json());
      } catch {
        return Response.json({ error: "invalid_reservation_request" }, { status: 400 });
      }

      const call = await phoneCalls.create(tenantId, toPhoneCallInput(input));
      return Response.json(toReservationJob(call), { status: 201 });
    },
    get: async (unknownCallId: string) => {
      const callId = getCallId(unknownCallId);
      if (callId instanceof Response) return callId;

      const call = await phoneCalls.get(tenantId, callId);
      return call === null
        ? Response.json({ error: "reservation_not_found" }, { status: 404 })
        : Response.json(toReservationJob(call));
    },
    respond: async () => Response.json(
      { error: "live_response_not_supported" },
      { status: 409 },
    ),
  };
}
