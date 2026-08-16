import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

import type { McpKeyStore, RotateMcpKeyInput } from "./mcp-key-issuer";

export class SupabaseMcpKeyStore implements McpKeyStore {
  constructor(private readonly admin: SupabaseClient = createSupabaseAdmin()) {}

  async rotateForUser(input: RotateMcpKeyInput): Promise<void> {
    const { error } = await this.admin.rpc("rotate_mcp_api_key", {
      p_owner_user_id: input.userId,
      p_tenant_name: input.tenantName,
      p_key_hash: input.keyHash,
    });
    if (error) throw new Error("MCP API key rotation failed.");
  }
}
