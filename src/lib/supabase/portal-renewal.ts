import "server-only";

import { isDemoMode } from "@/lib/mode";
import {
  demoRenewalEvents,
  demoRenewalOrders,
  listDemoRenewalRequests,
  recordDemoRenewalRequest,
  DEMO_SUBSCRIPTION,
} from "@/lib/demo/portal-renewal";
import {
  parseOrderMoney,
  parseOrderProduct,
  type IntegrationEventPayload,
  type RenewalEventView,
  type RenewalOrderView,
  type RenewalRequestView,
  type RenewalSubscriptionView,
} from "@/lib/renewal";
import type { PortalContext } from "./portal-context";
import { createPortalClient } from "./supabase-auth";
import { tryCreateServiceClient } from "./supabase-service";

/**
 * Renewal-hub data access for the CLIENT portal (Task 9).
 *
 * Hard rules (binding):
 *  - Subscription + `subscription_events` reads run through the USER-JWT
 *    client (`createPortalClient()`) so RLS `can_access_client` is the
 *    backstop. `.eq("client_id", <session id>)` is always applied.
 *  - `integration_events` is SERVICE-ONLY (RLS with zero policies — see
 *    migration 001). This module therefore performs route-adjacent,
 *    SERVER-SIDE-PINNED service reads: auth first (this function only runs
 *    after getPortalContext() resolved the session), then the service client
 *    selects ONLY rows whose `payload.client_id` (or `payload.email`) equals
 *    the SESSION-derived linkage — never caller input. The orders read is
 *    pinned to order-ish event types; the requests read is pinned to
 *    `event_type='portal_renewal_requested'` AND `provider='web'`. Foreign
 *    rows are unmatchable. Documented adjudication (task-9 brief decision #5).
 *  - Demo mode returns simulated rows BEFORE any Supabase construction
 *    (zero network), mirroring portal-checkins.ts.
 *  - Nothing in this module writes to `client_subscriptions` or
 *    `subscription_events`. Ever. Renewal-request intent lands in
 *    `integration_events` only (see api/portal/renewal/route.ts).
 */

export type RenewalData = {
  demo: boolean;
  subscription: RenewalSubscriptionView | null;
  events: RenewalEventView[];
  orders: RenewalOrderView[];
  /** True when the service-client orders/requests read failed (degraded, not fatal). */
  orders_error: boolean;
  renewal_requests: RenewalRequestView[];
};

export type RenewalDataResult =
  | { ok: true; data: RenewalData }
  | { ok: false; demo: boolean };

const strOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** Same email arm the admin drawer uses; the regex keeps untrusted input out
 *  of the PostgREST `.or()` grammar. Both arms derive from the SESSION. */
const emailArm = (email: string | undefined): string | null => {
  const value = (email ?? "").trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)
    ? `payload->>email.eq.${value}`
    : null;
};

const unknownStr = (value: unknown): string =>
  typeof value === "string" ? value : "";

const ORDER_EVENT_TYPES = [
  "order.paid",
  "order.cancelled",
  "order_verified",
  "subscription.renewed",
] as const;

