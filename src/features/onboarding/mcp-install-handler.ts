import { z } from "zod";

import type { SupabaseUserPrincipal } from "@/features/auth/supabase-user-auth";
import type { IssuedMcpKey, IssueMcpKeyInput } from "./mcp-key-issuer";

const installRequestSchema = z.object({
  tenantName: z.string().trim().min(1).max(100).default("DialAI"),
});

export type McpInstallDependencies = {
  authenticate(request: Request): Promise<SupabaseUserPrincipal | null>;
  issue(input: IssueMcpKeyInput): Promise<IssuedMcpKey>;
  publicUrl?: string;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function mcpUrlFor(request: Request, configuredPublicUrl?: string): string {
  const origin = configuredPublicUrl ?? process.env.DIALAI_PUBLIC_URL ?? new URL(request.url).origin;
  return new URL("/mcp", origin).toString();
}

export function createMcpInstallPost(deps: McpInstallDependencies) {
  return async function POST(request: Request): Promise<Response> {
    let principal: SupabaseUserPrincipal | null;
    try {
      principal = await deps.authenticate(request);
    } catch {
      return json({ error: "mcp_install_failed" }, 500);
    }
    if (!principal) return json({ error: "unauthorized" }, 401);

    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    const parsed = installRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);

    try {
      const issued = await deps.issue({
        userId: principal.userId,
        tenantName: parsed.data.tenantName,
        mcpUrl: mcpUrlFor(request, deps.publicUrl),
      });
      return json(issued, 201);
    } catch {
      return json({ error: "mcp_key_issuance_failed" }, 500);
    }
  };
}
