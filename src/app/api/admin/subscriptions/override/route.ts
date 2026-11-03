import { NextResponse, type NextRequest } from "next/server";

import type { OverrideRequestBody } from "@/lib/admin/types";
import { OVERRIDE_ACTIONS } from "@/lib/admin/types";
import { assertStaff, canAccessClient, scopeDenied } from "@/lib/supabase/admin-context";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";
import {
  resolveLifecycle,
  type LifecycleResult,
} from "@/lib/supabase/lifecycle";
import type { SubscriptionEvent, SubscriptionState } from "@/lib/supabase/entitlements";
import { demoOverrideOutbox, demoOverrideSimulate, demoRequestOverride } from "@/lib/demo/admin-crm";

/**
 * POST /api/admin/subscriptions/override
 *
 * Role re-check is SERVER-side (assertStaff): non-admin POSTs → 403.
 * Coach may draft an override REQUEST only (action='request_override') —
 * it writes a `notifications` row (kind 'override_request',
 * audience_role='admin') through this validated route's service client,
 * because no authenticated INSERT policy exists on `notifications` by
 * design (unfiltered notification writes would be spoofable).
 * coach_assistant → 403 for every action (inherit VIEW access only).
 *
 * Admin verbs (activate|suspend|extend|revoke), LIVE path:
 *   1. `subscription_events` row  — event_type manual_*, source 'admin',
 *      occurred_at now, payload_reference typed, event_id minted
 *      (`admin-<client>-<ts>`) because the generated idempotency_key
 *      (`coalesce(event_id,'n/a')||':'||event_type`) is UNIQUE and two
 *      identical manual verbs would otherwise collide.
 *   2. `client_subscriptions` status/end_date updated via service.
 *      revoke maps to status 'suspended' per the Task-1 lifecycle contract
 *      (no dedicated revoked DB vocabulary yet; access is revoked via
 *      computeEntitlements/deriveAccess semantics documented in the report).
 *   3. `notifications` row (kind 'override', audience_role 'admin').
 *
 * DEMO: simulated + in-memory outbox record, never network.
 */

const VERB_TO_EVENT: Record<
  Exclude<OverrideRequestBody["action"], "request_override">,
  SubscriptionEvent
> = {
  activate: "manual_activated",
  suspend: "manual_suspended",
  extend: "manual_extended",
  revoke: "manual_revoked",
};

const addDays = (dateStr: string, days: number): string => {
  const base = /\d{4}-\d{2}-\d{2}/.test(dateStr) ? new Date(dateStr) : new Date();
  // never extend backwards: base at today when the current end has passed
  const today = new Date();
  const from = base.getTime() < today.getTime() ? today : base;
  from.setUTCDate(from.getUTCDate() + days);
  return from.toISOString().slice(0, 10);
};

