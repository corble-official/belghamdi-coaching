import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHECKIN_PHOTOS_BUCKET,
  CHECKIN_SIGNED_URL_TTL,
  MEASUREMENT_KEYS,
  isOwnCheckinPhotoPath,
  toNumber,
  type CheckinPhotoView,
  type CheckinRequestItem,
  type CheckinSubmissionView,
  type Measurements,
  type ProgressEntry,
} from "@/lib/checkins";
import { isDemoMode } from "@/lib/mode";
import {
  demoCheckinDetail,
  demoCheckinList,
  demoGateEntitlements,
  demoGateFromHeaders,
  demoProgressEntries,
} from "@/lib/demo/portal-checkins";
import type { Entitlements } from "./entitlements";
import type { PortalContext } from "./portal-context";
import { createPortalClient } from "./supabase-auth";

/**
 * Check-in + progress data access for the CLIENT portal.
 *
 * Hard rules (binding):
 *  - EVERY read/write runs through the USER-JWT client (`createPortalClient`)
 *    so RLS `can_access_client` is the backstop. No service client here.
 *  - Ownership is derived server-side from the session-resolved
 *    `ctx.client.id` — `.eq("client_id", clientId)` is always applied and no
 *    caller-supplied client id is ever accepted.
 *  - Demo mode returns simulated rows BEFORE any Supabase construction
 *    (zero network), mirroring portal-onboarding.ts.
 *  - Photo reads are signed per request (10-min TTL) and ONLY for paths that
 *    match the caller's own `checkin-photos/<client_id>/...` prefix.
 */

export type CheckinQueryStatus = "open" | "completed" | "all";

export type QueryResult<T> =
  | { ok: true; demo: boolean; data: T }
  | { ok: false; demo: boolean };

export type CheckinListData = { requests: CheckinRequestItem[] };

export type CheckinDetailData = {
  request: CheckinRequestItem | null;
  submission: CheckinSubmissionView | null;
  last_weight_kg: number | null;
};

export type ProgressData = { entries: ProgressEntry[] };

/** Newest N check-ins get signed thumbnails per page load (3 photos each). */
const SIGN_BUDGET = 12;

const REQUEST_SELECT =
  "id, period_start, period_end, period_label, due_date, status, sent_at";

const SUBMISSION_SELECT =
  "id, request_id, client_id, weight_kg, measurements, training_days_made, workout_pct, nutrition_pct, energy, sleep, difficulties, feedback, photos, submitted_at";

const strOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const strOr = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function normalizeMeasurements(value: unknown): Measurements | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const out: Measurements = {};
  for (const key of MEASUREMENT_KEYS) {
    const n = toNumber(record[key]);
    if (n !== null) out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizePhotoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is string => typeof p === "string" && p !== "");
}

function normalizeRequest(
  raw: Record<string, unknown>,
  submission?: { id: string; submitted_at: string | null } | null
): CheckinRequestItem {
  return {
    id: String(raw.id),
    period_label: strOr(raw.period_label),
    period_start: strOr(raw.period_start),
    period_end: strOr(raw.period_end),
    due_date: strOrNull(raw.due_date),
    status: strOr(raw.status, "sent"),
    sent_at: strOrNull(raw.sent_at),
    submitted: Boolean(submission),
    submission_id: submission?.id ?? null,
    submitted_at: submission?.submitted_at ?? null,
  };
}

/**
 * Sign own photo paths with ONE batch storage call. Anything outside the
 * caller's prefix is kept as a path WITHOUT a URL (never signed) — defense
 * in depth on top of storage RLS. Per-item signing errors are logged and
 * degrade to `url: null` rather than failing the whole history read.
 */
async function signOwnPhotos(
  supabase: SupabaseClient,
  paths: string[],
  clientId: string
): Promise<CheckinPhotoView[]> {
  const expiresAt = new Date(
    Date.now() + CHECKIN_SIGNED_URL_TTL * 1000
  ).toISOString();

  const ownUnique = Array.from(
    new Set(paths.filter((path) => isOwnCheckinPhotoPath(path, clientId)))
  );
  const urlByPath = new Map<string, string | null>();

  if (ownUnique.length > 0) {
    const { data, error } = await supabase.storage
      .from(CHECKIN_PHOTOS_BUCKET)
      .createSignedUrls(ownUnique, CHECKIN_SIGNED_URL_TTL);

    if (error) {
      console.warn(
        "[portal/progress] batch photo signing failed",
        error.message
      );
    } else {
      for (const item of data ?? []) {
        if (item.error) {
          console.warn(
            "[portal/progress] photo signing failed",
            item.path ?? "",
            item.error
          );
        }
        if (item.path) {
          urlByPath.set(item.path, item.error ? null : item.signedUrl);
        }
      }
    }
  }

  return paths.map((path) => {
    const url = urlByPath.get(path) ?? null;
    return { path, url, expires_at: url ? expiresAt : null };
  });
}

