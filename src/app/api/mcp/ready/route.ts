import { authenticateApiKey } from "@/features/auth/api-key-auth";
import { createMcpReadinessGet } from "@/features/onboarding/mcp-readiness-handler";

export const runtime = "nodejs";

export const GET = createMcpReadinessGet({
  authenticate: authenticateApiKey,
});
