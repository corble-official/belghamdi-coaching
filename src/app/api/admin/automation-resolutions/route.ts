import { NextResponse, type NextRequest } from "next/server";

import { demoErrorResolutions, demoResolveError } from "@/lib/demo/admin-crm";
import { assertStaff } from "@/lib/supabase/admin-context";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";

/**
 * /api/admin/automation-resolutions (Task 10) — the ONLY app-facing write
 * path around automation errors.
 *
 * POST { error_id, resolution_note } — ADMIN-ONLY (route-level re-check
 * after assertStaff), note REQUIRED (400 otherwise). Inserts into
 * `automation_error_resolutions` via the SERVICE client; `resolved_by`
 * carries the JWT profile id when available (null for legacy-cookie
 * admins — column is nullable). Demo: appends to the in-memory demo
 * ledger, zero network.
 *
 * HARD BINDING: there is deliberately NO route here (or anywhere in the
 * app) that mutates `automation_errors` — its status/resolved_at are
 * owned by the BC-99 n8n workflow. PATCH/DELETE against this route
 * return 405 (no handler exported), matching the negative-probe runbook.
 *
 * GET — admin-only: `?error_id=<uuid>` returns that error's resolutions,
 * otherwise the 50 most recent. Demo: the demo ledger.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

export async function POST(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  // Admin-only: coaches/assistants annotate nothing (mirrors the
  // bc_aer_insert_admin RLS policy — admin-only INSERT).
  if (ctx.role !== "admin") {
    console.warn("[admin/automation-resolutions] non-admin POST attempted", {
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

  const errorId = str(body?.error_id)?.trim();
  const note = str(body?.resolution_note)?.trim();
  if (!errorId) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json(
      { ok: false, error: "missing_note" },
      { status: 400 }
    );
  }

  // ---- Demo: ledger append only; automation_errors stays immutable ----
  if (ctx.demo) {
    const row = demoResolveError({
      error_id: errorId,
      resolved_by: null,
      resolution_note: note.slice(0, 2000),
    });
    return NextResponse.json({
      ok: true,
      demo: true,
      simulated: true,
      resolution: row,
    });
  }

  // The resolutions table FKs automation_errors(id) — reject non-uuid ids
  // cleanly instead of surfacing a raw FK error.
  if (!UUID_RE.test(errorId)) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  const res = await service
    .from("automation_error_resolutions")
    .insert({
      error_id: errorId,
      resolved_by: ctx.profileId,
      resolution_note: note.slice(0, 2000),
    })
    .select("id")
    .single();
  if (res.error) {
    console.error(
      "[admin/automation-resolutions] insert failed",
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

export async function GET(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  if (ctx.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden", role: ctx.role },
      { status: 403 }
    );
  }

  const errorId = req.nextUrl.searchParams.get("error_id");

  // ---- Demo: ledger rows, zero network ----
  if (ctx.demo) {
    const rows = errorId
      ? demoErrorResolutions().filter((r) => r.error_id === errorId)
      : demoErrorResolutions();
    return NextResponse.json({ ok: true, demo: true, rows });
  }

  if (errorId && !UUID_RE.test(errorId)) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ ok: false, error: "db_down" }, { status: 503 });
  }

  const query = service
    .from("automation_error_resolutions")
    .select("id, error_id, resolved_by, resolution_note, created_at")
    .order("created_at", { ascending: false });
  if (errorId) query.eq("error_id", errorId);
  else query.limit(50);

  const res = await query;
  if (res.error) {
    console.error(
      "[admin/automation-resolutions] read failed",
      res.error.message
    );
    return NextResponse.json(
      { ok: false, error: "db_read_failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, demo: false, rows: res.data ?? [] });
}
