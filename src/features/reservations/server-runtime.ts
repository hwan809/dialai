import { SupabasePhoneCallRepository } from "@/features/phone-calls/supabase-repository";
import { PhoneCallService } from "@/features/phone-calls/service";
import { z } from "zod";

import { createReservationApi } from "./server-api";

const tenantIdSchema = z.string().uuid();

export function readWebTenantId(
  _environment: Readonly<Record<string, string | undefined>>,
): string {
  const parsed = tenantIdSchema.safeParse(_environment.DIALAI_WEB_TENANT_ID);
  if (!parsed.success) {
    throw new Error("DIALAI_WEB_TENANT_ID must be a valid tenant UUID.");
  }
  return parsed.data;
}

export function createWebReservationApi() {
  return createReservationApi({
    phoneCalls: new PhoneCallService(new SupabasePhoneCallRepository()),
    tenantId: readWebTenantId(process.env),
  });
}
