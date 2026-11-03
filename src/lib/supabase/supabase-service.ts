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

/**
 * Signed read URL for a check-in photo (bucket `checkin-photos`, 10-min TTL).
 *
 * OWNERSHIP RULE: `objectPath` must be derived server-side from a DB row the
 * caller ALREADY validated through role/scope checks (folder prefix is the
 * owning client id) — this helper is never reachable from unauthenticated
 * routes because createServiceClient itself is service-role-only and every
 * admin route re-checks the staff role before its first DB read.
 */
export async function createSignedPhotoUrl(
  objectPath: string
): Promise<string | null> {
  const { data } = await createServiceClient()
    .storage.from("checkin-photos")
    .createSignedUrl(objectPath, 60 * 10);
  return data?.signedUrl ?? null;
}
