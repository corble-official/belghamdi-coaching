/**
 * Lifecycle resolution — frozen decision #3.
 *
 * Pure function mapping a subscription event to the resulting
 * subscription status and portal access level.
 */
import type {
  SubscriptionEvent,
  SubscriptionState,
} from "./entitlements";

export type LifecycleAccess = "full" | "history_only" | "suspended" | "revoked";

export type LifecycleResult = {
  status: SubscriptionState["status"];
  access: LifecycleAccess;
};

const toDate = (iso: string): Date => new Date(iso);

const isPast = (iso: string, today: Date): boolean =>
  toDate(iso).getTime() < today.getTime();

export function resolveLifecycle(
  subEvent: SubscriptionEvent,
  ctx: { start_date: string; end_date: string; today: Date }
): LifecycleResult {
  const { end_date, today } = ctx;

  switch (subEvent) {
    case "payment_verified":
    case "activated":
    case "renewed":
    case "extended":
    case "manual_activated":
      return { status: "active", access: "full" };

    case "cancelled":
      // Cancelled clients keep full access until the paid period ends.
      return isPast(end_date, today)
        ? { status: "cancelled", access: "history_only" }
        : { status: "cancelled", access: "full" };

    case "expired":
      return { status: "expired", access: "history_only" };

    case "refunded_full":
      // Immediate revoke — data is kept in the DB, never deleted.
      return { status: "refunded", access: "revoked" };

    case "refunded_partial":
      // Suspended pending admin review.
      return { status: "suspended", access: "suspended" };

    case "dispute_opened":
      return { status: "disputed", access: "suspended" };

    case "dispute_resolved":
      // Prior state is restored by the caller; default to expired-history.
      return { status: "expired", access: "history_only" };

    case "manual_suspended":
      return { status: "suspended", access: "suspended" };

    case "manual_revoked":
      // No dedicated DB status vocabulary yet (lands with the migration
      // task) — suspended status + revoked access for now.
      return { status: "suspended", access: "revoked" };

    case "manual_extended":
      // end_date in ctx is already the extended date.
      return { status: "active", access: "full" };

    default: {
      const exhaustive: never = subEvent;
      void exhaustive;
      return { status: "pending", access: "suspended" };
    }
  }
}

/**
 * Determine effective portal access from a stored subscription state,
 * independent of any incoming event (e.g. natural expiry as time passes,
 * cancellation reaching its end date).
 */
export function deriveAccess(
  status: SubscriptionState["status"],
  end_date: string,
  today: Date
): LifecycleAccess {
  switch (status) {
    case "active":
    case "cancelled":
      // Both retain full access until the paid period ends.
      return isPast(end_date, today) ? "history_only" : "full";

    case "expired":
      return "history_only";

    case "suspended":
    case "disputed":
      return "suspended";

    case "refunded":
      return "revoked";

    case "pending":
      return "suspended";
  }
}

