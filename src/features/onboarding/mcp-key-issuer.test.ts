import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { McpKeyIssuer, type McpKeyStore } from "./mcp-key-issuer";

describe("McpKeyIssuer", () => {
  it("stores only a SHA-256 hash and returns a one-line Codex install command", async () => {
    const rawKey = "call_abcdefghijklmnopqrstuvwxyz1234567890";
    const store: McpKeyStore = { rotateForUser: vi.fn(async () => undefined) };
    const issuer = new McpKeyIssuer(store, () => rawKey);

    const result = await issuer.issue({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl: "https://dialai.example/mcp",
    });

    expect(store.rotateForUser).toHaveBeenCalledWith({
      userId: "user-123",
      tenantName: "Codex Demo",
      keyHash: createHash("sha256").update(rawKey).digest("hex"),
    });
    expect(JSON.stringify(vi.mocked(store.rotateForUser).mock.calls)).not.toContain(rawKey);
    expect(result).toMatchObject({
      apiKey: rawKey,
      mcpUrl: "https://dialai.example/mcp",
    });
    expect(result.installCommand).not.toContain("\n");
  });

  it("rejects a non-HTTPS public MCP URL", async () => {
    const issuer = new McpKeyIssuer(
      { rotateForUser: vi.fn(async () => undefined) },
      () => "call_abcdefghijklmnopqrstuvwxyz1234567890",
    );

    await expect(issuer.issue({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl: "http://dialai.example/mcp",
    })).rejects.toThrow("HTTPS");
  });

  it("replaces an existing registration, verifies hosted readiness, then launches Codex", async () => {
    const rawKey = "call_abcdefghijklmnopqrstuvwxyz1234567890";
    const issuer = new McpKeyIssuer(
      { rotateForUser: vi.fn(async () => undefined) },
      () => rawKey,
    );

    const result = await issuer.issue({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl: "https://dialai.example/mcp",
    });

    expect(result.installCommand).toBe(
      "export DIALAI_MCP_TOKEN='call_abcdefghijklmnopqrstuvwxyz1234567890' && "
      + "(codex mcp remove dialai >/dev/null 2>&1 || true) && "
      + "codex mcp add dialai --url 'https://dialai.example/mcp' --bearer-token-env-var 'DIALAI_MCP_TOKEN' && "
      + "curl --fail --silent --show-error --header 'Authorization: Bearer call_abcdefghijklmnopqrstuvwxyz1234567890' 'https://dialai.example/api/mcp/ready' && "
      + "codex --search",
    );
  });

  it.each([
    "https://user:password@dialai.example/mcp",
    "https://dialai.example/mcp#fragment",
    "http://dialai.example/mcp",
  ])("rejects unsafe public MCP URL %s", async (mcpUrl) => {
    const issuer = new McpKeyIssuer(
      { rotateForUser: vi.fn(async () => undefined) },
      () => "call_abcdefghijklmnopqrstuvwxyz1234567890",
    );

    await expect(issuer.issue({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl,
    })).rejects.toThrow();
  });

  it("allows HTTP only for a loopback MCP URL", async () => {
    const issuer = new McpKeyIssuer(
      { rotateForUser: vi.fn(async () => undefined) },
      () => "call_abcdefghijklmnopqrstuvwxyz1234567890",
    );

    await expect(issuer.issue({
      userId: "user-123",
      tenantName: "Codex Demo",
      mcpUrl: "http://localhost:3000/mcp",
    })).resolves.toMatchObject({ mcpUrl: "http://localhost:3000/mcp" });
  });
});
