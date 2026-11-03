import { NextResponse, type NextRequest } from "next/server";

import type {
  AdminClientRow,
  CheckinColumnRow,
} from "@/lib/admin/types";
import { toRowBase } from "@/lib/admin/segments";
import {
  assertStaff,
  canAccessClient,
  scopeDenied,
} from "@/lib/supabase/admin-context";
import { createServiceClient } from "@/lib/supabase/supabase-service";
import { webConversationId } from "@/lib/supabase/portal-chat";

const uuidLike = (value: string): boolean =>
  /^[0-9a-fA-F-]{36}$/.test(value);

const unknownStr = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const numOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * GET  /api/admin/tasks/review — review workbench list: checkin_requests
 *      (cadence + period) joined with their submissions and verdicts from
 *      checkin_reviews. `columns` = still-open work (no verdict or pending);
 *      `all` = everything reviewed.
 *
 * POST /api/admin/tasks/review  { submission_id, status:'approved'|'needs_work',
 *      feedback, chat?: { content } }
 *      — upsert `checkin_reviews` via the service client AFTER route-level
 *        staff auth (automation_errors stays read-only from app code —
 *        resolutions never touch it here).
 *      — `checkin_reviews.reviewer_profile_id` is NOT NULL and references
 *        public.profiles: legacy-cookie admins have no profiles row, so the
 *        route resolves ctx.profileId → the first admin profile; when the
 *        profiles table is EMPTY the route answers 400 admin_profile_missing
 *        (documented in the report/runbook: seed an admin profiles row).
 *      — coach may review their own assigned clients (mirrors
 *        bc_checkin_reviews_insert_coach); coach_assistant → 403.
 *      — chat.content optionally appends a server-pinned role='coach'
 *        source='web' message to the client's web thread (same service-path
 *        deviation as /api/admin/conversations; follow-up migration
 *        004_coach_chat_policy.sql covers strict RLS parity — unapplied).
 */

async function resolveReviewer(
  ctx: Awaited<ReturnType<typeof assertStaff>>["ctx"],
  service: ReturnType<typeof createServiceClient>
): Promise<{ id: string } | null> {
  if (ctx.profileId) {
    const own = await service
      .from("profiles")
      .select("id")
      .eq("id", ctx.profileId)
      .maybeSingle();
    if (own.data?.id) return own.data as { id: string };
  }
  const admins = await service
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);
  return (admins.data?.[0] as { id: string } | undefined) ?? null;
}

