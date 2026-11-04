/**
 * Shared types for the portal renewal hub (Task 9).
 * Pure module — no imports, no side effects. Used by the server data layer,
 * the demo store and the client components (same house pattern as `@/lib/checkins`).
 */

export type RenewalSubscriptionView = {
  package_id: string | null;
  subscription_code: string | null;
  status: string;
  start_date: string;
  end_date: string;
};

export type RenewalEventView = {
  id: string;
  event_type: string;
  source: string;
  occurred_at: string;
  payload_reference: string | null;
  demo?: boolean;
};

export type RenewalOrderView = {
  id: string;
  event_type: string;
  order_ref: string | null;
  status: string;
  created_at: string;
  total: number | null;
  currency: string;
  product: string | null;
  package_id: string | null;
  kind: string | null;
  demo?: boolean;
};

export type RenewalRequestView = {
  id: string;
  order_ref: string | null;
  package_pref: string | null;
  requested_at: string;
  demo?: boolean;
};

/** Payload fields we read out of `integration_events.payload` (jsonb). */
export type IntegrationEventPayload = Record<string, unknown> & {
  client_id?: unknown;
  email?: unknown;
  package_id?: unknown;
  package_pref?: unknown;
  product_title?: unknown;
  product_name?: unknown;
  package_name?: unknown;
  total?: unknown;
  currency?: unknown;
  kind?: unknown;
  order_id?: unknown;
  requested_at?: unknown;
};

const CURRENCY_RE = /^[A-Za-z]{3}$/;

/** Bounded money-shape coercion; anything unknown degrades to null total. */
export function parseOrderMoney(
  payload: IntegrationEventPayload
): { total: number | null; currency: string } {
  const rawTotal = payload.total;
  const total =
    typeof rawTotal === "number" && Number.isFinite(rawTotal)
      ? rawTotal
      : typeof rawTotal === "string"
        ? (() => {
            const n = Number(rawTotal);
            return Number.isFinite(n) ? n : null;
          })()
        : null;
  const rawCurrency =
    typeof payload.currency === "string" && CURRENCY_RE.test(payload.currency.trim())
      ? payload.currency.trim().toUpperCase()
      : "EGP";
  return { total, currency: rawCurrency };
}

export function parseOrderProduct(
  payload: IntegrationEventPayload
): string | null {
  for (const key of ["product_title", "product_name", "package_name"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 140);
  }
  const pkg = payload.package_id;
  if (typeof pkg === "string" && pkg.trim()) return pkg.trim().slice(0, 60);
  return null;
}
