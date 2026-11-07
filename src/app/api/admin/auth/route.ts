import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "bc_admin";

async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}::fitforge-admin::v1`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = process.env.ADMIN_PASSWORD || "fitforge-demo";

  if (!body || body.password !== password) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