function normalizeSubmission(
  raw: Record<string, unknown>,
  review?: Record<string, unknown> | null
): CheckinSubmissionView {
  return {
    id: String(raw.id),
    request_id: String(raw.request_id),
    submitted_at: strOrNull(raw.submitted_at),
    weight_kg: toNumber(raw.weight_kg),
    measurements: normalizeMeasurements(raw.measurements),
    training_days_made: toNumber(raw.training_days_made),
    workout_pct: toNumber(raw.workout_pct),
    nutrition_pct: toNumber(raw.nutrition_pct),
    energy: toNumber(raw.energy),
    sleep: toNumber(raw.sleep),
    difficulties: strOrNull(raw.difficulties),
    feedback: strOrNull(raw.feedback),
    photos: normalizePhotoPaths(raw.photos).map((path) => ({
      path,
      url: null,
      expires_at: null,
    })),
    review: review
      ? {
          status: strOr(review.status, "pending"),
          feedback: strOrNull(review.feedback),
          updated_at: strOrNull(review.updated_at),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ list */

export async function listOwnCheckins(
  ctx: PortalContext,
  status: CheckinQueryStatus
): Promise<QueryResult<CheckinListData>> {
  if (isDemoMode()) {
    return { ok: true, demo: true, data: { requests: demoCheckinList(status) } };
  }
  if (ctx.demo || !ctx.authed) return { ok: false, demo: false };

  const clientId = ctx.client.id;
  if (!clientId) return { ok: true, demo: false, data: { requests: [] } };

  const supabase = await createPortalClient();

  // Ownership: session-derived client id only.
  const [reqRes, subRes] = await Promise.all([
    supabase
      .from("checkin_requests")
      .select(REQUEST_SELECT)
      .eq("client_id", clientId)
      .order("period_start", { ascending: false })
      .limit(52),
    supabase
      .from("checkin_submissions")
      .select("id, request_id, submitted_at")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(100),
  ]);

  if (reqRes.error || subRes.error) {
    console.error(
      "[portal/checkins] list read failed",
      reqRes.error?.message ?? "",
      subRes.error?.message ?? ""
    );
    return { ok: false, demo: false };
  }

  const submissionByRequest = new Map<
    string,
    { id: string; submitted_at: string | null }
  >();
  for (const row of (subRes.data ?? []) as Record<string, unknown>[]) {
    submissionByRequest.set(String(row.request_id), {
      id: String(row.id),
      submitted_at: strOrNull(row.submitted_at),
    });
  }

  const requests = ((reqRes.data ?? []) as Record<string, unknown>[]).map(
    (raw) => normalizeRequest(raw, submissionByRequest.get(String(raw.id)))
  );

  const filtered =
    status === "open"
      ? requests.filter((r) => !r.submitted && r.status !== "cancelled")
      : status === "completed"
        ? requests.filter((r) => r.submitted)
        : requests;

  return { ok: true, demo: false, data: { requests: filtered } };
}

/* ---------------------------------------------------------------- detail */

export async function getOwnCheckinDetail(
  ctx: PortalContext,
  requestId: string
): Promise<QueryResult<CheckinDetailData>> {
  if (isDemoMode()) {
    return { ok: true, demo: true, data: demoCheckinDetail(requestId) };
  }
  if (ctx.demo || !ctx.authed) return { ok: false, demo: false };

  const clientId = ctx.client.id;
  if (!clientId) {
    return {
      ok: true,
      demo: false,
      data: { request: null, submission: null, last_weight_kg: null },
    };
  }

  const supabase = await createPortalClient();

  // Both filters are applied: RLS already scopes the row, and the explicit
  // client_id equality makes a foreign request id unmatchable in code too.
  const reqRes = await supabase
    .from("checkin_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (reqRes.error) {
    console.error("[portal/checkins] detail read failed", reqRes.error.message);
    return { ok: false, demo: false };
  }
  if (!reqRes.data) {
    return {
      ok: true,
      demo: false,
      data: { request: null, submission: null, last_weight_kg: null },
    };
  }

  const requestRow = reqRes.data as Record<string, unknown>;

  const [subRes, lastRes] = await Promise.all([
    supabase
      .from("checkin_submissions")
      .select(SUBMISSION_SELECT)
      .eq("request_id", String(requestRow.id))
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("checkin_submissions")
      .select("weight_kg, submitted_at")
      .eq("client_id", clientId)
      .not("weight_kg", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1),
  ]);

  if (subRes.error) {
    console.error("[portal/checkins] submission read failed", subRes.error.message);
    return { ok: false, demo: false };
  }

  if (lastRes.error) {
    console.warn(
      "[portal/checkins] last-weight read failed (non-fatal)",
      lastRes.error.message
    );
  }

  const submissionRow = (subRes.data as Record<string, unknown> | null) ?? null;
  const submission = submissionRow ? normalizeSubmission(submissionRow) : null;
  const lastWeight =
    toNumber(
      ((lastRes.data?.[0] as Record<string, unknown> | undefined) ?? {})
        .weight_kg
    ) ?? null;

  return {
    ok: true,
    demo: false,
    data: {
      request: normalizeRequest(
        requestRow,
        submission ? { id: submission.id, submitted_at: submission.submitted_at } : null
      ),
      submission,
      last_weight_kg: lastWeight,
    },
  };
}

/* -------------------------------------------------------------- gates */

/**
 * Entitlements as seen by this surface. In demo mode ONLY, the response can
 * be simulated via the `x-bc-demo-gate: readonly|locked` header so the
 * negative (403 / read-only) paths are probe-able without a real Supabase
 * project. In live mode the header is never consulted — gates come from
 * `computeEntitlements()` on the session's subscription.
 */
export function checkinEntitlements(
  ctx: PortalContext,
  headers: Headers
): Entitlements {
  if (isDemoMode()) {
    return demoGateEntitlements(demoGateFromHeaders(headers));
  }
  if ("entitlements" in ctx) return ctx.entitlements;
  // Authenticated-but-anonymous fallback: closed gates (callers 401 first).
  return demoGateEntitlements("locked");
}

/* -------------------------------------------------------------- progress */

export async function getOwnProgress(
  ctx: PortalContext
): Promise<QueryResult<ProgressData>> {
  if (isDemoMode()) {
    return { ok: true, demo: true, data: { entries: demoProgressEntries() } };
  }
  if (ctx.demo || !ctx.authed) return { ok: false, demo: false };

  const clientId = ctx.client.id;
  if (!clientId) return { ok: true, demo: false, data: { entries: [] } };

  const supabase = await createPortalClient();

  const [reqRes, subRes] = await Promise.all([
    supabase
      .from("checkin_requests")
      .select(REQUEST_SELECT)
      .eq("client_id", clientId)
      .order("period_start", { ascending: false })
      .limit(52),
    supabase
      .from("checkin_submissions")
      .select(SUBMISSION_SELECT)
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(100),
  ]);

  if (reqRes.error || subRes.error) {
    console.error(
      "[portal/progress] read failed",
      reqRes.error?.message ?? "",
      subRes.error?.message ?? ""
    );
    return { ok: false, demo: false };
  }

  const requests = (reqRes.data ?? []) as Record<string, unknown>[];
  const requestById = new Map(requests.map((r) => [String(r.id), r]));
  const submissions = (subRes.data ?? []) as Record<string, unknown>[];

  // Coach verdicts (Task 7 writes them). RLS allows can_access_client, so a
  // client reads only reviews attached to their own submissions.
  const reviewBySubmission = new Map<string, Record<string, unknown>>();
  if (submissions.length > 0) {
    const reviewRes = await supabase
      .from("checkin_reviews")
      .select("submission_id, status, feedback, updated_at")
      .in(
        "submission_id",
        submissions.slice(0, 100).map((s) => String(s.id))
      );
    if (reviewRes.error) {
      console.warn(
        "[portal/progress] reviews read failed (non-fatal)",
        reviewRes.error.message
      );
    }
    for (const row of (reviewRes.data ?? []) as Record<string, unknown>[]) {
      reviewBySubmission.set(String(row.submission_id), row);
    }
  }

  const entries: ProgressEntry[] = [];
  let signed = 0;

  for (const raw of submissions) {
    const requestRow = requestById.get(String(raw.request_id));
    if (!requestRow) continue; // orphan submission — never render foreign data

    const review = reviewBySubmission.get(String(raw.id));
    const submission = normalizeSubmission(raw, review);

    if (signed < SIGN_BUDGET && submission.photos.length > 0) {
      submission.photos = await signOwnPhotos(
        supabase,
        submission.photos.map((p) => p.path),
        clientId
      );
      signed += 1;
    }

    entries.push({
      request: normalizeRequest(requestRow, {
        id: submission.id,
        submitted_at: submission.submitted_at,
      }),
      submission,
    });
  }

  entries.sort((a, b) => b.request.period_start.localeCompare(a.request.period_start));

  return { ok: true, demo: false, data: { entries } };
}
