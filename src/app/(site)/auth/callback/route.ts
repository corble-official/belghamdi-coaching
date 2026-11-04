import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/mode";
import { acceptInviteByUser } from "@/lib/provisioning/invite";
import { createPortalClient } from "@/lib/supabase/supabase-auth";
import type { VerifyEmailOtpParams } from "@supabase/supabase-js";

/* GET /auth/callback — Supabase Auth redirect target (emailRedirectTo).
   Consumes the sign-in link and lands on /portal; on failure /login?error=auth.

   Two accepted shapes:
   - `?code=<verifier>`  → exchangeCodeForSession() (PKCE flow)
   - `?token_hash=…&type=…` → verifyOtp() (magic-link/hash link shape)

   NOTE: `createPortalClient()` (Task 1) uses the supabase-js default
   flowType "implicit" — with the default email template the magic link
   arrives as `#access_token=…` in the URL FRAGMENT, which a server route
   cannot read. The explicit `token_hash` link shape and a PKCE cutover
   are both handled here; switching the client flowType to "pkce" at the
   live cutover pairs this route with `exchangeCodeForSession`. Tracked in
   the task-3 report / dashboard TODOs. */

const OTP_TYPES: readonly string[] = [
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email",
  "email_change",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const fail = () => NextResponse.redirect(new URL("/login?error=auth", url.origin));

  // No real auth in demo mode / unconfigured Supabase — bounce to login.
  if (isDemoMode() || !isSupabaseConfigured()) return fail();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  let userId: string | null = null;

  try {
    const supabase = await createPortalClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail();
      userId = data.user?.id ?? null;
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as VerifyEmailOtpParams["type"],
      });
      if (error) return fail();
      userId = data.user?.id ?? null;
    } else {
      return fail();
    }
  } catch {
    return fail();
  }

  // Task 2.5 — idempotent invitation acceptance flip: the FIRST authorized
  // portal login marks clients.invite_status='accepted'. Guarded by the same
  // auth context as this route: the user id comes from the just-established
  // session (exchanged code / verified OTP), never from request input. The
  // update filter (auth_user_id = uid AND invite_status in pending/sent)
  // keeps repeat logins no-ops. A failed flip must never block the redirect.
  if (userId) {
    try {
      await acceptInviteByUser(userId);
    } catch {
      // swallow — login proceeds regardless
    }
  }

  return NextResponse.redirect(new URL("/portal", url.origin));
}
