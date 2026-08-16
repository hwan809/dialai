import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { authenticateApiKey } from "./api-key-auth";

describe("authenticateApiKey", () => {
  it("hashes an active bearer token before looking up its tenant", async () => {
    const rawKey = "call_abcdefghijklmnopqrstuvwxyz123456";
    const lookup = vi.fn().mockResolvedValue("tenant-a");
    await expect(authenticateApiKey(new Request("https://example.test/mcp", { headers: { Authorization: `Bearer ${rawKey}` } }), lookup)).resolves.toEqual({ tenantId: "tenant-a" });
    expect(lookup).toHaveBeenCalledWith(createHash("sha256").update(rawKey).digest("hex"));
  });

  it("rejects missing, malformed, and revoked bearer tokens", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    await expect(authenticateApiKey(new Request("https://example.test/mcp"), lookup)).resolves.toBeNull();
    await expect(authenticateApiKey(new Request("https://example.test/mcp", { headers: { Authorization: "Bearer bad" } }), lookup)).resolves.toBeNull();
    await expect(authenticateApiKey(new Request("https://example.test/mcp", { headers: { Authorization: "Bearer call_abcdefghijklmnopqrstuvwxyz123456" } }), lookup)).resolves.toBeNull();
  });
});
