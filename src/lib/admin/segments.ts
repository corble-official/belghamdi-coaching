/**
 * Segment classification for the admin client list — pure functions shared by
 * the API route (live rows) and the demo mapper (store rows) so both surfaces
 * bucket clients identically.
 *
 * Access levels come from deriveAccess() (Task 1 lifecycle module) so the
 * admin chips stay in lockstep with the portal entitlement gates.
 */
import { deriveAccess } from "@/lib/supabase/lifecycle";
import type { AccessLevel, AdminClientRow, AdminSegment } from "./types";

const ONBOARDING_PENDING = new Set(["needs_onboarding", "onboarding"]);

export function classifyAccess(
  subStatus: string | null,
  subEndDate: string | null,
  today: Date
): AccessLevel | "none" {
  if (!subStatus || !subEndDate) return "none";
  return deriveAccess(
    subStatus as Parameters<typeof deriveAccess>[0],
    subEndDate,
    today
  );
}

export function classifySegment(
  clientStatus: string,
  access: AccessLevel | "none",
  today: Date
): Exclude<AdminSegment, "all"> {
  if (access === "full") return "active";
  if (access === "history_only") return "expired";
  if (ONBOARDING_PENDING.has(clientStatus)) return "inactive";
  return "inactive";
}

/** End-of-week-dark helper: true when end_date has already passed. */
export function isOverdue(endDate: string | null, today: Date): boolean {
  if (!endDate) return false;
  return new Date(endDate).getTime() < today.getTime();
}

/** Row pre-normalizer for snake_case services rows. */
export function toRowBase(
  row: Partial<AdminClientRow> & { id: string; full_name: string }
): AdminClientRow {
  const today = new Date();
  const subStatus = row.sub_status ?? null;
  const subEnd = row.sub_end_date ?? null;
  const access = classifyAccess(subStatus, subEnd, today);
  const segment = classifySegment(row.client_status ?? "active", access, today);
  return {
    id: row.id,
    client_code: row.client_code ?? null,
    full_name: row.full_name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    package_id: row.package_id ?? null,
    client_status: row.client_status ?? "active",
    sub_id: row.sub_id ?? null,
    sub_status: subStatus,
    sub_start_date: row.sub_start_date ?? null,
    sub_end_date: subEnd,
    access,
    segment,
    last_checkin_at: row.last_checkin_at ?? null,
    demo: row.demo ?? false,
  };
}
