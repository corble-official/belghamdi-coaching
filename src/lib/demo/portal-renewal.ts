/**
 * Demo-mode simulated renewal hub data (Task 9).
 *
 * In-memory only — module/globalThis-pinned stores living as long as the
 * dev server. ZERO Supabase/network by design (isDemoMode() guards every
 * caller). Every row is flagged `demo: true` so demo data stays
 * distinguishable from real client data (house rule from src/lib/demo/admin-store.ts).
 *
 * Demo prices are DEMO PLACEHOLDERS (see CLIENT_DATA.md) — they exist so the
 * demo hub renders like the live one, never as real product pricing.
 */
import { cookies } from "next/headers";

import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import type {
  RenewalEventView,
  RenewalOrderView,
  RenewalRequestView,
} from "@/lib/renewal";

/** Demo subscription row — status/dates match the demo portal context
 *  (active, end 2099-12-31) so the hub card agrees with the shell banner. */
export const DEMO_SUBSCRIPTION = {
  package_id: "silver",
  subscription_code: "DEMO-SUB-0001",
  start_date: "2026-01-01",
} as const;

const seedEvents: RenewalEventView[] = [
  {
    id: "demo-sev-1",
    event_type: "payment_verified",
    source: "shopify",
    occurred_at: "2026-01-01T09:00:00.000Z",
    payload_reference: "SO-DEMO-2026-0001",
    demo: true,
  },
  {
    id: "demo-sev-2",
    event_type: "activated",
    source: "system",
    occurred_at: "2026-01-01T09:05:00.000Z",
    payload_reference: "SO-DEMO-2026-0001",
    demo: true,
  },
  {
    id: "demo-sev-3",
    event_type: "payment_verified",
    source: "shopify",
    occurred_at: "2026-09-15T10:24:00.000Z",
    payload_reference: "SO-DEMO-2026-0002",
    demo: true,
  },
  {
    id: "demo-sev-4",
    event_type: "renewed",
    source: "system",
    occurred_at: "2026-09-15T10:25:00.000Z",
    payload_reference: "SO-DEMO-2026-0002",
    demo: true,
  },
];

const seedOrders: RenewalOrderView[] = [
  {
    id: "demo-order-1",
    event_type: "order.paid",
    order_ref: "SO-DEMO-2026-0002",
    status: "processed",
    created_at: "2026-09-15T10:24:00.000Z",
    total: 89,
    currency: "EGP",
    product: "Silver Coaching",
    package_id: "silver",
    kind: "renewal",
    demo: true,
  },
  {
    id: "demo-order-2",
    event_type: "order.paid",
    order_ref: "SO-DEMO-2026-0001",
    status: "processed",
    created_at: "2026-01-01T09:00:00.000Z",
    total: 89,
    currency: "EGP",
    product: "Silver Coaching",
    package_id: "silver",
    kind: "new",
    demo: true,
  },
];

/** Simulated lifecycle events (newest first). Static seed — the portal can
 *  never mutate entitlement state, so there is nothing to append here. */
export function demoRenewalEvents(): RenewalEventView[] {
  return seedEvents.map((e) => ({ ...e }));
}

/** Simulated own orders (newest first). */
export function demoRenewalOrders(): RenewalOrderView[] {
  return seedOrders.map((o) => ({ ...o }));
}

/* ------------------------------------------------------------------ *
 * Renewal REQUEST ledger — in-memory, per demo session cookie.
 * Next dev compiles route handlers and pages into separate module
 * registries; pinning on globalThis keeps a POST visible to a later GET
 * in one process while isolating visitors (same pattern as portal-checkins).
 * ------------------------------------------------------------------ */

declare global {
  // eslint-disable-next-line no-var
  var __bc_portal_renewals_v1: Record<string, RenewalRequestView[]> | undefined;
}

const stores = (globalThis.__bc_portal_renewals_v1 ??= {});

function currentDemoKey(): string {
  try {
    const value = cookies().get(DEMO_SESSION_COOKIE)?.value;
    return value && value !== "1" ? value : "anonymous";
  } catch {
    // No request context (e.g. build-time prerender) — shared bucket is fine there.
    return "anonymous";
  }
}

function stateFor(): RenewalRequestView[] {
  const key = currentDemoKey();
  return (stores[key] ??= []);
}

/** Renewal requests recorded this server life, newest first. */
export function listDemoRenewalRequests(): RenewalRequestView[] {
  return stateFor().map((r) => ({ ...r }));
}

/** Record a portal renewal REQUEST (intent only — never a subscription event). */
export function recordDemoRenewalRequest(input: {
  order_ref: string;
  package_pref: string | null;
}): RenewalRequestView {
  const row: RenewalRequestView = {
    id: `demo-renewal-${Date.now()}-${stateFor().length + 1}`,
    order_ref: input.order_ref,
    package_pref: input.package_pref,
    requested_at: new Date().toISOString(),
    demo: true,
  };
  stateFor().unshift(row);
  if (stateFor().length > 20) stateFor().length = 20;
  return { ...row };
}
