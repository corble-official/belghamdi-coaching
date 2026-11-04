/**
 * Check-in domain layer — PURE (no server-only, no React).
 *
 * Shared by the client pages/components, the API routes, and the demo
 * simulations so ALL of them agree on:
 *  - the private Storage object-path contract (photos jsonb = object paths),
 *  - the numeric field scales validated at submit time,
 *  - the entitlement → UI/API gate mapping,
 *  - the tiny chart-lite geometry used by the progress page.
 *
 * Scale source of truth: the LIVE telegram check-in form
 * (`n8n/belghamdi-automation/chunks/form-checkin.html`) plus the live DB
 * CHECK constraints:
 *  - weight_kg 30..300 (kg, 0.1 step),
 *  - workout_pct / nutrition_pct 0..100 (5-point steps in the form),
 *  - training_days_made 0..7,
 *  - energy / sleep 1..10 (`checkin_submissions_energy_check` /
 *    `checkin_submissions_sleep_check`),
 *  - difficulties / feedback free text,
 *  - photos optional (max 3 in the portal).
 */
import type { Entitlements } from "@/lib/supabase/entitlements";

/* ------------------------------------------------------------------ *
 * Storage contract
 * ------------------------------------------------------------------ */

/** Private bucket — never public; reads go through signed URLs only. */
export const CHECKIN_PHOTOS_BUCKET = "checkin-photos";

/** Signed URL TTL (10 minutes, per the plan's photo contract). */
export const CHECKIN_SIGNED_URL_TTL = 600;

/** Max photos accepted per check-in (portal-side cap). */
export const MAX_CHECKIN_PHOTOS = 3;

/** Upload validation — enforced at the upload route, not at submit. */
export const MAX_CHECKIN_PHOTO_BYTES = 10 * 1024 * 1024;
export const CHECKIN_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const CHECKIN_PHOTO_ACCEPT = CHECKIN_PHOTO_TYPES.join(",");

/** Field scales (mirrors the live telegram form + DB CHECK constraints). */
export const CHECKIN_LIMITS = {
  weightMin: 30,
  weightMax: 300,
  pctMin: 0,
  pctMax: 100,
  daysMin: 0,
  daysMax: 7,
  scaleMin: 1,
  scaleMax: 10,
  textMax: 2000,
} as const;

/** Measurements captured by the portal (cm, flat keys — see admin drawer). */
export const MEASUREMENT_KEYS = [
  "chest",
  "waist",
  "hips",
  "arm",
  "thigh",
] as const;

export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];
export type Measurements = Partial<Record<MeasurementKey, number>>;

/* ------------------------------------------------------------------ *
 * Types (API + UI contract)
 * ------------------------------------------------------------------ */

export type CheckinRequestItem = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  due_date: string | null;
  status: string;
  sent_at: string | null;
  submitted: boolean;
  submission_id: string | null;
  submitted_at: string | null;
  demo?: boolean;
};

export type CheckinPhotoView = {
  /** Object path inside the private bucket. */
  path: string;
  /** Signed URL (10-min TTL) — null when signing failed or not own. */
  url: string | null;
  expires_at: string | null;
  demo?: boolean;
};

export type CheckinReviewView = {
  status: "pending" | "approved" | "needs_work" | string;
  feedback: string | null;
  updated_at: string | null;
};

export type CheckinSubmissionView = {
  id: string;
  request_id: string;
  submitted_at: string | null;
  weight_kg: number | null;
  measurements: Measurements | null;
  training_days_made: number | null;
  workout_pct: number | null;
  nutrition_pct: number | null;
  energy: number | null;
  sleep: number | null;
  difficulties: string | null;
  feedback: string | null;
  photos: CheckinPhotoView[];
  review: CheckinReviewView | null;
  demo?: boolean;
};

/** API gate snapshot — computed from entitlements, attached to responses. */
export type CheckinGates = {
  can_submit: boolean;
  can_read: boolean;
  history_readonly: boolean;
};

/**
 * THE gate mapping for this surface (single source of truth):
 * - read: any open check-in cadence OR read-only history.
 * - submit: full access AND a check-in cadence gate open.
 * - history_readonly mirrors the entitlement (banner + disabled CTAs).
 */
export function checkinGates(ent: Entitlements): CheckinGates {
  return {
    can_read:
      ent.weekly_checkins || ent.monthly_reviews || ent.checkin_history_readonly,
    can_submit:
      ent.progress_submissions && (ent.weekly_checkins || ent.monthly_reviews),
    history_readonly: ent.checkin_history_readonly,
  };
}

