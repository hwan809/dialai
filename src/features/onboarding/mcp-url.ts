function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "::1"
    || hostname === "[::1]"
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function validateMcpUrl(value: string): URL {
  const url = new URL(value);
  const loopback = isLoopbackHost(url.hostname);

  if (url.username || url.password || url.hash) {
    throw new Error("MCP URL must not include credentials or a fragment.");
  }
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("Public MCP URL은 HTTPS여야 합니다.");
  }

  return url;
}

export function readinessUrlFor(mcpUrl: URL): URL {
  return new URL("/api/mcp/ready", mcpUrl);
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
