/**
 * Portal entitlement-banner variant — Task 4.
 *
 * Pure mapping from computed entitlements + a subscription snapshot to the
 * banner variant the portal shell renders. Server-layout only; safe to
 * import anywhere (no server-only, no network, no side effects).
 */
import type { Entitlements, SubscriptionStatus } from "./entitlements";

export type PortalSubscriptionSnapshot = {
  status: SubscriptionStatus;
  end_date: string;
} | null;

export type PortalBannerVariant =
  | "active"
  | "history_only"
  | "suspended"
  | "revoked"
  | "pending";

/**
 * Banner precedence mirrors the entitlement matrix:
 * - full access (coach chat on)              → active (green)
 * - expired / cancelled-past-end             → history_only (amber)
 * - refunded full                            → revoked (red)
 * - suspended / disputed / partial refund    → suspended (red)
 * - no subscription yet / pending activation
 *   / onboarding outstanding                 → pending (blue, informational)
 *
 * Revocation and suspension are checked BEFORE the onboarding fallback: an
 * onboarding-pending client whose access was suspended must still see the
 * red banner, never the informational blue one.
 */
export function derivePortalBanner(
  ent: Entitlements,
  subscription: PortalSubscriptionSnapshot
): PortalBannerVariant {
  if (ent.coach_chat) return "active";
  if (ent.checkin_history_readonly) return "history_only";

  if (subscription?.status === "refunded") return "revoked";
  if (
    subscription?.status === "suspended" ||
    subscription?.status === "disputed"
  ) {
    return "suspended";
  }

  // Everything else is either "not activated yet" or a closed account whose
  // gate is onboarding-only (`onboarding_available` true).
  return "pending";
}
