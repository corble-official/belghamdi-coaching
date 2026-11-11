import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";

/* Shared server-side auth helpers for integration API routes.
   Mirrors src/app/api/admin/auth/route.ts (bc_admin = SHA-256 of ADMIN_PASSWORD). */

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "belghamdi-demo";
}

export function adminCookieName(): string {
  return "bc_admin";
}

export function adminCookieValue(): string {
  // Must mirror src/app/api/admin/auth/route.ts tokenFor(): sha256 of "<password>::belghamdi-admin::v1"
  return createHash("sha256").update(`${adminPassword()}::belghamdi-admin::v1`).digest("hex");
}

/** Returns true when the request carries a valid admin cookie. */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(adminCookieName())?.value;
  return Boolean(value) && value === adminCookieValue();
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
