import { describe, expect, it, vi } from "vitest";

import { createMcpInstallPost } from "@/features/onboarding/mcp-install-handler";

const issued = {
  apiKey: "call_abcdefghijklmnopqrstuvwxyz1234567890",
  mcpUrl: "https://dialai.example/mcp",
  installCommand: "export DIALAI_MCP_TOKEN='redacted-for-test' && codex mcp add dialai",
};

describe("POST /api/mcp/install", () => {
  it("issues one no-store installation response for an authenticated user", async () => {
    const issue = vi.fn(async () => issued);
    const post = createMcpInstallPost({
      authenticate: vi.fn(async () => ({ userId: "user-123" })),
      issue,
      publicUrl: "https://dialai.example",
    });

    const response = await post(new Request("https://internal.example/api/mcp/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantName: "Codex Demo" }),
    }));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(issued);
    expect(issue).toHaveBeenCalledWith({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl: "https://dialai.example/mcp",
    });
  });

  it("rejects unauthenticated requests before issuing a key", async () => {
    const issue = vi.fn();
    const post = createMcpInstallPost({
      authenticate: vi.fn(async () => null),
      issue,
      publicUrl: "https://dialai.example",
    });

    const response = await post(new Request("https://dialai.example/api/mcp/install", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(issue).not.toHaveBeenCalled();
  });

  it("returns a generic no-store server error when user authentication fails", async () => {
    const issue = vi.fn();
    const post = createMcpInstallPost({
      authenticate: vi.fn(async () => {
        throw new Error("Supabase network topology details");
      }),
      issue,
      publicUrl: "https://dialai.example",
    });

    const response = await post(new Request("https://dialai.example/api/mcp/install", { method: "POST" }));

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "mcp_install_failed" });
    expect(issue).not.toHaveBeenCalled();
  });

  it("rejects an invalid tenant name", async () => {
    const issue = vi.fn();
    const post = createMcpInstallPost({
      authenticate: vi.fn(async () => ({ userId: "user-123" })),
      issue,
      publicUrl: "https://dialai.example",
    });

    const response = await post(new Request("https://dialai.example/api/mcp/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantName: "" }),
    }));

    expect(response.status).toBe(400);
    expect(issue).not.toHaveBeenCalled();
  });
});