export async function GET() {
  const { ctx, error } = await assertStaff();
  if (error) return error;
  if (ctx.demo) {
    return NextResponse.json({
      ok: true,
      demo: true,
      role: ctx.role,
      columns: [],
      all: [],
      clients: [],
    });
  }

  const service = createServiceClient();
  const scopedIds = ctx.assignedClientIds;
  if (scopedIds !== null && scopedIds.length === 0) {
    return NextResponse.json({
      ok: true,
      demo: false,
      role: ctx.role,
      columns: [],
      all: [],
      clients: [],
    });
  }

  const requestsQuery = service
    .from("checkin_requests")
    .select("id, client_id, period_label, period_start, period_end, status")
    .order("period_start", { ascending: false })
    .limit(200);
  if (scopedIds !== null) requestsQuery.in("client_id", scopedIds);

  const submissionsQuery = service
    .from("checkin_submissions")
    .select(
      "id, request_id, client_id, weight_kg, training_days_made, workout_pct, nutrition_pct, submitted_at"
    )
    .order("submitted_at", { ascending: false })
    .limit(300);
  if (scopedIds !== null) submissionsQuery.in("client_id", scopedIds);

  const [requestsRes, submissionsRes] = await Promise.all([
    requestsQuery,
    submissionsQuery,
  ]);

  if (requestsRes.error || submissionsRes.error) {
    console.error(
      "[admin/tasks] list read failed",
      requestsRes.error?.message ?? "",
      submissionsRes.error?.message ?? ""
    );
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 502 });
  }

  const requests = (requestsRes.data ?? []) as Record<string, unknown>[];
  const submissions = (submissionsRes.data ?? []) as Record<string, unknown>[];
  const requestById = new Map(requests.map((r) => [String(r.id), r]));

  const reviewsRes = submissions.length
    ? await service
        .from("checkin_reviews")
        .select("submission_id, status, feedback, updated_at")
    : null;
  const reviewBySubmission = new Map<string, Record<string, unknown>>();
  for (const r of (reviewsRes?.data ?? []) as Record<string, unknown>[]) {
    reviewBySubmission.set(String(r.submission_id), r);
  }

  // Light client rows so the workbench labels without N round-trips.
  const clientsQuery = service
    .from("clients")
    .select(
      "id, client_code, full_name, email, phone, package_id, status"
    )
    .order("created_at", { ascending: false });
  if (scopedIds !== null) clientsQuery.in("id", scopedIds);
  const clientsRes = await clientsQuery;
  const clients: AdminClientRow[] = ((clientsRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((c) =>
    toRowBase({
      id: String(c.id),
      client_code: unknownStr(c.client_code),
      full_name: (unknownStr(c.full_name) ?? "") || "—",
      email: unknownStr(c.email),
      phone: unknownStr(c.phone),
      package_id: unknownStr(c.package_id),
      client_status: unknownStr(c.status) ?? "active",
      demo: false,
    })
  );

  const all: CheckinColumnRow[] = submissions.map((s) => {
    const req = requestById.get(String(s.request_id));
    const review = reviewBySubmission.get(String(s.id));
    const reviewStatus = review ? unknownStr(review.status) : null;
    return {
      submission_id: String(s.id),
      request_id: String(s.request_id),
      client_id: s.client_id ? String(s.client_id) : null,
      period_label: req ? unknownStr(req.period_label) : null,
      period_start: req ? unknownStr(req.period_start) : null,
      period_end: req ? unknownStr(req.period_end) : null,
      request_status: req ? unknownStr(req.status) : null,
      submitted_at: unknownStr(s.submitted_at),
      weight_kg: numOrNull(s.weight_kg),
      training_days_made: numOrNull(s.training_days_made),
      workout_pct: numOrNull(s.workout_pct),
      nutrition_pct: numOrNull(s.nutrition_pct),
      energy: null,
      sleep: null,
      difficulties: null,
      feedback: review ? unknownStr(review.feedback) : null,
      review_status: (["pending", "approved", "needs_work"] as const).includes(
        reviewStatus as "pending"
      )
        ? (reviewStatus as CheckinColumnRow["review_status"])
        : "none",
      demo: false,
    };
  });

  return NextResponse.json({
    ok: true,
    demo: false,
    role: ctx.role,
    /** still-open work: no verdict yet or explicitly pending */
    columns: all.filter(
      (c) => c.review_status === "none" || c.review_status === "pending"
    ),
    /** already reviewed this window */
    all: all.filter(
      (c) => c.review_status !== "none" && c.review_status !== "pending"
    ),
    clients,
  });
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as {
    submission_id?: string;
    status?: string;
    feedback?: string;
    chat?: { content?: string };
  } | null;

  if (
    !body ||
    typeof body.submission_id !== "string" ||
    !uuidLike(body.submission_id) ||
    !["approved", "needs_work"].includes(body.status ?? "")
  ) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  // Matrix: reviews are admin+coach only (assistants inherit VIEW access).
  if (ctx.role === "coach_assistant") {
    console.warn("[admin/tasks] assistant review attempt denied", {
      role: ctx.role,
    });
    return NextResponse.json(
      { ok: false, error: "forbidden", role: ctx.role },
      { status: 403 }
    );
  }

  const service = createServiceClient();

  // ownership from the stored row — never from the body
  const subRes = await service
    .from("checkin_submissions")
    .select("id, client_id")
    .eq("id", body.submission_id)
    .single();
  if (subRes.error || !subRes.data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const clientId = String((subRes.data as { client_id: unknown }).client_id);
  if (!canAccessClient(ctx, clientId)) return scopeDenied();

  if (ctx.demo) {
    // Demo simulation is applied by the page via the demo module; the route
    // still validates the same shape (no network, no store touch).
    return NextResponse.json({ ok: true, simulated: true });
  }

  const reviewer = await resolveReviewer(ctx, service);
  if (!reviewer) {
    return NextResponse.json(
      {
        ok: false,
        error: "admin_profile_missing",
        detail:
          "checkin_reviews.reviewer_profile_id requires a public.profiles row; seed an admin profiles row (Task 11) before live reviews",
      },
      { status: 400 }
    );
  }

  const upsertRes = await service.from("checkin_reviews").upsert(
    {
      submission_id: body.submission_id,
      reviewer_profile_id: reviewer.id,
      status: body.status,
      feedback:
        typeof body.feedback === "string" && body.feedback.trim().length
          ? body.feedback.trim().slice(0, 4000)
          : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" }
  );
  if (upsertRes.error) {
    console.error("[admin/tasks] review upsert failed", upsertRes.error.message);
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  // Optional conversational feedback → pinned coach message in the web thread
  const chatContent = body.chat?.content;
  if (chatContent && chatContent.trim().length) {
    const insRes = await service.from("chat_messages").insert({
      conversation_id: webConversationId(clientId),
      role: "coach", // pinned server-side
      content: chatContent.trim().slice(0, 4000),
      source: "web",
      message_ts: new Date().toISOString(),
    });
    if (insRes.error) {
      console.error(
        "[admin/tasks] chat append failed",
        insRes.error.message
      );
      // Review landed; conversational append failure is non-fatal.
      return NextResponse.json({
        ok: true,
        chat_written: false,
        error_chat: insRes.error.message,
      });
    }
  }

  return NextResponse.json({ ok: true, chat_written: Boolean(chatContent) });
}
