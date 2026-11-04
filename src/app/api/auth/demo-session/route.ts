import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";

/* POST /api/auth/demo-session — SIMULATED client session for demo mode.
    Sets `bc_demo_session` (httpOnly, server-only cookie) so the middleware
    gate lets `/portal/*` through. No Supabase client is constructed and
    NOTHING touches the network.

    The cookie VALUE is a random per-login token (crypto.randomUUID) — not a
    shared constant — so demo per-visitor state (e.g. the simulated check-in
    store) can be keyed by it and two visitors never collide. Middleware
    only checks cookie PRESENCE; the value is never validated.

    In live mode this endpoint must not exist: 404. */

const DEMO_SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

export async function POST() {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, demo: true });
  res.cookies.set(DEMO_SESSION_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE_S,
  });
  return res;
}
