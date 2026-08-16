import { authenticateSupabaseUser } from "@/features/auth/supabase-user-auth";
import { createMcpInstallPost } from "@/features/onboarding/mcp-install-handler";
import { McpKeyIssuer } from "@/features/onboarding/mcp-key-issuer";
import { SupabaseMcpKeyStore } from "@/features/onboarding/supabase-mcp-key-store";

export const runtime = "nodejs";

export const POST = createMcpInstallPost({
  authenticate: authenticateSupabaseUser,
  issue: (input) => new McpKeyIssuer(new SupabaseMcpKeyStore()).issue(input),
});
