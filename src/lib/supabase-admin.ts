import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates the privileged client shared by the Next.js server and the standalone
 * voice worker. Do not add `server-only` here: the worker runs with `tsx`, not
 * the Next.js module loader.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase admin 환경변수가 필요합니다.");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
