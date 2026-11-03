import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { getPortalContext } from "@/lib/supabase/portal-context";
import { createPortalClient } from "@/lib/supabase/supabase-auth";
import { createServiceClient } from "@/lib/supabase/supabase-service";
import {
  getOnboardingState,
  isOnboardingCompleted,
} from "@/lib/supabase/portal-onboarding";

/**
 * Portal onboarding — BC-03's native (site-hosted) intake surface.
 *
 * GET  → state for the current user: latest own onboarding_requests row
 *        (status + token expiry) + whether a submission exists + nil-safe
 *        profile prefill. Zero network in demo mode.
 *
 * POST → validated field set → `onboarding_submissions` INSERT via the USER
 *        JWT client (RLS `bc_onboarding_submissions_insert_client` verifies
 *        owns_client of the request), then the ADJUDICATED service-path flip:
 *        `onboarding_requests.status='completed' + completed_at=now()`.
 *        Reason for the service path: there is no UPDATE policy on
 *        onboarding_requests (writes are n8n/service-only), so a JWT update is
 *        impossible by design. The service call is narrowly scoped to THIS
 *        session's own request (id AND client_id re-checked in code) and is
 *        fail-soft: the submission already succeeded, so the response stays
 *        ok:true and the flip outcome is reported in `status_flip`.
 *
 * Hard rules (binding):
 *  - NO photos fields (decision #6 — photos are check-ins only). Photo-bearing
 *    keys in the body are stripped and never persisted.
 *  - Body `client_id` / `request_id` are NEVER trusted: ownership is derived
 *    server-side from the session, so a crafted foreign id cannot redirect
 *    the read, the insert, or the flip.
 *  - No `submit_onboarding()` RPC (revoke-blocked for JWT; n8n keeps it).
 *  - No deliver()/Telegram here — coach notification stays BC-03's job.
 */

/* Payload data-keys — EXACTLY these, flat, per the live-data contract the
   BC-03 / process_order_event consumers read. Do not nest. */
const PAYLOAD_KEYS = [
  "full_name",
  "phone",
  "fitness_goal",
  "training_days",
  "training_location",
  "experience_level",
  "health_notes",
  "referral_source",
  "extra_notes",
] as const;

type PayloadKey = (typeof PAYLOAD_KEYS)[number];

const MAX_LEN: Record<PayloadKey, number> = {
  full_name: 120,
  phone: 40,
  fitness_goal: 200,
  training_days: 40,
  training_location: 120,
  experience_level: 60,
  health_notes: 2000,
  referral_source: 200,
  extra_notes: 2000,
};

/** Keys the portal must never accept from a post body. */
const STRIPPED_KEYS = [
  "client_id",
  "request_id",
  // decision #6: photos are check-ins-only; reject the surface proactively.
  "photo_refs",
  "photos",
  "images",
  "attachments",
];

type StatusFlip = "applied" | "not_applied" | "skipped_no_service_key" | "failed";

const trimField = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function sanitizePayload(
  body: Record<string, unknown>
): { ok: true; payload: Record<PayloadKey, string> } | { ok: false; error: string } {
  const payload = {} as Record<PayloadKey, string>;
  for (const key of PAYLOAD_KEYS) {
    payload[key] = trimField(body[key], MAX_LEN[key]);
  }
  // Light validation (documented choice — lighter than the unknown legacy
  // requirements): full_name is the ONLY required field.
  if (!payload.full_name) {
    return { ok: false, error: "full_name_required" };
  }
  return { ok: true, payload };
}

/**
 * Adjudicated service-path completion flip. Ownership is re-checked in code:
 * the caller only ever passes session-derived ids. Fail-soft by contract.
 */
