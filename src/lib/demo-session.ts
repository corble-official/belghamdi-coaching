/**
 * Demo-mode simulated client session.
 *
 * A single exact cookie name shared by:
 * - `POST /api/auth/demo-session` (sets it — demo mode only; the VALUE is a
 *   random per-login token so demo stores can be keyed per visitor)
 * - `src/middleware.ts` (presence-of-cookie gate for `/portal/*` — presence
 *   only, the value is never validated)
 * - `POST /api/auth/signout` (clears it)
 *
 * In live mode this cookie is meaningless: middleware switches to the
 * Supabase auth-cookie presence check and the demo-session route returns 404.
 */
export const DEMO_SESSION_COOKIE = "bc_demo_session";
