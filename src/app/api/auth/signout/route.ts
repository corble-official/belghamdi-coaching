import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import { createPortalClient } from "@/lib/supabase/supabase-auth";

/* POST /api/auth/signout — ends the client session and returns to the site.
   LIVE mode: superfluous auth/signOut() (also clears the user JWT cookies
   written by @supabase/ssr). Demo mode: clears the simulated session cookie.
   The demo cookie is cleared in both modes (harmless when absent). */

export async function POST(req: Request) {
  if (!isDemoMode() && isSupabaseConfigured()) {
    try {
      const supabase = await createPortalClient();
      await supabase.auth.signOut();
    } catch {
      // Session already gone or network hiccup — still clear cookies below.
    }
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