async function flipOwnRequest(
  clientId: string,
  requestId: string
): Promise<StatusFlip> {
  try {
    const svc = createServiceClient();
    const flip = await svc
      .from("onboarding_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("client_id", clientId)
      .select("id");

    if (flip.error) return "failed";
    // A filter mismatch updates zero rows without erroring — never report
    // "applied" unless a row actually came back.
    if (!flip.data || flip.data.length === 0) return "not_applied";
    return "applied";
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured (demo/local) — never fatal.
    return "skipped_no_service_key";
  }
}

/* ------------------------------------------------------------------ GET */

export async function GET() {
  const ctx = await getPortalContext();

  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = await getOnboardingState(ctx);
  return NextResponse.json({ ok: true, ...state });
}

/* ----------------------------------------------------------------- POST */

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Tamper-proofing: ownership-carrying + photo keys are stripped BEFORE any
  // use. They are never read; presence is not an error (fail-closed ignore).
  const bodyWoSensitive = { ...body };
  for (const key of STRIPPED_KEYS) delete bodyWoSensitive[key];

  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sanitized = sanitizePayload(bodyWoSensitive);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  /* ---- Demo path: no Supabase, no service client, success simulation ---- */
  if (isDemoMode()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      submission_id: `demo-${Date.now()}`,
      status_flip: "demo_skipped",
    });
  }

  /* ---- Live path: user JWT reads + insert, service flip after ---- */
  // Narrowing only: anonymous callers were rejected above and the demo path
  // returned already, so this branch is unreachable at runtime.
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    // Authenticated but no linked client record → no own request can exist.
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  const supabase = await createPortalClient();

  // Ownership derived server-side: the session's client id. Body ids were
  // already stripped, so a crafted foreign request_id cannot influence this
  // lookup, the INSERT below, or the service flip.
  const reqRes = await supabase
    .from("onboarding_requests")
    .select("id, client_id, status")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1);

  const request = (reqRes.data?.[0] as
    | { id: string; client_id: string; status: string }
    | undefined) ?? null;

  if (!request) {
    return NextResponse.json({ error: "no_onboarding_request" }, { status: 403 });
  }
  // Belt-and-braces code-level ownership re-check (RLS already filters, but
  // the flip runs with elevated rights — never rely on RLS for that path).
  if (request.client_id !== clientId) {
    return NextResponse.json({ error: "request_not_owned" }, { status: 403 });
  }
  if (request.status === "cancelled") {
    // BC-03/coach cancelled this intake — the portal must not resurrect it.
    return NextResponse.json({ error: "request_cancelled" }, { status: 403 });
  }
  if (isOnboardingCompleted(request.status)) {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  // Self-heal: `request_id` is UNIQUE in the live schema. If a previous POST
  // inserted but the service flip failed, retry the flip and answer 409 so the
  // page renders the "completed" card instead of writing a second row.
  const existingRes = await supabase
    .from("onboarding_submissions")
    .select("id")
    .eq("request_id", request.id)
    .limit(1);

  if ((existingRes.data?.length ?? 0) > 0) {
    const status_flip = await flipOwnRequest(clientId, request.id);
    return NextResponse.json(
      { error: "already_completed", status_flip },
      { status: 409 }
    );
  }

  // JWT INSERT — RLS `bc_onboarding_submissions_insert_client` enforces
  // owns_client(request.client_id) at the database level.
  const insertRes = await supabase
    .from("onboarding_submissions")
    .insert({ request_id: request.id, data: sanitized.payload })
    .select("id")
    .single();

  if (insertRes.error || !insertRes.data) {
    // A 23505 here means a concurrent POST won the unique race — treat it as
    // already completed rather than an opaque failure.
    const code = insertRes.error?.code;
    return NextResponse.json(
      { error: code === "23505" ? "already_completed" : "submission_rejected" },
      { status: code === "23505" ? 409 : 403 }
    );
  }
  const submissionId = (insertRes.data as { id: string }).id;

  const statusFlip = await flipOwnRequest(clientId, request.id);

  return NextResponse.json({
    ok: true,
    submission_id: submissionId,
    status_flip: statusFlip,
  });
}
