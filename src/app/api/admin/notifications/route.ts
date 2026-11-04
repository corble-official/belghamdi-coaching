import { NextResponse, type NextRequest } from "next/server";

import {
  demoMarkNotificationRead,
  demoNotifications,
  demoSalesNotifications,
} from "@/lib/demo/admin-crm";
import { assertStaff } from "@/lib/supabase/admin-context";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";

/**
 * /api/admin/notifications (Task 10)
 *
 * GET   — staff-gated. Admin sees ALL rows + the admin-only
 *         `sales_notifications` list; coach/assistant get only rows with
 *         audience_role in ('coach','coach_assistant') (mirrors
 *         bc_notifications_select_staff). Demo: demo rows, zero network.
 * POST  — ADMIN-ONLY create { kind, title, body?, metadata?, dedupe_key?,
 *         audience_role? } via the service client (no authenticated INSERT
 *         policy exists on `notifications` by design — unfiltered writes
 *         would be spoofable). Consumed later by Task 2.5 provisioning.
 *         Demo: no-op returning a synthetic id.
 * PATCH — mark-read { id } → service-client UPDATE notifications.read=true
 *         WHERE id. Role re-check FIRST: admin → any row; coach/assistant
 *         → only rows inside their audience scope. The table has NO RLS
 *         update policy, so this service write after the route-level
 *         scope check is the adjudicated binding.
 *
 * Error shapes copied from the Task 7 routes: 503 {error:"db_down"},
 * 502 {error:"db_read_failed"|"db_write_failed"}, 403 {error:"forbidden"}.
 */

type PortalRow = {
  id: string;
  audience_role: string;
  client_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  dedupe_key: string | null;
  created_at: string;
  read: boolean;
};

type SalesRow = {
  id: string;
  lead_id: string | null;
  qualified: boolean;
  handoff: boolean;
  success: boolean;
  error: string | null;
  created_at: string;
};

const AUDIENCE_ROLES = ["admin", "coach", "coach_assistant"] as const;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET() {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  const isAdmin = ctx.role === "admin";

  // ---- Demo: in-memory rows, zero network ----
  if (ctx.demo) {
    return NextResponse.json({
      ok: true,
      demo: true,
      role: ctx.role,
      portal: demoNotifications(),
      sales: isAdmin ? demoSalesNotifications() : [],
    });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  const portalQuery = service
    .from("notifications")
    .select(
      "id, audience_role, client_id, kind, title, body, metadata, dedupe_key, read, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  // Coach/assistant scope mirrors the RLS SELECT policy (admin unbounded).
  if (!isAdmin) portalQuery.in("audience_role", ["coach", "coach_assistant"]);

  const [portalRes, salesRes] = await Promise.all([
    portalQuery,
    isAdmin
      ? service
          .from("sales_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (portalRes.error || salesRes.error) {
    console.error(
      "[admin/notifications] read failed",
      portalRes.error?.message ?? "",
      salesRes.error?.message ?? ""
    );
    return NextResponse.json(
      { ok: false, error: "db_read_failed" },
      { status: 502 }
    );
  }

  const portal = ((portalRes.data ?? []) as Record<string, unknown>[]).map(
    (r): PortalRow => ({
      id: String(r.id),
      audience_role: String(r.audience_role),
      client_id: typeof r.client_id === "string" ? r.client_id : null,
      kind: String(r.kind),
      title: String(r.title),
      body: typeof r.body === "string" ? r.body : null,
      metadata:
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : null,
      dedupe_key: typeof r.dedupe_key === "string" ? r.dedupe_key : null,
      created_at: String(r.created_at),
      read: r.read === true,
    })
  );

  const sales = isAdmin
    ? ((salesRes.data ?? []) as Record<string, unknown>[]).map(
        (r): SalesRow => ({
          id: String(r.id),
          lead_id: typeof r.lead_id === "string" ? r.lead_id : null,
          qualified: r.qualified === true,
          handoff: r.handoff === true,
          success: r.success === true,
          error: typeof r.error === "string" ? r.error : null,
          created_at: String(r.created_at),
        })
      )
    : [];

  return NextResponse.json({
    ok: true,
    demo: false,
    role: ctx.role,
    portal,
    sales,
  });
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

export async function POST(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  // Admin-only write surface (coach/assistant cannot create notifications).
  if (ctx.role !== "admin") {
    console.warn("[admin/notifications] non-admin POST attempted", {
      role: ctx.role,
      demo: ctx.demo,
    });
    return NextResponse.json(
      { ok: false, error: "forbidden", role: ctx.role },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  const kind = str(body?.kind)?.trim();
  const title = str(body?.title)?.trim();
  if (!kind || !title) {
    return NextResponse.json(
      { ok: false, error: "bad_body" },
      { status: 400 }
    );
  }
  const audience = str(body?.audience_role) ?? "admin";
  if (!(AUDIENCE_ROLES as readonly string[]).includes(audience)) {
    return NextResponse.json(
      { ok: false, error: "bad_audience" },
      { status: 400 }
    );
  }

  const insert = {
    audience_role: audience,
    client_id: null,
    kind: kind.slice(0, 100),
    title: title.slice(0, 300),
    body: str(body?.body)?.slice(0, 2000) ?? null,
    metadata:
      body?.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : {},
    dedupe_key: str(body?.dedupe_key)?.slice(0, 200) ?? null,
  };

  // ---- Demo: no-op, synthetic id (Task 2.5 will consume the live path) ----
  if (ctx.demo) {
    return NextResponse.json({
      ok: true,
      demo: true,
      simulated: true,
      id: `demo-notif-${Date.now()}`,
    });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  const res = await service
    .from("notifications")
    .insert(insert)
    .select("id")
    .single();
  if (res.error) {
    console.error(
      "[admin/notifications] insert failed",
      res.error.message
    );
    return NextResponse.json(
      { ok: false, error: "db_write_failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    demo: false,
    id: (res.data as { id: string } | null)?.id ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  let body: { id?: unknown } | null = null;
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    body = null;
  }
  const id = str(body?.id);
  if (!id) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  // ---- Demo: in-memory toggle (read=true only), zero network ----
  // (Demo ids are not uuids — mirrors the resolutions route, which checks
  // the uuid shape only on the live path.)
  if (ctx.demo) {
    demoMarkNotificationRead(id);
    return NextResponse.json({ ok: true, demo: true });
  }

  // Mirror the resolutions route: reject non-uuid ids cleanly before any
  // service use (the column is uuid — a raw Postgres cast error would
  // surface as a misleading 502 instead of a caller mistake).
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  // Role re-check FIRST — the scope filter is fixed BEFORE the write:
  // admin → any row; coach/assistant → only their audience rows.
  const upd = service.from("notifications").update({ read: true }).eq("id", id);
  if (ctx.role !== "admin") {
    upd.in("audience_role", ["coach", "coach_assistant"]);
  }
  const res = await upd.select("id");

  if (res.error) {
    console.error("[admin/notifications] mark-read failed", res.error.message);
    return NextResponse.json(
      { ok: false, error: "db_write_failed" },
      { status: 502 }
    );
  }
  // Zero updated rows → unknown id OR out-of-scope id: 404 so scoped
  // callers cannot probe the existence of foreign notifications.
  if (!res.data || res.data.length === 0) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, demo: false });
}
