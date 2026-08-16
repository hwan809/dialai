import { pathToFileURL } from "node:url";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import { validateMcpUrl } from "@/features/onboarding/mcp-url";

const expectedTools = [
  "create_phone_call",
  "get_phone_call",
  "list_phone_calls",
  "cancel_phone_call",
] as const;

export function assertDialAiTools(toolNames: string[]): void {
  const missing = expectedTools.filter((name) => !toolNames.includes(name));
  if (missing.length > 0) {
    throw new Error(`DialAI MCP tool set is incomplete. Missing: ${missing.join(", ")}`);
  }
}

export function validateMcpHealthUrl(value: string): URL {
  return validateMcpUrl(value);
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

export async function runMcpHealth(): Promise<void> {
  const mcpUrl = validateMcpHealthUrl(requireEnvironment("DIALAI_MCP_URL"));
  const apiKey = requireEnvironment("DIALAI_MCP_TOKEN");
  const authenticatedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${apiKey}`);
    return fetch(input, { ...init, headers });
  };
  const client = new Client(
    { name: "dialai-health-check", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } },
  );

  try {
    await client.connect(new StreamableHTTPClientTransport(mcpUrl, { fetch: authenticatedFetch }));
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assertDialAiTools(tools);
    console.info("DialAI MCP ready.", { origin: mcpUrl.origin, toolCount: tools.length });
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runMcpHealth().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "DialAI MCP health check failed.");
    process.exitCode = 1;
  });
}
