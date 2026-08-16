import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { generateApiKey } from "./create-tenant";

it("creates a call key and its SHA-256 storage values", () => {
  const key = generateApiKey();
  expect(key.rawKey).toMatch(/^call_[A-Za-z0-9_-]{43}$/);
  expect(key.hash).toBe(createHash("sha256").update(key.rawKey).digest("hex"));
  expect(key.prefix).toBe(key.rawKey.slice(0, 12));
});
