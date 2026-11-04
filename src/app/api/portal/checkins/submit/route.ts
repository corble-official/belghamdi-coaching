import { NextResponse } from "next/server";

import {
  checkinGates,
  parseCheckinSubmission,
  validatePhotoPaths,
} from "@/lib/checkins";
import { isDemoMode } from "@/lib/mode";
import { DEMO_CLIENT_ID, demoCheckinSubmit } from "@/lib/demo/portal-checkins";
import { getPortalContext } from "@/lib/supabase/portal-context";
import { checkinEntitlements } from "@/lib/supabase/portal-checkins";
import { createPortalClient } from "@/lib/supabase/supabase-auth";

/**
 * POST /api/portal/checkins/submit — one check-in submission per request.
 *
 * Contract (binding):
 *  - Entitlement gate FIRST: `progress_submissions` (+ an open cadence) must
 *    be true, else 403 `feature_locked`. RLS is the database backstop.
 *  - Ownership is derived SERVER-SIDE: the request row is loaded with
 *    `.eq("id", id).eq("client_id", <session client id>)`, and the insert
 *    carries the session client id. Any `client_id` in the body is never
 *    read. A foreign request id is therefore 404 (no existence leak).
 *  - `photos` must be OBJECT PATHS under
 *    `checkin-photos/<own client_id>/<request_id>/<name>` — any other layout
 *    → 400 `photos_invalid` (upload validation lives in the upload route).
 *  - Duplicate submission for the same request id → 409 `already_submitted`
 *    (`checkin_submissions_request_id_key` is UNIQUE; 23505 is mapped too).
 *  - Validation: weight 30..300 OR ≥1 measurement (cm), pct 0..100,
 *    training_days 0..7, energy/sleep 1..10 — the live telegram form scales.
 *  - NO service client, NO n8n/Telegram call. Rows only.
 */

export async function POST(req: Request) {
  // Auth FIRST — never parse a body for a caller we would reject anyway.
  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = checkinEntitlements(ctx, req.headers);
  const gates = checkinGates(ent);

  // Server-side gate — never trust the UI to have disabled the button.
  if (!gates.can_submit) {
    return NextResponse.json(
      { error: "feature_locked", gate: "progress_submissions" },
      { status: 403 }
    );
  }

  // Submit bodies are tiny (a few hundred bytes of JSON + 3 photo paths).
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseCheckinSubmission(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.input;

  /* ---- Demo: simulated success / duplicate, zero Supabase ---- */
  if (isDemoMode()) {
    // Object-path ownership is still enforced in demo (same 400 contract).
    const photoError = validatePhotoPaths(
      input.photos,
      DEMO_CLIENT_ID,
      input.request_id
    );
    if (photoError) {
      return NextResponse.json({ error: photoError }, { status: 400 });
    }

    const simulated = demoCheckinSubmit(input);
    if (!simulated.ok) {
      return NextResponse.json(
        { error: simulated.error },
        { status: simulated.error === "already_submitted" ? 409 : 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      demo: true,
      submission_id: simulated.submission_id,
    });
  }

  // Narrowing only: anonymous + demo responses already returned above.
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  // Photo paths: own client prefix + this exact request id.
  const photoError = validatePhotoPaths(
    input.photos,
    clientId,
    input.request_id
  );
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  const supabase = await createPortalClient();

  const reqRes = await supabase
    .from("checkin_requests")
    .select("id, client_id, status, completed_at, period_label")
    .eq("id", input.request_id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (reqRes.error) {
    console.error(
      "[portal/checkins] submit request read failed",
      reqRes.error.message
    );
    return NextResponse.json({ error: "db_read_failed" }, { status: 502 });
  }
  if (!reqRes.data) {
    return NextResponse.json(
      { error: "request_not_found" },
      { status: 404 }
    );
  }

  const request = reqRes.data as {
    id: string;
    client_id: string;
    status: string;
    completed_at: string | null;
  };

  // Belt-and-braces: RLS already filtered, but never insert for a foreign row.
  if (request.client_id !== clientId) {
    return NextResponse.json({ error: "request_not_owned" }, { status: 403 });
  }
  if (request.status === "cancelled") {
    return NextResponse.json({ error: "request_cancelled" }, { status: 403 });
  }

  const existingRes = await supabase
    .from("checkin_submissions")
    .select("id")
    .eq("request_id", request.id)
    .limit(1);

  if (existingRes.error) {
    console.error(
      "[portal/checkins] duplicate submission check failed",
      existingRes.error.message
    );
    return NextResponse.json({ error: "db_read_failed" }, { status: 502 });
  }

  if ((existingRes.data?.length ?? 0) > 0 || request.completed_at) {
    return NextResponse.json(
      { error: "already_submitted" },
      { status: 409 }
    );
  }

  // JWT INSERT — RLS `bc_checkin_submissions_insert_client` verifies
  // owns_client(client_id) + follow-up/onboarding access at the DB level.
  const insertRes = await supabase
    .from("checkin_submissions")
    .insert({
      request_id: request.id,
      client_id: clientId,
      weight_kg: input.weight_kg,
      measurements: input.measurements,
      training_days_made: input.training_days_made,
      workout_pct: input.workout_pct,
      nutrition_pct: input.nutrition_pct,
      energy: input.energy,
      sleep: input.sleep,
      difficulties: input.difficulties || null,
      feedback: input.feedback || null,
      photos: input.photos,
      // Kept in the same flat shape the live telegram `submit_checkin` RPC
      // stores in `data`, plus a portal provenance marker.
      data: {
        weight_kg: input.weight_kg,
        measurements: input.measurements,
        training_days_made: input.training_days_made,
        workout_pct: input.workout_pct,
        nutrition_pct: input.nutrition_pct,
        energy: input.energy,
        sleep: input.sleep,
        difficulties: input.difficulties,
        feedback: input.feedback,
        source: "portal",
      },
    })
    .select("id")
    .single();

  if (insertRes.error || !insertRes.data) {
    const code = insertRes.error?.code;
    console.error(
      "[portal/checkins] submit insert failed",
      code ?? "",
      insertRes.error?.message ?? ""
    );
    if (code === "23505") {
      // Concurrent POST won the UNIQUE(request_id) race.
      return NextResponse.json(
        { error: "already_submitted" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "submission_rejected" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    demo: false,
    submission_id: (insertRes.data as { id: string }).id,
  });
}
