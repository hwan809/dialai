import { createHash, randomBytes } from "node:crypto";

import { readinessUrlFor, shellQuote, validateMcpUrl } from "./mcp-url";

export type RotateMcpKeyInput = {
  userId: string;
  tenantName: string;
  keyHash: string;
};

export interface McpKeyStore {
  rotateForUser(input: RotateMcpKeyInput): Promise<void>;
}

export type IssueMcpKeyInput = {
  userId: string;
  tenantName: string;
  mcpUrl: string;
};

export type IssuedMcpKey = {
  apiKey: string;
  mcpUrl: string;
  installCommand: string;
};

function generateRawKey(): string {
  return `call_${randomBytes(32).toString("base64url")}`;
}

export class McpKeyIssuer {
  constructor(
    private readonly store: McpKeyStore,
    private readonly createRawKey: () => string = generateRawKey,
  ) {}

  async issue(input: IssueMcpKeyInput): Promise<IssuedMcpKey> {
    const mcpUrl = validateMcpUrl(input.mcpUrl).toString().replace(/\/$/, "");
    const readinessUrl = readinessUrlFor(new URL(mcpUrl)).toString();
    const apiKey = this.createRawKey();
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    await this.store.rotateForUser({
      userId: input.userId,
      tenantName: input.tenantName,
      keyHash,
    });

    return {
      apiKey,
      mcpUrl,
      installCommand: `export DIALAI_MCP_TOKEN=${shellQuote(apiKey)} && (codex mcp remove dialai >/dev/null 2>&1 || true) && codex mcp add dialai --url ${shellQuote(mcpUrl)} --bearer-token-env-var ${shellQuote("DIALAI_MCP_TOKEN")} && curl --fail --silent --show-error --header ${shellQuote(`Authorization: Bearer ${apiKey}`)} ${shellQuote(readinessUrl)} && codex --search`,
    };
  }
}