export async function POST(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  let body: OverrideRequestBody | null = null;
  try {
    body = (await req.json()) as OverrideRequestBody;
  } catch {
    body = null;
  }

  if (
    !body ||
    typeof body.client_id !== "string" ||
    /^[0-9a-fA-F-]{36}$/.test(body.client_id) === false
  ) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const action = body.action;
  const isVerb = (OVERRIDE_ACTIONS as string[]).includes(action as string);
  const isRequest = action === "request_override";

  // ---- Role matrix ----
  if (!isVerb && !isRequest) {
    return NextResponse.json(
      { ok: false, error: "bad_action" },
      { status: 400 }
    );
  }
  if (isVerb && ctx.role !== "admin") {
    // coach + coach_assistant: VIEW-ONLY for subscription status.
    console.warn("[admin/override] non-admin verb attempted", {
      role: ctx.role,
      demo: ctx.demo,
    });
    return NextResponse.json(
      { ok: false, error: "forbidden", role: ctx.role },
      { status: 403 }
    );
  }
  if (isRequest && ctx.role !== "coach") {
    return NextResponse.json(
      { ok: false, error: "forbidden", role: ctx.role },
      { status: 403 }
    );
  }

  const payload = body.payload ?? {};
  const reasonTrimmed =
    typeof payload.reason === "string" ? payload.reason.slice(0, 500) : undefined;
  const requestedAction =
    payload.requested_action &&
    (OVERRIDE_ACTIONS as string[]).includes(payload.requested_action)
      ? payload.requested_action
      : "extend";

  // Scope first for non-admins (admin is unbounded): a coach may only ask for
  // an override on a client they are actually assigned to.
  if (!canAccessClient(ctx, body.client_id)) return scopeDenied();

  // ---- DEMO simulation (outbox record only, never network) ----
  if (ctx.demo) {
    if (isRequest) {
      const notification = demoRequestOverride({
        client_id: body.client_id,
        client_name: "Demo client",
        payload: { ...payload },
      });
      return NextResponse.json({
        ok: true,
        simulated: true,
        kind: "override_request",
        notification,
      });
    }
    const { event, notification } = demoOverrideSimulate({
      client_id: body.client_id,
      client_name: "Demo client",
      action: action as Exclude<OverrideRequestBody["action"], "request_override">,
      payload: { ...payload },
    });
    return NextResponse.json({
      ok: true,
      simulated: true,
      event,
      notification,
      outbox_size: demoOverrideOutbox().length,
    });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  const subRes = await service
    .from("client_subscriptions")
    .select("id, client_id, subscription_code, status, start_date, end_date")
    .eq("client_id", body.client_id)
    .order("start_date", { ascending: false })
    .limit(1);
  const sub = (subRes.data?.[0] ?? null) as
    | {
        id: string;
        client_id: string;
        subscription_code: string;
        status: string;
        start_date: string;
        end_date: string;
      }
    | null;

  if (isRequest) {
    // Coach request path (live): notifications-only write via service.
    const notifRes = await service
      ?.from("notifications")
      .insert({
        audience_role: "admin",
        client_id: body.client_id,
        kind: "override_request",
        title: "Coach requested an override",
        body: reasonTrimmed ?? null,
        metadata: {
          requested_action: requestedAction,
          extend_days: payload.extend_days ?? null,
          via: "admin_dashboard",
          requested_by_role: ctx.role,
          profile_id: ctx.profileId,
        },
      });
    if (notifRes?.error) {
      console.error(
        "[admin/override] request notification write failed",
        notifRes.error.message
      );
      return NextResponse.json(
        { ok: false, error: "db_write_failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, kind: "override_request" });
  }

  if (!sub) {
    return NextResponse.json(
      { ok: false, error: "no_subscription" },
      { status: 404 }
    );
  }

  const eventType = VERB_TO_EVENT[action as Exclude<
    OverrideRequestBody["action"],
    "request_override"
  >];

  const current: SubscriptionState = {
    status: sub.status as SubscriptionState["status"],
    start_date: sub.start_date,
    end_date: sub.end_date,
  };

  let nextEndDate = sub.end_date;
  if (eventType === "manual_extended") {
    nextEndDate = addDays(
      sub.end_date,
      Math.min(Math.max(Number(payload.extend_days ?? 30), 1), 365)
    );
  }

  const resolved: LifecycleResult = resolveLifecycle(eventType, {
    start_date: sub.start_date,
    end_date: nextEndDate,
    today: new Date(),
  });

  const occurredAt = new Date().toISOString();
  const payloadReference = JSON.stringify({
    verb: action,
    ...payload,
    subscription_id: sub.id,
    subscription_code: sub.subscription_code,
    status_from: sub.status,
    status_to: resolved.status,
    end_date_from: sub.end_date,
    end_date_to: nextEndDate,
    via: "admin_dashboard",
    role: ctx.role,
    profile_id: ctx.profileId,
  });

  const eventRes = await service.from("subscription_events").insert({
    client_id: body.client_id,
    event_id: `admin-${body.client_id}-${Date.now()}`,
    event_type: eventType,
    source: "admin",
    occurred_at: occurredAt,
    payload_reference: payloadReference,
  });
  if (eventRes.error) {
    console.error(
      "[admin/override] subscription_events write failed",
      eventRes.error.message
    );
    return NextResponse.json(
      { ok: false, error: "db_write_failed" },
      { status: 502 }
    );
  }

  const subUpdateRes = await service
    .from("client_subscriptions")
    .update({ status: resolved.status, end_date: nextEndDate })
    .eq("id", sub.id);
  if (subUpdateRes.error) {
    console.error(
      "[admin/override] client_subscriptions update failed",
      subUpdateRes.error.message
    );
    return NextResponse.json(
      { ok: false, error: "db_write_failed" },
      { status: 502 }
    );
  }

  const notifRes = await service.from("notifications").insert({
    audience_role: "admin",
    client_id: body.client_id,
    kind: "override",
    title: `Manual override — ${action}`,
    body:
      reasonTrimmed ??
      `Subscription ${sub.subscription_code}: ${sub.status} → ${resolved.status}.`,
    metadata: { verb: action, via: "admin_dashboard" },
  });
  if (notifRes?.error) {
    // The override already landed; the notification failure is degraded UX,
    // not a rollback trigger — logged, surfaced, non-fatal.
    console.error(
      "[admin/override] notification write failed",
      notifRes.error?.message
    );
  }

  return NextResponse.json({
    ok: true,
    simulated: false,
    subscription_id: sub.id,
    status: resolved.status,
    end_date: nextEndDate,
    access: resolved.access,
    event_type: eventType,
  });
}
