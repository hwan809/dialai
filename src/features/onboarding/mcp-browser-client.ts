import { z } from "zod";

type SessionResult = {
  data: { session: { access_token: string } | null };
  error: unknown | null;
};

export type BrowserAuth = {
  getSession(): Promise<SessionResult>;
  signInAnonymously(): Promise<SessionResult>;
};

export type McpInstallResult = {
  installCommand: string;
  mcpUrl: string;
};

const installResultSchema = z.object({
  installCommand: z.string().min(1),
  mcpUrl: z.url(),
});

export async function ensureAccessToken(auth: BrowserAuth): Promise<string> {
  const current = await auth.getSession();
  if (current.error) throw new Error("익명 세션을 만들지 못했습니다.");
  if (current.data.session?.access_token) return current.data.session.access_token;

  const created = await auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error("익명 세션을 만들지 못했습니다.");
  }
  return created.data.session.access_token;
}

export async function requestMcpInstall(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<McpInstallResult> {
  const response = await fetcher("/api/mcp/install", {
    body: JSON.stringify({ tenantName: "DialAI Web" }),
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error("연결 명령을 만들지 못했습니다.");

  const parsed = installResultSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("연결 명령을 만들지 못했습니다.");
  return parsed.data;
}
