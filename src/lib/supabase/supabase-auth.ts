import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Cookie-session-aware Supabase client acting as the USER JWT.
 * This is the client ALL portal-facing routes use.
 */
export async function createPortalClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "portal client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = cookies();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Resolve the signed-in user (getSession → getUser fallback).
 * Returns null when no valid session/user is available.
 * Pass `client` to reuse an already-constructed portal client
 * (avoids building a second one per context resolution).
 */
export async function getAuthUser(
  client?: SupabaseClient
): Promise<User | null> {
  const supabase = client ?? (await createPortalClient());

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}
