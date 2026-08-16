import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type GeneratedApiKey = { rawKey: string; prefix: string; hash: string };

export function generateApiKey(): GeneratedApiKey {
  const rawKey = `call_${randomBytes(32).toString("base64url")}`;
  return { rawKey, prefix: rawKey.slice(0, 12), hash: createHash("sha256").update(rawKey).digest("hex") };
}

type TenantAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function createTenant(name: string, admin: TenantAdmin = createSupabaseAdmin()): Promise<GeneratedApiKey> {
  const apiKey = generateApiKey();
  const tenant = await admin.from("tenants").insert({ name }).select("id").single();
  if (tenant.error || !tenant.data) throw new Error("Tenant creation failed.");
  const key = await admin.from("api_keys").insert({ tenant_id: tenant.data.id, key_prefix: apiKey.prefix, key_hash: apiKey.hash });
  if (key.error) throw new Error("API key creation failed.");
  return apiKey;
}

async function main(): Promise<void> {
  const index = process.argv.slice(2).indexOf("--name");
  const name = index >= 0 ? process.argv.slice(2)[index + 1]?.trim() : undefined;
  if (!name) { console.error('Usage: tsx scripts/create-tenant.ts --name "Tenant name"'); process.exitCode = 1; return; }
  const apiKey = await createTenant(name);
  console.log(`Tenant API key (save now; it will not be shown again): ${apiKey.rawKey}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Tenant creation failed."); process.exitCode = 1; });
}