export type CheckinListResponse = CheckinGates & {
  demo: boolean;
  requests: CheckinRequestItem[];
};

export type CheckinDetail = CheckinGates & {
  demo: boolean;
  /** null = not found / not own (indistinguishable on purpose). */
  request: CheckinRequestItem | null;
  submission: CheckinSubmissionView | null;
  /** Latest own weight from any previous submission (form context). */
  last_weight_kg: number | null;
};

export type ProgressEntry = {
  request: CheckinRequestItem;
  submission: CheckinSubmissionView;
  demo?: boolean;
};

export type ProgressHistory = CheckinGates & {
  demo: boolean;
  entries: ProgressEntry[];
};

/* ------------------------------------------------------------------ *
 * Value readers / validation helpers
 * ------------------------------------------------------------------ */

/** Number or numeric-string → finite number, else null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** Sanitize a file name into a URL-safe bucket segment. */
export function sanitizeCheckinFilename(name: string): string {
  const base = (name || "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(0, 80);
  return cleaned || "photo.jpg";
}

/** Canonical object path for one uploaded check-in photo. */
export function checkinPhotoPath(
  clientId: string,
  requestId: string,
  filename: string
): string {
  return `${CHECKIN_PHOTOS_BUCKET}/${clientId}/${requestId}/${sanitizeCheckinFilename(
    filename
  )}`;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const SEGMENT_RE = /^[A-Za-z0-9-]{8,64}$/;

/** True for a plausible request id (uuid in live, seeded ids in demo). */
export function isCheckinRequestId(value: unknown): value is string {
  return typeof value === "string" && SEGMENT_RE.test(value);
}

/**
 * Strict ownership check for a `photos` entry:
 * `checkin-photos/<own client_id>/<request_id>/<filename>` and nothing else.
 * `requestId` optional → validates the client prefix only (history reads).
 */
export function isOwnCheckinPhotoPath(
  path: unknown,
  clientId: string,
  requestId?: string | null
): boolean {
  if (typeof path !== "string" || !clientId) return false;
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  const [bucket, pathClient, pathRequest, name] = parts;
  if (bucket !== CHECKIN_PHOTOS_BUCKET) return false;
  if (pathClient !== clientId) return false;
  if (requestId && pathRequest !== requestId) return false;
  if (!SEGMENT_RE.test(pathRequest)) return false;
  if (!NAME_RE.test(name)) return false;
  if (name.includes("..")) return false;
  return true;
}

/** Detect the real image type from the leading bytes (defense in depth). */
export function sniffImageType(
  head: Uint8Array
): (typeof CHECKIN_PHOTO_TYPES)[number] | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 && // R
    head[1] === 0x49 && // I
    head[2] === 0x46 && // F
    head[3] === 0x46 && // F
    head[8] === 0x57 && // W
    head[9] === 0x45 && // E
    head[10] === 0x42 && // B
    head[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/** Friendly extension for a validated mime type. */
export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/* ------------------------------------------------------------------ *
 * Submit payload parsing (server-side; body values are untrusted)
 * ------------------------------------------------------------------ */

export type CheckinSubmitInput = {
  request_id: string;
  weight_kg: number | null;
  measurements: Measurements | null;
  training_days_made: number;
  workout_pct: number;
  nutrition_pct: number;
  energy: number;
  sleep: number;
  difficulties: string;
  feedback: string;
  photos: string[];
};

export type SubmitParseResult =
  | { ok: true; input: CheckinSubmitInput }
  | { ok: false; error: string };

const clipText = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().slice(0, CHECKIN_LIMITS.textMax)
    : "";

/** Non-empty measurements object (flat numeric keys, cm). */
type MeasurementsParse =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "ok"; value: Measurements };

function parseMeasurements(value: unknown): MeasurementsParse {
  if (value === null || value === undefined) return { kind: "absent" };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { kind: "invalid" };
  }
  const record = value as Record<string, unknown>;
  const out: Measurements = {};
  for (const key of MEASUREMENT_KEYS) {
    const raw = record[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = toNumber(raw);
    // Unknown junk and implausible cm values are rejected outright so the
    // client sees an honest validation error (never silently persisted).
    if (n === null || !inRange(n, 20, 250)) return { kind: "invalid" };
    out[key] = round1(n);
  }
  return Object.keys(out).length > 0
    ? { kind: "ok", value: out }
    : { kind: "absent" };
}

/**
 * Parse + validate a submit body. Ownership (request_id belongs to the
 * session client) is NOT handled here — routes derive it server-side.
 */
export function parseCheckinSubmission(
  body: Record<string, unknown>
): SubmitParseResult {
  const requestId =
    typeof body.request_id === "string" ? body.request_id.trim() : "";
  if (!isCheckinRequestId(requestId)) {
    return { ok: false, error: "request_id_required" };
  }

  const weight = toNumber(body.weight_kg);
  if (
    weight !== null &&
    !inRange(weight, CHECKIN_LIMITS.weightMin, CHECKIN_LIMITS.weightMax)
  ) {
    return { ok: false, error: "weight_out_of_range" };
  }

  const measurementsParse = parseMeasurements(body.measurements);
  if (measurementsParse.kind === "invalid") {
    return { ok: false, error: "measurements_invalid" };
  }
  const measurements =
    measurementsParse.kind === "ok" ? measurementsParse.value : null;

  // Contract: EITHER a weight OR at least one measurement.
  if (weight === null && !measurements) {
    return { ok: false, error: "measurement_required" };
  }

  const trainingDays = toNumber(body.training_days_made);
  const workoutPct = toNumber(body.workout_pct);
  const nutritionPct = toNumber(body.nutrition_pct);
  const energy = toNumber(body.energy);
  const sleep = toNumber(body.sleep);

  if (
    trainingDays === null ||
    !inRange(trainingDays, CHECKIN_LIMITS.daysMin, CHECKIN_LIMITS.daysMax) ||
    workoutPct === null ||
    !inRange(workoutPct, CHECKIN_LIMITS.pctMin, CHECKIN_LIMITS.pctMax) ||
    nutritionPct === null ||
    !inRange(nutritionPct, CHECKIN_LIMITS.pctMin, CHECKIN_LIMITS.pctMax) ||
    energy === null ||
    !inRange(energy, CHECKIN_LIMITS.scaleMin, CHECKIN_LIMITS.scaleMax) ||
    sleep === null ||
    !inRange(sleep, CHECKIN_LIMITS.scaleMin, CHECKIN_LIMITS.scaleMax)
  ) {
    return { ok: false, error: "invalid_field" };
  }

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  if (rawPhotos.length > MAX_CHECKIN_PHOTOS) {
    return { ok: false, error: "too_many_photos" };
  }
  const photos = rawPhotos.filter(
    (p): p is string => typeof p === "string" && p.trim() !== ""
  );
  if (photos.length !== rawPhotos.length) {
    return { ok: false, error: "photos_invalid" };
  }

  return {
    ok: true,
    input: {
      request_id: requestId,
      weight_kg: weight === null ? null : round1(weight),
      measurements,
      training_days_made: Math.round(trainingDays),
      workout_pct: Math.round(workoutPct),
      nutrition_pct: Math.round(nutritionPct),
      energy: Math.round(energy),
      sleep: Math.round(sleep),
      difficulties: clipText(body.difficulties),
      feedback: clipText(body.feedback),
      photos,
    },
  };
}

/**
 * Every photo path must be inside the caller's own prefix AND the request
 * being submitted. Returns an error code, or null when all paths are valid.
 */
export function validatePhotoPaths(
  photos: string[],
  clientId: string,
  requestId: string
): string | null {
  for (const path of photos) {
    if (!isOwnCheckinPhotoPath(path, clientId, requestId)) {
      return "photos_invalid";
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Chart-lite geometry (inline SVG — no chart library)
 * ------------------------------------------------------------------ */

export type SparkGeometry = {
  /** Ready for `<polyline points={...} />`. */
  points: string;
  dots: { x: number; y: number; value: number }[];
  min: number;
  max: number;
};

/**
 * Map a value series onto a viewBox. Evenly spaced X, single value centers,
 * a flat series draws mid-height (no divide-by-zero).
 */
export function sparkGeometry(
  values: number[],
  width = 320,
  height = 96,
  padding = 10
): SparkGeometry | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const xFor = (index: number): number =>
    padding + (nums.length === 1 ? innerW / 2 : (index / (nums.length - 1)) * innerW);
  const yFor = (value: number): number =>
    span === 0 ? padding + innerH / 2 : padding + innerH - ((value - min) / span) * innerH;

  const dots = nums.map((value, index) => ({ x: xFor(index), y: yFor(value), value }));

  return {
    points: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" "),
    dots,
    min,
    max,
  };
}

/** First → last change, rounded to 1 decimal. */
export function seriesDelta(values: number[]): number | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return null;
  return round1(nums[nums.length - 1] - nums[0]);
}

/** Sort helper: oldest period first (charts + deltas). */
export function byPeriodAsc(a: ProgressEntry, b: ProgressEntry): number {
  return a.request.period_start.localeCompare(b.request.period_start);
}
