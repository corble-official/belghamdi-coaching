import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/mode";
import { createPortalClient } from "@/lib/supabase/supabase-auth";

/* POST /api/auth/otp — sends a Supabase Auth email OTP ("magic link")
   to the given email. LIVE MODE ONLY: in demo mode the client portal uses
   the simulated session (`/api/auth/demo-session`) and never touches the
   network, so this route returns 404 there.

   Error radio contract (matched by the login UI → i18n):
   - "rate_limited"  → 429 (Supabase default mailer is unconfigured and
     heavily rate-limited in this environment; users see the localized
     wait message instead of a raw failure)
   - "invalid_email" → 400 (bad format)
   - "generic"       → anything else (incl. signup-disabled instances)

   Rate limiting: simple in-memory fixed window per IP+email, best-effort
   at instance level. PRODUCTIONIZED retry/rate limiting (Redis/persistent
   backpressure) is out of scope for this task.

   Privacy: the email address is PII and is NEVER written to logs. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_TRACKED_KEYS = 1000;

type OtpErrorCode = "rate_limited" | "invalid_email" | "generic";

/** email → [timestamps of recent sends] (in-memory, resets on redeploy). */
const sendLog = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();

  if (sendLog.size > MAX_TRACKED_KEYS) {
    // Deleting current keys during forEach on a Map is safe in JS; only
    // expired keys are removed so adversary-supplied keys can't be dropped
    // to bypass the window.
    sendLog.forEach((hits, k) => {
      if (hits[hits.length - 1] < now - WINDOW_MS) sendLog.delete(k);
    });
  }

  const hits = sendLog.get(key)?.filter((t) => t > now - WINDOW_MS) ?? [];
  if (hits.length >= MAX_SENDS_PER_WINDOW) {
    sendLog.set(key, hits);
    return true;
  }

  hits.push(now);
  sendLog.set(key, hits);
  return false;
}

function classifyError(err: { status?: number; message?: string }): OtpErrorCode {
  const status = err.status ?? 0;
  const message = err.message ?? "";
  if (status === 429 || /rate.?limit|too many/i.test(message)) return "rate_limited";
  if (status === 422 || /invalid|unable to validate|validation error/i.test(message))
    return "invalid_email";
  return "generic";
}

const HTTP_BY_CODE: Record<OtpErrorCode, number> = {
  rate_limited: 429,
  invalid_email: 400,
  generic: 502,
};

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "generic" as OtpErrorCode }, { status: 503 });
  }

  let email: string;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body?.email !== "string") {
      return NextResponse.json({ error: "invalid_email" as OtpErrorCode }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "invalid_email" as OtpErrorCode }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" as OtpErrorCode }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-ip";
  if (rateLimited(`${ip}|${email}`)) {
    return NextResponse.json({ error: "rate_limited" as OtpErrorCode }, { status: 429 });
  }

  try {
    const supabase = await createPortalClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: new URL("/auth/callback", req.url).toString(),
      },
    });

    if (error) {
      const code = classifyError(error);
      // PII note: log the failure class only — never the email.
      console.error(`[auth/otp] send failed (${code}, status ${error.status ?? 0})`);
      return NextResponse.json({ error: code }, { status: HTTP_BY_CODE[code] });
    }
  } catch (err) {
    console.error("[auth/otp] unexpected failure");
    const code = classifyError(err as { status?: number; message?: string });
    return NextResponse.json({ error: code }, { status: HTTP_BY_CODE[code] });
  }

  return NextResponse.json({ ok: true });
}
