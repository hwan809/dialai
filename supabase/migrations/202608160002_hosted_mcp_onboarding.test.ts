import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL("./202608160002_hosted_mcp_onboarding.sql", import.meta.url));

describe("202608160002 hosted MCP onboarding migration", () => {
  it("removes the legacy non-null key_prefix before future key rotations", async () => {
    // This is a static contract test because this repository has no disposable Postgres migration harness.
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toMatch(/alter table public\.api_keys\s+drop column if exists key_prefix;/i);
    expect(migration).toMatch(/insert into public\.api_keys \(tenant_id, key_hash\)/i);
  });
});
