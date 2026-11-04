import { NextResponse } from "next/server";

import {
  CHECKIN_PHOTOS_BUCKET,
  CHECKIN_PHOTO_TYPES,
  MAX_CHECKIN_PHOTO_BYTES,
  MAX_CHECKIN_PHOTOS,
  checkinGates,
  checkinPhotoPath,
  extensionForMime,
  isCheckinRequestId,
  isOwnCheckinPhotoPath,
  sanitizeCheckinFilename,
  sniffImageType,
} from "@/lib/checkins";
import { isDemoMode } from "@/lib/mode";
import { DEMO_CLIENT_ID, demoCheckinDetail, demoCheckinUploadPath } from "@/lib/demo/portal-checkins";
import { getPortalContext } from "@/lib/supabase/portal-context";
import { checkinEntitlements } from "@/lib/supabase/portal-checkins";
import { createPortalClient } from "@/lib/supabase/supabase-auth";

/**
 * POST /api/portal/checkins/upload — single photo → private bucket.
 *
 * Multipart fields: `file` (single image) + `request_id`.
 *
 * Hard rules (binding):
 *  - Entitlement gate FIRST (`progress_submissions` + open cadence) → 403.
 *  - Ownership: the request must belong to the session client
 *    (`.eq("id", id).eq("client_id", <session id>)`); otherwise 404.
 *  - Type/size validated HERE (jpg/png/webp, ≤10MB) with a magic-byte sniff
 *    on top of the declared content type.
 *  - The object path is BUILT SERVER-SIDE:
 *    `checkin-photos/<own client_id>/<request_id>/<generated-name>` — a
 *    caller-supplied path is never used, so the storage owner-prefix RLS
 *    policy (Task 2) always matches.
 *  - Upload runs through the USER-JWT Storage client — no service key.
 *  - Demo: simulated path only, ZERO Supabase/network.
 */

const isFileLike = (value: unknown): value is File =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Blob).arrayBuffer === "function" &&
  typeof (value as File).name === "string" &&
  typeof (value as File).size === "number";

function generatedName(originalName: string, mime: string): string {
  const safeBase = sanitizeCheckinFilename(originalName).replace(
    /\.[A-Za-z0-9]{1,5}$/,
    ""
  );
  const suffix = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return sanitizeCheckinFilename(
    `${stamp}-${suffix}-${safeBase || "photo"}.${extensionForMime(mime)}`
  );
}

