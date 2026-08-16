import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type SupabaseUserPrincipal = { userId: string };
export type SupabaseUserLookup = (accessToken: string) => Promise<SupabaseUserPrincipal | null>;

async function defaultSupabaseUserLookup(accessToken: string): Promise<SupabaseUserPrincipal | null> {
  const { data, error } = await createSupabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

export async function authenticateSupabaseUser(
  request: Request,
  lookup: SupabaseUserLookup = defaultSupabaseUserLookup,
): Promise<SupabaseUserPrincipal | null> {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!accessToken) return null;
  return lookup(accessToken);
}
