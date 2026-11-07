import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";

const ADMIN_COOKIE = "bc_admin";

/**
 * Cheap presence check for auth cookies set by `@supabase/ssr`
 * (`sb-<projectRef>-auth-token`, chunked as `sb-...-auth-token.<i>`).
 * NOT a session validation — middleware never calls the Supabase SDK;
 * deep verification is done server-side via `getPortalContext()` in the
 * portal layout (Task 4).
 */
function hasSupabaseAuthCookie(
  cookies: { name: string }[]
): boolean {
  return cookies.some(({ name }) => /(^sb-|\.sb-).*auth-token/.test(name));
}

async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}::fitforge-admin::v1`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- /portal/* gate (rough edge; deep verify in portal layout) ----
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    const unlatched = isDemoMode()
      ? !req.cookies.has(DEMO_SESSION_COOKIE)
      : !hasSupabaseAuthCookie(req.cookies.getAll());

    if (unlatched) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ---- Existing admin guard (unchanged) ----
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD || "fitforge-demo";
  const expected = await tokenFor(password);
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const authenticated = cookie === expected;
  const isLogin = pathname === "/admin/login";

  if (!authenticated && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (authenticated && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/portal", "/portal/:path*"],
};
