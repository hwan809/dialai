import { authenticateApiKey } from "@/features/auth/api-key-auth";
import { createPhoneCallMcpHandler } from "@/features/mcp/phone-call-server";
import { SupabasePhoneCallRepository } from "@/features/phone-calls/supabase-repository";
import { PhoneCallService } from "@/features/phone-calls/service";

export const runtime = "nodejs";

async function dispatch(request: Request): Promise<Response> {
  const principal = await authenticateApiKey(request);
  if (!principal) return Response.json({ error: "unauthorized" }, { status: 401 });
  return createPhoneCallMcpHandler({ tenantId: principal.tenantId, service: new PhoneCallService(new SupabasePhoneCallRepository()) }).fetch(request);
}

export { dispatch as GET, dispatch as POST, dispatch as DELETE };
