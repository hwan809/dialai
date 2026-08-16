export type McpReadinessDependencies = {
  authenticate(request: Request): Promise<{ tenantId: string } | null>;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function createMcpReadinessGet(deps: McpReadinessDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const principal = await deps.authenticate(request);
    if (!principal) return json({ error: "unauthorized" }, 401);
    return json({ ready: true }, 200);
  };
}