export async function POST(req: Request) {
  // Early reject: never buffer a multipart body larger than the cap + slack.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CHECKIN_PHOTO_BYTES + 64 * 1024
  ) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = checkinEntitlements(ctx, req.headers);
  const gates = checkinGates(ent);
  if (!gates.can_submit) {
    return NextResponse.json(
      { error: "feature_locked", gate: "progress_submissions" },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const requestIdRaw = form.get("request_id");
  const requestId =
    typeof requestIdRaw === "string" ? requestIdRaw.trim() : "";
  if (!isCheckinRequestId(requestId)) {
    return NextResponse.json(
      { error: "request_id_required" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!isFileLike(file)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "file_empty" }, { status: 400 });
  }
  if (file.size > MAX_CHECKIN_PHOTO_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (!(CHECKIN_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: "unsupported_type" },
      { status: 415 }
    );
  }

  // Sniff the first bytes — a renamed non-image must not enter the bucket.
  const buffer = await file.arrayBuffer();
  const sniffed = sniffImageType(new Uint8Array(buffer.slice(0, 16)));
  if (!sniffed) {
    return NextResponse.json(
      { error: "unsupported_type" },
      { status: 415 }
    );
  }

  const name = generatedName(file.name, sniffed);

  /* ---- Demo: simulated path (zero network, no bytes stored) ---- */
  if (isDemoMode()) {
    // Parity with the live branch below: the request must exist for the demo
    // client and must not be submitted/cancelled yet — otherwise a simulated
    // path would be minted for a request the live route would reject.
    const detail = demoCheckinDetail(requestId);
    if (!detail.request) {
      return NextResponse.json(
        { error: "request_not_found" },
        { status: 404 }
      );
    }
    if (detail.request.status === "cancelled") {
      return NextResponse.json(
        { error: "request_cancelled" },
        { status: 403 }
      );
    }
    if (detail.request.submitted) {
      return NextResponse.json(
        { error: "already_submitted" },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      demo: true,
      path: demoCheckinUploadPath(requestId, name),
      content_type: sniffed,
      size: file.size,
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

  const supabase = await createPortalClient();

  const reqRes = await supabase
    .from("checkin_requests")
    .select("id, client_id, status, completed_at")
    .eq("id", requestId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (reqRes.error) {
    console.error(
      "[portal/checkins] upload request read failed",
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
  if (request.client_id !== clientId) {
    return NextResponse.json({ error: "request_not_owned" }, { status: 403 });
  }
  if (request.status === "cancelled") {
    return NextResponse.json({ error: "request_cancelled" }, { status: 403 });
  }
  if (request.completed_at) {
    return NextResponse.json(
      { error: "already_submitted" },
      { status: 409 }
    );
  }

  // Best-effort cap: the UI allows 3 photos; a concurrent race can exceed it
  // by a few objects but never by a foreign prefix (path is server-built).
  const listed = await supabase.storage
    .from(CHECKIN_PHOTOS_BUCKET)
    .list(`${clientId}/${requestId}`, { limit: MAX_CHECKIN_PHOTOS + 1 });
  if ((listed.data?.length ?? 0) >= MAX_CHECKIN_PHOTOS) {
    return NextResponse.json(
      { error: "photo_limit_reached" },
      { status: 409 }
    );
  }

  const path = checkinPhotoPath(clientId, requestId, name);

  // USER-JWT upload — storage RLS `bc_checkin_photos_insert_own` verifies the
  // first path segment equals profiles.client_id for this session.
  const uploadRes = await supabase.storage
    .from(CHECKIN_PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: sniffed, upsert: false });

  if (uploadRes.error) {
    console.error(
      "[portal/checkins] upload failed",
      uploadRes.error.message
    );
    return NextResponse.json({ error: "upload_rejected" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    demo: false,
    path,
    content_type: sniffed,
    size: file.size,
  });
}

/**
 * DELETE /api/portal/checkins/upload — remove one uploaded photo.
 *
 * JSON body: { request_id, path }. This is the "remove photo" half of the
 * form's upload flow: it frees a slot under the 3-photo cap by deleting the
 * object instead of leaking it into the bucket.
 *
 * Hard rules (binding):
 *  - Entitlement gate FIRST (same gate as upload) → 403 feature_locked.
 *  - `path` must be `checkin-photos/<own client_id>/<request_id>/<name>` —
 *    anything else → 400 photos_invalid. Ownership comes from the session,
 *    never from the body.
 *  - Only unsubmitted requests: a submitted/completed request is immutable
 *    history, so deleting its photos → 409 already_submitted.
 *  - Live delete runs through the USER-JWT Storage client — storage RLS
 *    own-prefix policies govern. No service key.
 *  - Demo: acknowledged only (no bytes are stored in demo mode).
 */
export async function DELETE(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: "invalid_json" }, { status: 413 });
  }

  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = checkinEntitlements(ctx, req.headers);
  const gates = checkinGates(ent);
  if (!gates.can_submit) {
    return NextResponse.json(
      { error: "feature_locked", gate: "progress_submissions" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const requestId =
    typeof body.request_id === "string" ? body.request_id.trim() : "";
  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!isCheckinRequestId(requestId)) {
    return NextResponse.json(
      { error: "request_id_required" },
      { status: 400 }
    );
  }

  const demoMode = isDemoMode();
  const clientIdForPath = demoMode
    ? DEMO_CLIENT_ID
    : !ctx.demo && ctx.authed
      ? ctx.client.id
      : "";
  if (!clientIdForPath) {
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }
  if (!isOwnCheckinPhotoPath(path, clientIdForPath, requestId)) {
    return NextResponse.json({ error: "photos_invalid" }, { status: 400 });
  }

  if (demoMode) {
    const detail = demoCheckinDetail(requestId);
    if (!detail.request) {
      return NextResponse.json(
        { error: "request_not_found" },
        { status: 404 }
      );
    }
    if (detail.request.status === "cancelled") {
      return NextResponse.json(
        { error: "request_cancelled" },
        { status: 403 }
      );
    }
    if (detail.request.submitted) {
      return NextResponse.json(
        { error: "already_submitted" },
        { status: 409 }
      );
    }
    // Demo stores no bytes — the removal is acknowledged, nothing to delete.
    return NextResponse.json({ ok: true, demo: true, deleted: true });
  }

  // Narrowing only: anonymous + demo responses already returned above.
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const clientId = ctx.client.id;
  if (!clientId) {
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  const supabase = await createPortalClient();

  const reqRes = await supabase
    .from("checkin_requests")
    .select("id, status, completed_at")
    .eq("id", requestId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (reqRes.error) {
    console.error(
      "[portal/checkins] delete request read failed",
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
    status: string;
    completed_at: string | null;
  };
  if (request.status === "cancelled") {
    return NextResponse.json({ error: "request_cancelled" }, { status: 403 });
  }
  if (request.completed_at) {
    return NextResponse.json(
      { error: "already_submitted" },
      { status: 409 }
    );
  }
  const existingRes = await supabase
    .from("checkin_submissions")
    .select("id")
    .eq("request_id", request.id)
    .limit(1);
  if (existingRes.error) {
    console.error(
      "[portal/checkins] delete existing submission check failed",
      existingRes.error.message
    );
    return NextResponse.json({ error: "db_read_failed" }, { status: 502 });
  }
  if ((existingRes.data?.length ?? 0) > 0) {
    return NextResponse.json(
      { error: "already_submitted" },
      { status: 409 }
    );
  }

  // USER-JWT storage delete — storage RLS own-prefix policy governs.
  const removeRes = await supabase.storage
    .from(CHECKIN_PHOTOS_BUCKET)
    .remove([path]);

  if (removeRes.error) {
    console.error(
      "[portal/checkins] delete failed",
      removeRes.error.message
    );
    return NextResponse.json({ error: "delete_rejected" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, demo: false, deleted: true });
}
