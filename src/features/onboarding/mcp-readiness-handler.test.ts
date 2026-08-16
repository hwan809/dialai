import { describe, expect, it, vi } from "vitest";

import { createMcpReadinessGet } from "./mcp-readiness-handler";

describe("hosted MCP readiness", () => {
  it("returns a no-store ready response for a valid API-key principal", async () => {
    const authenticate = vi.fn(async () => ({ tenantId: "tenant-123" }));
    const get = createMcpReadinessGet({ authenticate });

    const response = await get(new Request("https://dialai.example/api/mcp/ready", {
      headers: { authorization: "Bearer call_abcdefghijklmnopqrstuvwxyz123456" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ready: true });
  });

  it("returns 401 when bearer authentication does not produce an API-key principal", async () => {
    const get = createMcpReadinessGet({ authenticate: vi.fn(async () => null) });

    const response = await get(new Request("https://dialai.example/api/mcp/ready", {
      headers: { authorization: "Bearer invalid" },
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });
});
