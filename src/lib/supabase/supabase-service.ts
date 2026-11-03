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
 * Non-throwing variant for route handlers: returns null when the service
 * environment is missing/misconfigured so the caller can answer a clean
 * 503 {ok:false,error:"db_down"} instead of a raw 500.
 */
export function tryCreateServiceClient(): SupabaseClient | null {
  try {
    return createServiceClient();
  } catch (err) {
    console.error(
      "[supabase] service client unavailable",
      err instanceof Error ? err.message : "unknown"
    );
    return null;
  }
}

/**
 * Signed read URLs for check-in photos (bucket `checkin-photos`, 10-min TTL).
 *
 * OWNERSHIP RULE: each `objectPath` must be derived server-side from a DB row
 * the caller ALREADY validated through role/scope checks. The service client
 * is constructed ONCE and reused; signing runs in bounded parallel batches.
 */
export async function createSignedPhotoUrls(
  objectPaths: string[],
  ttlSeconds = 60 * 10,
  clientOverride?: SupabaseClient
): Promise<(string | null)[]> {
  const out: (string | null)[] = objectPaths.map(() => null);
  if (objectPaths.length === 0) return out;

  const client = clientOverride ?? createServiceClient();
  const BATCH = 20;

  for (let start = 0; start < objectPaths.length; start += BATCH) {
    const batch = objectPaths.slice(start, start + BATCH);
    const results = await Promise.all(
      batch.map(async (path) => {
        try {
          const { data } = await client.storage
            .from("checkin-photos")
            .createSignedUrl(path, ttlSeconds);
          return data?.signedUrl ?? null;
        } catch {
          return null;
        }
      })
    );
    results.forEach((url, i) => {
      out[start + i] = url;
    });
  }

  return out;
}

/** Single-path convenience wrapper over `createSignedPhotoUrls`. */
export async function createSignedPhotoUrl(
  objectPath: string
): Promise<string | null> {
  const [url] = await createSignedPhotoUrls([objectPath]);
  return url ?? null;
}
