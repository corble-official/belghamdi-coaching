import { NextResponse, type NextRequest } from "next/server";

import type { AdminClientRow, AdminSegment } from "@/lib/admin/types";
import { toRowBase } from "@/lib/admin/segments";
import { assertStaff } from "@/lib/supabase/admin-context";
import { createServiceClient } from "@/lib/supabase/supabase-service";

/**
 * GET /api/admin/clients?segment=all|active|inactive|expired
 *
 * Role-check FIRST (assertStaff → 403), service-role read AFTER.
 * Coach/assistants are scoped to their assignedClientIds; legacy admin is
 * unbounded. Demo mode never reaches the service client (assertStaff's
 * demo branch short-circuits before any Supabase construction, and pages
 * in demo mode read the demo store instead of this route).
 */

const SEGMENTS: AdminSegment[] = ["all", "active", "inactive", "expired"];

export async function GET(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  const segmentParam = req.nextUrl.searchParams.get("segment") ?? "all";
  const segment: AdminSegment = (SEGMENTS as string[]).includes(segmentParam)
    ? (segmentParam as AdminSegment)
    : "all";

  // ---- Live path only (demo returns empty; pages render the demo store) ----
  if (ctx.demo) {
    return NextResponse.json({ ok: true, demo: true, role: ctx.role, rows: [] });
  }

  // Coach/assistant with zero assignments → honest empty list.
  if (ctx.assignedClientIds !== null && ctx.assignedClientIds.length === 0) {
    return NextResponse.json({ ok: true, demo: false, role: ctx.role, rows: [] });
  }

  const service = createServiceClient();

  const clientsQuery = service
    .from("clients")
    .select(
      "id, client_code, full_name, email, phone, package_id, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (ctx.assignedClientIds !== null) {
    clientsQuery.in("id", ctx.assignedClientIds);
  }
  const clientsRes = await clientsQuery;
  if (clientsRes.error) {
    console.error("[admin/clients] clients read failed", clientsRes.error.message);
    return NextResponse.json(
      { ok: false, error: "db_read_failed" },
      { status: 502 }
    );
  }
  const clients = clientsRes.data as {
    id: string;
    client_code: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    package_id: string | null;
    status: string;
  }[];

  const clientIds = clients.map((c) => c.id);

  const [subsRes, checkinsRes] = await Promise.all([
    clientIds.length
      ? service
          .from("client_subscriptions")
          .select("id, client_id, status, start_date, end_date")
          .in("client_id", clientIds)
          .order("start_date", { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    clientIds.length
      ? service
          .from("checkin_submissions")
          .select("client_id, submitted_at")
          .in("client_id", clientIds)
          .order("submitted_at", { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (subsRes.error || checkinsRes.error) {
    console.error(
      "[admin/clients] subs/checkins read failed",
      subsRes.error?.message ?? "",
      checkinsRes.error?.message ?? ""
    );
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 502 });
  }

  // Latest subscription per client (start_date desc already applied).
  const latestSub = new Map<string, {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
  }>();
  for (const s of (subsRes.data ?? []) as {
    id: string;
    client_id: string;
    status: string;
    start_date: string;
    end_date: string;
  }[]) {
    if (!latestSub.has(s.client_id)) {
      latestSub.set(s.client_id, {
        id: s.id,
        status: s.status,
        start_date: s.start_date,
        end_date: s.end_date,
      });
    }
  }

  // First occurrence per client of the submitted_at-desc scan = latest.
  const lastCheckin = new Map<string, string>();
  for (const row of (checkinsRes.data ?? []) as {
    client_id: string;
    submitted_at: string;
  }[]) {
    if (!lastCheckin.has(row.client_id)) {
      lastCheckin.set(row.client_id, row.submitted_at);
    }
  }

  let rows: AdminClientRow[] = clients.map((c) => {
    const sub = latestSub.get(c.id) ?? null;
    return toRowBase({
      id: c.id,
      client_code: c.client_code,
      full_name: c.full_name ?? c.client_code ?? c.id,
      email: c.email,
      phone: c.phone,
      package_id: c.package_id && typeof c.package_id === "string" ? c.package_id : null,
      client_status: c.status,
      sub_id: sub?.id ?? null,
      sub_status: sub?.status ?? null,
      sub_start_date: sub?.start_date ?? null,
      sub_end_date: sub?.end_date ?? null,
      last_checkin_at: lastCheckin.get(c.id) ?? null,
      demo: false,
    });
  });

  if (segment !== "all") {
    rows = rows.filter((r) => r.segment === segment);
  }

  return NextResponse.json({
    ok: true,
    demo: false,
    role: ctx.role,
    rows,
  });
}
