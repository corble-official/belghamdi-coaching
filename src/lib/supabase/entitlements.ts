/**
 * THE single source of truth for the 6-feature portal entitlement matrix.
 * Pure, exported functions only — no imports from pages or routes.
 * Consumed by UI, API routes, and the admin dashboard.
 */
import { deriveAccess } from "./lifecycle";

export type SubscriptionEvent =
  | "payment_verified"
  | "activated"
  | "cancelled"
  | "expired"
  | "refunded_full"
  | "refunded_partial"
  | "dispute_opened"
  | "dispute_resolved"
  | "extended"
  | "renewed"
  | "manual_activated"
  | "manual_suspended"
  | "manual_extended"
  | "manual_revoked";

export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "refunded"
  | "disputed"
  | "suspended"
  | "pending";

export type SubscriptionState = {
  status: SubscriptionStatus;
  start_date: string;
  end_date: string;
  /** Set when cancelled before the period end. */
  cancelled_at?: string | null;
  /** Renewal restored. */
  resumed?: boolean;
};

export type Entitlements = {
  coach_chat: boolean;
  weekly_checkins: boolean;
  monthly_reviews: boolean;
  progress_submissions: boolean;
  /** True when history is available but new submissions are blocked. */
  checkin_history_readonly: boolean;
  coach_feedback_readonly: boolean;
  /** Pending onboarding clients can submit regardless of sub expiry. */
  onboarding_available: boolean;
};

const ALL_GATES_FALSE: Pick<
  Entitlements,
  | "coach_chat"
  | "weekly_checkins"
  | "monthly_reviews"
  | "progress_submissions"
  | "checkin_history_readonly"
  | "coach_feedback_readonly"
> = {
  coach_chat: false,
  weekly_checkins: false,
  monthly_reviews: false,
  progress_submissions: false,
  checkin_history_readonly: false,
  coach_feedback_readonly: false,
};

export function computeEntitlements(
  sub: SubscriptionState | null,
  today: Date,
  opts?: { onboardingPending?: boolean }
): Entitlements {
  const onboardingPending = opts?.onboardingPending ?? false;
  const onboardingAvailable = onboardingPending || sub?.status === "pending";

  if (!sub) {
    return {
      ...ALL_GATES_FALSE,
      onboarding_available: onboardingAvailable,
    };
  }

  const access = deriveAccess(sub.status, sub.end_date, today);

  switch (access) {
    case "full":
      return {
        coach_chat: true,
        weekly_checkins: true,
        monthly_reviews: true,
        progress_submissions: true,
        checkin_history_readonly: false,
        coach_feedback_readonly: false,
        onboarding_available: onboardingAvailable,
      };

    case "history_only":
      // History visible, but no new submissions and no coach chat.
      // Onboarding form availability is governed ONLY by
      // onboarding_available — never by flipping a feature gate.
      return {
        coach_chat: false,
        weekly_checkins: false,
        monthly_reviews: false,
        progress_submissions: false,
        checkin_history_readonly: true,
        coach_feedback_readonly: true,
        onboarding_available: onboardingAvailable,
      };

    case "suspended":
    case "revoked":
      // All gates closed including readonly history — per dispute-suspend
      // semantics. Revoked clients keep DATA in the DB (never delete), but
      // portal history access is allowed ONLY for `history_only`.
      return {
        ...ALL_GATES_FALSE,
        onboarding_available: onboardingAvailable,
      };
  }
}
