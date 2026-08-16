import { describe, expect, it, vi } from "vitest";

import { authenticateSupabaseUser } from "./supabase-user-auth";

describe("authenticateSupabaseUser", () => {
  it("returns the user identity validated by Supabase", async () => {
    const lookup = vi.fn(async () => ({ userId: "user-123" }));
    const request = new Request("https://dialai.example/api/mcp/install", {
      headers: { authorization: "Bearer supabase-access-token" },
    });

    await expect(authenticateSupabaseUser(request, lookup)).resolves.toEqual({ userId: "user-123" });
    expect(lookup).toHaveBeenCalledWith("supabase-access-token");
  });

  it("rejects missing and invalid access tokens", async () => {
    const lookup = vi.fn(async () => null);

    await expect(authenticateSupabaseUser(new Request("https://dialai.example/api/mcp/install"), lookup)).resolves.toBeNull();
    await expect(authenticateSupabaseUser(new Request("https://dialai.example/api/mcp/install", {
      headers: { authorization: "Basic invalid" },
    }), lookup)).resolves.toBeNull();
    await expect(authenticateSupabaseUser(new Request("https://dialai.example/api/mcp/install", {
      headers: { authorization: "Bearer invalid-token" },
    }), lookup)).resolves.toBeNull();
  });
});
