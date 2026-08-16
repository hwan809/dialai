import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { createTenant, generateApiKey } from "./create-tenant";

it("creates a call key and its SHA-256 storage values", () => {
  const key = generateApiKey();
  expect(key.rawKey).toMatch(/^call_[A-Za-z0-9_-]{43}$/);
  expect(key.hash).toBe(createHash("sha256").update(key.rawKey).digest("hex"));
  expect(key.prefix).toBe(key.rawKey.slice(0, 12));
});

it("stores only the API key hash in a legacy-compatible api_keys row", async () => {
  const tenantInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "tenant-123" }, error: null })),
    })),
  }));
  const keyInsert = vi.fn(async () => ({ error: null }));
  const admin = {
    from: vi.fn((table: string) => (
      table === "tenants" ? { insert: tenantInsert } : { insert: keyInsert }
    )),
  };

  await createTenant("Codex Demo", admin as never);

  expect(keyInsert).toHaveBeenCalledWith({
    tenant_id: "tenant-123",
    key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});
