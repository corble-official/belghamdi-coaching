import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/mode";
import { getPortalContext } from "@/lib/supabase/portal-context";
import { getOwnRenewalData, recordDemoRenewalRequest } from "@/lib/supabase/portal-renewal";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";
import { deliver } from "@/lib/integrations/n8n-client";
import type { Bc06TaskUpsert, DeliveryRecord } from "@/lib/integrations/contracts";

/**
 * Portal renewal hub — `/api/portal/renewal` (Task 9, REQUEST ONLY).
 *
 * GET  → own subscription (JWT, RLS `can_access_client`) + own
 *        `subscription_events` timeline (JWT) + own orders (service read,
 *        pinned filters — see below) + own renewal-request history.
 *
 * POST → records ONE renewal REQUEST. Body: `{ package_pref?: "silver"|"gold" }`.
 *
 * Hard rules (binding):
 *  - POST NEVER activates/extends/restores a subscription and NEVER writes
 *    `client_subscriptions`, NEVER appends entitlement-affecting
 *    `subscription_events` rows. Only a verified Shopify payment event
 *    (BC-03/BC-07 → process_order_event/process_renewal_event) changes
 *    entitlements. This route records intent and notifies the coach.
 *  - `integration_events` is service-only (RLS zero policies), so the route
 *    is auth-checked FIRST and the service client is used ONLY for:
 *      GET: rows whose `payload.client_id` (or `payload.email`) equals the
 *           SESSION linkage, pinned to order-ish event types (orders) and to
 *           `portal_renewal_requested` + `provider='web'` (requests).
 *      POST: the intent-row insert + the one `clients.client_code` lookup.
 *    Never caller input; foreign rows are unmatchable. (Orders-read
 *    adjudication, task-9 brief decision #5 — documented in the report.)
 *  - The request record is an `integration_events` row
 *    `event_type='portal_renewal_requested', provider='web'`,
 *    `order_ref=<client_code>-<ts>`, `payload={client_id, package_pref,
 *    requested_at}` — a RECORD of intent, not a subscription event.
 *  - BC-07's ONLY webhook semantics is `process_renewal_event` = subscription
 *    extension on `order_verified` (n8n README: "Extends the subscription
 *    end date"; contracts.ts `Bc07RenewalEvent` requires a payment-shaped
 *    payload). Firing it from an unpaid click would hand every portal user a
 *    self-service extension — refused by the no-activation binding. The
 *    renewal COMMUNICATION instead reuses the SAME signed `deliver()` path
 *    with BC-06 (`action=upsert, category='renewal'` → coach follow-up
 *    task), the existing non-activating notification channel. No new webhook,
 *    no workflow changes, no second delivery path.
 *  - Demo mode: ZERO network — `deliver()` is never called; a synthetic
 *    `skipped` DeliveryRecord is returned for the client-side outbox seam.
 */

const MAX_BODY_BYTES = 8 * 1024;
const PACKAGE_PREFS = new Set(["silver", "gold"]);

const str = (v: unknown, max = 60): string =>
  v === undefined || v === null ? "" : String(v).trim().slice(0, max);

const isoDay = (): string => new Date().toISOString().slice(0, 10);
const slugRef = (code: string): string =>
  code.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 40) || "client";

/* ------------------------------------------------------------------ GET */

export async function GET() {
  const ctx = await getPortalContext();

  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getOwnRenewalData(ctx);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}

/* ----------------------------------------------------------------- POST */

export async function POST(req: Request) {
  // Buffering cap first — never read an oversized body (Task 8 fix pattern).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prefRaw = str(body.package_pref, 20).toLowerCase();
  if (prefRaw && !PACKAGE_PREFS.has(prefRaw)) {
    return NextResponse.json({ error: "bad_package_pref" }, { status: 400 });
  }
  const packagePref = prefRaw || null;
  const requestedAt = new Date().toISOString();

  /* ------------------------------ DEMO ------------------------------
   * Zero network: no service client, no deliver(), no DB. The request is
   * recorded in the server life's in-memory demo ledger (flagged demo:true)
   * and a synthetic `skipped` delivery is returned for the client outbox. */
  if (isDemoMode()) {
    const orderRef = `DEMO-${Date.now()}`;
    const saved = recordDemoRenewalRequest({ order_ref: orderRef, package_pref: packagePref });
    const delivery: DeliveryRecord = {
      id: orderRef,
      endpoint: "bc06_task",
      eventType: "renewal",
      eventRef: orderRef,
      payload: { action: "upsert", category: "renewal", package_pref: packagePref },
      status: "skipped",
      attempts: 0,
      createdAt: requestedAt,
      response: { status: 0, body: "demo mode — recorded locally, no network" },
    };
    return NextResponse.json({
      ok: true,
      state: "requested",
      demo: true,
      package_pref: packagePref,
      order_ref: orderRef,
      renewal_request: saved,
      delivery,
    });
  }

  // Narrowing only (anonymous + demo handled above).
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  // client_code for a human-meaningful order_ref; falls back to the uuid.
  const codeRes = await service
    .from("clients")
    .select("client_code")
    .eq("id", clientId)
    .maybeSingle();
  const clientCode =
    (codeRes.data as { client_code?: string } | null)?.client_code ||
    `client-${clientId.slice(0, 8)}`;

  const orderRef = `${clientCode}-${Date.now()}`;

  /* ---- 1) RECORD of intent (service path; never a subscription event) ---- */
  const insertRes = await service.from("integration_events").insert({
    event_type: "portal_renewal_requested",
    provider: "web",
    order_ref: orderRef,
    status: "pending",
    payload: {
      client_id: clientId,
      package_pref: packagePref,
      requested_at: requestedAt,
    },
  });
  if (insertRes.error) {
    console.error(
      "[portal/renewal] intent insert failed",
      insertRes.error.message
    );
    return NextResponse.json(
      { ok: false, error: "db_write_failed" },
      { status: 502 }
    );
  }

  /* ---- 2) COMMUNICATION via the shared signed deliver() path ----
   * BC-06 follow-up task (category "renewal") — the existing, non-activating
   * notification channel. source_id is stable per client+day so repeat
   * clicks upsert one coach task instead of spamming. BC-07 is deliberately
   * NOT fired: its only webhook semantics extends the subscription
   * (process_renewal_event) on a payment-shaped payload, which an unpaid
   * request must never reach. */
  const bc06: Bc06TaskUpsert = {
    action: "upsert",
    source_type: "website",
    source_id: `portal-renewal-${slugRef(clientCode)}-${isoDay()}`,
    client_code: slugRef(clientCode),
    category: "renewal",
    priority: "medium",
    reason: "Portal renewal request",
  };
  const record = await deliver("bc06_task", { refId: bc06.source_id, body: bc06 });

  return NextResponse.json({
    ok: true,
    state: "requested",
    demo: false,
    package_pref: packagePref,
    order_ref: orderRef,
    renewal_request: {
      id: orderRef,
      order_ref: orderRef,
      package_pref: packagePref,
      requested_at: requestedAt,
    },
    delivery: {
      id: record.id,
      status: record.status,
      attempts: record.attempts,
      endpoint: record.endpoint,
      error: record.error,
      response: record.response,
    },
  });
}
