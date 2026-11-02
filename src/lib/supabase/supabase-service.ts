import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (server-only).
 *
 * This is the ONLY module in the codebase allowed to read
 * SUPABASE_SERVICE_ROLE_KEY — every other module imports
 * `createServiceClient` from here.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "service client requires SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url ?? "", serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
