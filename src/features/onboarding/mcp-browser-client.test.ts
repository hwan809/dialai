import { describe, expect, it, vi } from "vitest";

import { ensureAccessToken, requestMcpInstall } from "./mcp-browser-client";

describe("browser MCP onboarding", () => {
  it("reuses an existing Supabase access token", async () => {
    const signInAnonymously = vi.fn();
    const token = await ensureAccessToken({
      getSession: vi.fn(async () => ({ data: { session: { access_token: "existing-token" } }, error: null })),
      signInAnonymously,
    });

    expect(token).toBe("existing-token");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates an anonymous session when the browser has no session", async () => {
    const token = await ensureAccessToken({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signInAnonymously: vi.fn(async () => ({
        data: { session: { access_token: "anonymous-token" } },
        error: null,
      })),
    });

    expect(token).toBe("anonymous-token");
  });

  it("requests a no-store tenant command with the access token", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      installCommand: "export DIALAI_MCP_TOKEN='call_test' && codex --search",
      mcpUrl: "https://dialai-azure.vercel.app/mcp",
    }), { status: 201, headers: { "content-type": "application/json" } }));

    const result = await requestMcpInstall("anonymous-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/mcp/install", {
      body: JSON.stringify({ tenantName: "DialAI Web" }),
      cache: "no-store",
      headers: {
        authorization: "Bearer anonymous-token",
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(result.installCommand).toContain("codex --search");
  });

  it("rejects failed or malformed install responses", async () => {
    await expect(requestMcpInstall("token", async () => new Response("{}", { status: 500 })))
      .rejects.toThrow("연결 명령을 만들지 못했습니다");
    await expect(requestMcpInstall("token", async () => new Response("{}", {
      status: 201,
      headers: { "content-type": "application/json" },
    }))).rejects.toThrow("연결 명령을 만들지 못했습니다");
  });
});
