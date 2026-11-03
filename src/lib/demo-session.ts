/**
 * Demo-mode simulated client session.
 *
 * A single exact cookie name shared by:
 * - `POST /api/auth/demo-session` (sets it — demo mode only)
 * - `src/middleware.ts` (presence-of-cookie gate for `/portal/*`)
 * - `POST /api/auth/signout` (clears it)
 *
 * In live mode this cookie is meaningless: middleware switches to the
 * Supabase auth-cookie presence check and the demo-session route returns 404.
 */
export const DEMO_SESSION_COOKIE = "bc_demo_session";
