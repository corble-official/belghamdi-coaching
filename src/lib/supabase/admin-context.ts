import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/mode";
import type { AdminRole } from "@/lib/admin/types";
import { createPortalClient, getAuthUser } from "./supabase-auth";

/**
 * Admin/CRM server context — role-check FIRST, service-role access AFTER.
 *
 * Role sources (binding matrix, Task 7 brief):
 *   1. Legacy admin: the `bc_admin` httpOnly cookie set by the existing
 *      /admin login (SHA-256 of the admin password, same algorithm as
 *      middleware + /api/admin/auth). Maps to role 'admin'; legacy admins
 *      get `assignedClientIds: null` (unbounded scope).
 *   2. JWT profile: `profiles.role` via the USER-JWT portal client.
 *      coach → assigned clients from the coach's own `coach_clients` rows
 *      (JWT read; RLS `bc_coach_clients_select` allows self rows).
 *      coach_assistant → own `coach_assistants` rows (JWT), then the linked
 *      coaches' `coach_clients` rows. NOTE: assistant-side assignment reads
 *      go through the SERVICE client AFTER the role has already been
 *      confirmed — `bc_coach_clients_select` only permits profile owners,
 *      so a JWT assistant cannot read its coach's assignment ledger. This
 *      service read runs strictly after the staff gate (documented in the
 *      task report as the agreed role-check-first/service-after pattern).
 *   3. In demo mode there are no JWT profiles — the legacy cookie is the
 *      ONLY staff key, even though pages render simulated data. API routes
 *      therefore still 403 unauthenticated callers in demo (the negative
 *      probe in the runbook pins this).
 *
 * The SERVICE client must only be constructed as a part of DB reads/writes
 * that happen AFTER this function proves a staff role (see assertStaff).
 */

const ADMIN_COOKIE = "bc_admin";

const STAFF_ROLES: readonly AdminRole[] = ["admin", "coach", "coach_assistant"];

export type AdminContext = {
  demo: boolean;
  /** Staff role only; non-staff (client/anonymous/none) normalizes to null. */
  role: AdminRole | null;
  /** JWT profile id — null for legacy-cookie admins (no profiles row). */
  profileId: string | null;
  legacy: boolean;
  /** null = unbounded (admin); [] = staff but zero assignments. */
  assignedClientIds: string[] | null;
};

/** Same digest as middleware + /api/admin/auth — kept in lockstep on purpose. */
async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(
    `${password}::belghamdi-admin::v1`
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hasLegacyAdminCookie(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  const password = process.env.ADMIN_PASSWORD || "belghamdi-demo";
  return cookie === (await tokenFor(password));
}

const str = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asIdList = (value: unknown[]): string[] =>
  value.filter((v): v is string => typeof v === "string");

export async function getAdminContext(): Promise<AdminContext> {
  const legacy = await hasLegacyAdminCookie();

  // ---- Demo path: legacy cookie is the only staff key (zero network) ----
  if (isDemoMode()) {
    if (legacy) {
      return {
        demo: true,
        role: "admin",
        profileId: null,
        legacy: true,
        assignedClientIds: null,
      };
    }
    return {
      demo: true,
      role: null,
      profileId: null,
      legacy: false,
      assignedClientIds: null,
    };
  }

  // ---- Legacy admin (live) ----
  if (legacy) {
    return {
      demo: false,
      role: "admin",
      profileId: null,
      legacy: true,
      assignedClientIds: null,
    };
  }

  // ---- JWT path ----
  const user = await getAuthUser();
  if (!user) {
    return {
      demo: false,
      role: null,
      profileId: null,
      legacy: false,
      assignedClientIds: null,
    };
  }

  const supabase = await createPortalClient();
  const profileRes = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  const role = str(profileRes.data?.role);
  const normalized = STAFF_ROLES.includes(role as AdminRole)
    ? (role as AdminRole)
    : null;

  if (!normalized) {
    return {
      demo: false,
      role: null,
      profileId: user.id,
      legacy: false,
      assignedClientIds: null,
    };
  }

  if (normalized === "admin") {
    return {
      demo: false,
      role: "admin",
      profileId: user.id,
      legacy: false,
      assignedClientIds: null,
    };
  }

  if (normalized === "coach") {
    const ccRes = await supabase
      .from("coach_clients")
      .select("client_id")
      .eq("profile_id", user.id);
    const assigned = asIdList(
      (ccRes.data ?? []).map((r) => (r as { client_id?: unknown }).client_id)
    );
    return {
      demo: false,
      role: "coach",
      profileId: user.id,
      legacy: false,
      assignedClientIds: assigned,
    };
  }

  // coach_assistant — own active links via JWT, coach assignments via the
  // service client AFTER the role is confirmed (see module doc).
  const linksRes = await supabase
    .from("coach_assistants")
    .select("coach_profile_id, status")
    .eq("assistant_profile_id", user.id);

  const activeCoaches = asIdList(
    (linksRes.data ?? [])
      .filter(
        (r) =>
          (r as { status?: unknown }).status === "active" &&
          str((r as { coach_profile_id?: unknown }).coach_profile_id)
      )
      .map((r) => str((r as { coach_profile_id?: unknown }).coach_profile_id)!)
  );

  if (activeCoaches.length === 0) {
    return {
      demo: false,
      role: "coach_assistant",
      profileId: user.id,
      legacy: false,
      assignedClientIds: [],
    };
  }

  // Role re-check FIRST is done; the service read AFTER is scoped to the
  // confirmed coaches' assignment rows only.
  const { createServiceClient } = await import("./supabase-service");
  const service = createServiceClient();
  const ccRes = await service
    .from("coach_clients")
    .select("client_id")
    .in("profile_id", activeCoaches);

  const assigned = asIdList(
    (ccRes.data ?? []).map((r) => (r as { client_id?: unknown }).client_id)
  );

  return {
    demo: false,
    role: "coach_assistant",
    profileId: user.id,
    legacy: false,
    assignedClientIds: assigned,
  };
}

export const isStaffRole = (role: AdminContext["role"]): boolean =>
  STAFF_ROLES.includes(role as AdminRole);

export type StaffGate =
  | { ctx: AdminContext; error: null }
  | { ctx: AdminContext; error: NextResponse };

/**
 * Route-level staff gate. Returns a ready-to-send 403 JSON response for
 * non-staff callers (clients, anonymous, invalid cookies). Attempts are
 * logged WITHOUT any PII — role/legacy/demo only.
 */
export async function assertStaff(): Promise<StaffGate> {
  const ctx = await getAdminContext();
  if (!isStaffRole(ctx.role)) {
    console.warn("[admin] staff gate denied", {
      role: ctx.role,
      legacy: ctx.legacy,
      demo: ctx.demo,
    });
    return {
      ctx,
      error: NextResponse.json(
        { ok: false, error: "forbidden", role: ctx.role },
        { status: 403 }
      ),
    };
  }
  return { ctx, error: null };
}

/** True when the caller may touch the given client row (scope + role). */
export function canAccessClient(ctx: AdminContext, clientId: string): boolean {
  if (ctx.role === "admin") return true;
  if (ctx.role === null) return false;
  return Boolean(ctx.assignedClientIds?.includes(clientId));
}

/**
 * Wrapper for out-of-scope client access — 404 so scoped callers cannot
 * probe the existence of unassigned client ids.
 */
export function scopeDenied(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "not_found" },
    { status: 404 }
  );
}
