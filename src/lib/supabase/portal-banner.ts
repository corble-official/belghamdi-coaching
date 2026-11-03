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
 * Banner precedence (Task 4 review ruling):
 * - expired / cancelled-past-end             → history_only (amber)
 * - refunded full                            → revoked (red)
 * - suspended / disputed / partial refund    → suspended (red)
 * - onboarding outstanding / pending
 *   activation / no subscription             → pending (blue, informational)
 * - full access (coach chat on)              → active (green)
 *
 * RED/AMBER beat the informational blue pending banner; BLUE PENDING WINS
 * over the green active banner (an active subscription with outstanding
 * onboarding still shows the eligibility notice, and the hub keeps its
 * onboarding card enabled). Demo (active, onboarding complete) stays green:
 * its `onboarding_available` is false when `coach_chat` is on.
 */
export function derivePortalBanner(
  ent: Entitlements,
  subscription: PortalSubscriptionSnapshot
): PortalBannerVariant {
  if (ent.checkin_history_readonly) return "history_only";

  if (subscription?.status === "refunded") return "revoked";
  if (
    subscription?.status === "suspended" ||
    subscription?.status === "disputed"
  ) {
    return "suspended";
  }

  if (ent.onboarding_available) return "pending";
  if (ent.coach_chat) return "active";

  // Residual fully-closed account whose status is outside the refunded /
  // suspended / disputed vocabulary — treat as the informational pending
  // state rather than lying with a green banner.
  return "pending";
}
