import { describe, expect, it, vi } from "vitest";

import { SupabaseMcpKeyStore } from "./supabase-mcp-key-store";

describe("SupabaseMcpKeyStore", () => {
  it("rotates the tenant key through one transactional RPC", async () => {
    const rpc = vi.fn(async () => ({ data: "tenant-123", error: null }));
    const store = new SupabaseMcpKeyStore({ rpc } as never);

    await store.rotateForUser({
      userId: "user-123",
      tenantName: "Codex Demo",
      keyHash: "a".repeat(64),
    });

    expect(rpc).toHaveBeenCalledWith("rotate_mcp_api_key", {
      p_owner_user_id: "user-123",
      p_tenant_name: "Codex Demo",
      p_key_hash: "a".repeat(64),
    });
  });

  it("does not expose a database error message", async () => {
    const store = new SupabaseMcpKeyStore({
      rpc: vi.fn(async () => ({ data: null, error: { message: "sensitive database detail" } })),
    } as never);

    await expect(store.rotateForUser({
      userId: "user-123",
      tenantName: "Codex Demo",
      keyHash: "a".repeat(64),
    })).rejects.toThrow("MCP API key rotation failed");
  });
});