export async function getOwnRenewalData(
  ctx: PortalContext
): Promise<RenewalDataResult> {
  /* ---- Demo: simulated rows, zero Supabase ---- */
  if (isDemoMode()) {
    return {
      ok: true,
      data: {
        demo: true,
        subscription: {
          package_id: DEMO_SUBSCRIPTION.package_id,
          subscription_code: DEMO_SUBSCRIPTION.subscription_code,
          status: ctx.demo ? ctx.subscription.status : "active",
          start_date: DEMO_SUBSCRIPTION.start_date,
          end_date: ctx.demo ? ctx.subscription.end_date : "2099-12-31",
        },
        events: demoRenewalEvents(),
        orders: demoRenewalOrders(),
        orders_error: false,
        renewal_requests: listDemoRenewalRequests(),
      },
    };
  }

  if (ctx.demo || !ctx.authed) return { ok: false, demo: false };

  const clientId = ctx.client.id;
  if (!clientId) {
    // Authenticated but no linked client record — nothing to show.
    return {
      ok: true,
      data: {
        demo: false,
        subscription: null,
        events: [],
        orders: [],
        orders_error: false,
        renewal_requests: [],
      },
    };
  }

  const supabase = await createPortalClient();

  /* ---- Own subscription (JWT, RLS can_access_client) ---- */
  const subRes = await supabase
    .from("client_subscriptions")
    .select(
      "subscription_code, package_id, status, start_date, end_date, created_from_event"
    )
    .eq("client_id", clientId)
    .order("start_date", { ascending: false })
    .limit(1);

  if (subRes.error) {
    console.error(
      "[portal/renewal] subscription read failed",
      subRes.error.message
    );
    return { ok: false, demo: false };
  }

  const subRow = (subRes.data?.[0] ?? null) as Record<string, unknown> | null;
  const subscription: RenewalSubscriptionView | null = subRow
    ? {
        package_id: strOrNull(subRow.package_id),
        subscription_code: strOrNull(subRow.subscription_code),
        status: unknownStr(subRow.status) || "pending",
        start_date: unknownStr(subRow.start_date),
        end_date: unknownStr(subRow.end_date),
      }
    : null;

  /* ---- Lifecycle timeline (JWT, RLS can_access_client) ---- */
  const eventsRes = await supabase
    .from("subscription_events")
    .select(
      "id, event_type, source, occurred_at, payload_reference"
    )
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false })
    .limit(20);

  if (eventsRes.error) {
    console.error(
      "[portal/renewal] subscription_events read failed",
      eventsRes.error.message
    );
    return { ok: false, demo: false };
  }

  const events: RenewalEventView[] = (
    (eventsRes.data ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    id: unknownStr(row.id),
    event_type: unknownStr(row.event_type),
    source: unknownStr(row.source) || "system",
    occurred_at: unknownStr(row.occurred_at),
    payload_reference: strOrNull(row.payload_reference),
  }));

  /* ---- Own orders + renewal requests (service read, pinned filters) ---- */
  const service = tryCreateServiceClient();
  let orders: RenewalOrderView[] = [];
  let renewal_requests: RenewalRequestView[] = [];
  let orders_error = false;

  if (!service) {
    // Adjudication: service env missing → orders/requests unavailable,
    // degraded (flagged) rather than failing the whole hub. POST hard-fails
    // 503 in the same situation (the request record is mandatory there).
    return {
      ok: true,
      data: { demo: false, subscription, events, orders: [], orders_error: true, renewal_requests: [] },
    };
  }

  const idArm = `payload->>client_id.eq.${clientId}`;
  const email = emailArm(ctx.profile.email);
  const linkage = email ? `${idArm},${email}` : idArm;

  const ordersRes = await service
    .from("integration_events")
    .select("id, event_type, order_ref, status, created_at, payload")
    .or(linkage)
    .in("event_type", [...ORDER_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(20);

  const requestsRes = await service
    .from("integration_events")
    .select("id, order_ref, status, created_at, payload")
    .eq("event_type", "portal_renewal_requested")
    .eq("provider", "web")
    .or(linkage)
    .order("created_at", { ascending: false })
    .limit(10);

  if (ordersRes.error || requestsRes.error) {
    console.error(
      "[portal/renewal] ledger read failed",
      ordersRes.error?.message ?? requestsRes.error?.message ?? ""
    );
    orders_error = true;
  }

  if (!ordersRes.error) {
    orders = ((ordersRes.data ?? []) as Record<string, unknown>[]).map(
      (row) => {
        const payload = (row.payload ?? {}) as IntegrationEventPayload;
        const { total, currency } = parseOrderMoney(payload);
        return {
          id: unknownStr(row.id),
          event_type: unknownStr(row.event_type),
          order_ref: strOrNull(row.order_ref),
          status: unknownStr(row.status) || "unknown",
          created_at: unknownStr(row.created_at),
          total,
          currency,
          product: parseOrderProduct(payload),
          package_id: strOrNull(payload.package_id),
          kind: strOrNull(payload.kind),
        };
      }
    );
  }

  if (!requestsRes.error) {
    renewal_requests = (
      (requestsRes.data ?? []) as Record<string, unknown>[]
    ).map((row) => {
      const payload = (row.payload ?? {}) as IntegrationEventPayload;
      return {
        id: unknownStr(row.id),
        order_ref: strOrNull(row.order_ref),
        package_pref: strOrNull(payload.package_pref),
        requested_at:
          strOrNull(payload.requested_at) ?? unknownStr(row.created_at),
      };
    });
  }

  return {
    ok: true,
    data: { demo: false, subscription, events, orders, orders_error, renewal_requests },
  };
}

export type { RenewalRequestView };
export { recordDemoRenewalRequest };
