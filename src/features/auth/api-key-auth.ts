import { createHash } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ApiKeyLookup = (hash: string) => Promise<string | null>;

export async function defaultApiKeyLookup(hash: string): Promise<string | null> {
  const { data, error } = await createSupabaseAdmin().from("api_keys").select("tenant_id").eq("key_hash", hash).is("revoked_at", null).maybeSingle();
  if (error) throw new Error("API key authentication lookup failed.");
  return data?.tenant_id ?? null;
}

export async function authenticateApiKey(request: Request, lookup: ApiKeyLookup = defaultApiKeyLookup): Promise<{ tenantId: string } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (call_[A-Za-z0-9_-]{24,})$/)?.[1];
  if (!token) return null;
  const tenantId = await lookup(createHash("sha256").update(token).digest("hex"));
  return tenantId ? { tenantId } : null;
}
