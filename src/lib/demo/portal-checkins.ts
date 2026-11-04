/**
 * Demo-mode simulated check-ins (Task 8).
 *
 * In-memory, keyed per demo visitor — see the storage note below.
 * ZERO Supabase/network by design: every caller is guarded by isDemoMode()
 * BEFORE this module is touched, mirroring src/lib/demo/portal-chat.ts.
 * Every row carries `demo: true` so simulated data stays distinguishable
 * from real client data (house rule).
 *
 * Storage simulation: photo entries point at `checkin-photos/<demo client
 * id>/<demo request id>/<name>` (the same object-path contract as live) and
 * carry a self-contained SVG data-URI as their "signed URL" — a real signed
 * URL cannot exist without a Supabase project, and a data URI keeps the demo
 * network-free while still rendering a thumbnail. `expires_at` mirrors the
 * live 10-minute TTL so the expiry contract stays observable.
 *
 * Per-visitor isolation (2026-11 round 1): the mutation log is keyed by the
 * `bc_demo_session` cookie value, which /api/auth/demo-session sets to a
 * random per-login token — two anonymous visitors never share submitted
 * state. Requests without a cookie (build-time prerendering, probes) share
 * the "anonymous" bucket; legacy constant-cookie sessions ("1") land there
 * too. NOTE: the seeded PAST history and the DEMO_OPEN_REQUEST seed stay
 * identical for everyone (by design); only submissions made in this server's
 * lifetime diverge per visitor. A restart wipes all of it — acceptable for a
 * simulated environment, but a multi-user demo deployment must treat this as
 * best-effort isolation, not a security boundary.
 */
import "server-only";

import { cookies } from "next/headers";

import type {
  CheckinPhotoView,
  CheckinRequestItem,
  CheckinSubmissionView,
  ProgressEntry,
  CheckinSubmitInput,
} from "@/lib/checkins";
import { CHECKIN_SIGNED_URL_TTL, isOwnCheckinPhotoPath } from "@/lib/checkins";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import type { Entitlements } from "@/lib/supabase/entitlements";

/** Sentinel identity — mirrors portal-context's DEMO_CLIENT.id. */
export const DEMO_CLIENT_ID = "demo-client-id";

/** Stable id so the follow-up teaser can deep-link the form page. */
export const DEMO_OPEN_REQUEST_ID = "demo-checkin-request-open";

const DAY = 24 * 60 * 60 * 1000;

const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * DAY).toISOString();

const dateDaysAgo = (days: number): string =>
  new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

/** Human period label matching the live scheduler's `YYYY-MM-DD → MM-DD`. */
function periodLabel(startDaysAgo: number, endDaysAgo: number): string {
  const start = dateDaysAgo(startDaysAgo);
  const end = dateDaysAgo(endDaysAgo).slice(5);
  return `${start} → ${end}`;
}

/** Self-contained placeholder thumbnail (zero network). */
function demoPhotoUrl(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#E8F2EC"/><rect x="12" y="12" width="136" height="136" rx="10" fill="#FFFFFF" stroke="#315C45" stroke-opacity="0.35"/><text x="80" y="76" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#315C45">DEMO PHOTO</text><text x="80" y="96" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#777970">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function demoPhoto(requestId: string, name: string): CheckinPhotoView {
  const path = `checkin-photos/${DEMO_CLIENT_ID}/${requestId}/${name}`;
  return {
    path,
    url: demoPhotoUrl(name.replace(/\.[a-z]+$/i, "")),
    expires_at: new Date(Date.now() + CHECKIN_SIGNED_URL_TTL * 1000).toISOString(),
    demo: true,
  };
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

const OPEN_REQUEST: CheckinRequestItem = {
  id: DEMO_OPEN_REQUEST_ID,
  period_label: periodLabel(6, 0),
  period_start: dateDaysAgo(6),
  period_end: dateDaysAgo(0),
  due_date: new Date(Date.now() + 2 * DAY).toISOString(),
  status: "sent",
  sent_at: isoDaysAgo(0.2),
  submitted: false,
  submission_id: null,
  submitted_at: null,
  demo: true,
};

type DemoPast = {
  request: CheckinRequestItem;
  submission: CheckinSubmissionView;
};

const PAST: DemoPast[] = [
  {
    request: {
      id: "demo-checkin-request-1",
      period_label: periodLabel(27, 21),
      period_start: dateDaysAgo(27),
      period_end: dateDaysAgo(21),
      due_date: isoDaysAgo(19),
      status: "submitted",
      sent_at: isoDaysAgo(28),
      submitted: true,
      submission_id: "demo-submission-1",
      submitted_at: isoDaysAgo(21),
      demo: true,
    },
    submission: {
      id: "demo-submission-1",
      request_id: "demo-checkin-request-1",
      submitted_at: isoDaysAgo(21),
      weight_kg: 82.4,
      measurements: { chest: 104, waist: 92, hips: 101, arm: 36.5 },
      training_days_made: 3,
      workout_pct: 75,
      nutrition_pct: 70,
      energy: 6,
      sleep: 6,
      difficulties: "زحمة شغل خلتني أفوت جلسة.",
      feedback: "محتاج أظبط الكارديو شوية.",
      photos: [demoPhoto("demo-checkin-request-1", "front-1.jpg")],
      review: {
        status: "approved",
        feedback: "تمام جداً — كمّل بنفس الانتظام وبنرفع الحمل الأسبوع الجاي.",
        updated_at: isoDaysAgo(20),
      },
      demo: true,
    },
  },
  {
    request: {
      id: "demo-checkin-request-2",
      period_label: periodLabel(20, 14),
      period_start: dateDaysAgo(20),
      period_end: dateDaysAgo(14),
      due_date: isoDaysAgo(12),
      status: "submitted",
      sent_at: isoDaysAgo(21),
      submitted: true,
      submission_id: "demo-submission-2",
      submitted_at: isoDaysAgo(14),
      demo: true,
    },
    submission: {
      id: "demo-submission-2",
      request_id: "demo-checkin-request-2",
      submitted_at: isoDaysAgo(14),
      weight_kg: 81.1,
      measurements: { chest: 103.5, waist: 90.5, hips: 100.5, arm: 36.5 },
      training_days_made: 4,
      workout_pct: 100,
      nutrition_pct: 85,
      energy: 8,
      sleep: 7,
      difficulties: "",
      feedback: "الطاقة أحسن بكتير هذا الأسبوع.",
      photos: [demoPhoto("demo-checkin-request-2", "front-1.jpg")],
      review: {
        status: "approved",
        feedback: "أرقام ممتازة — نكمل نفس الشكل مع زيادة بسيطة في التمرين.",
        updated_at: isoDaysAgo(13),
      },
      demo: true,
    },
  },
  {
    request: {
      id: "demo-checkin-request-3",
      period_label: periodLabel(13, 7),
      period_start: dateDaysAgo(13),
      period_end: dateDaysAgo(7),
      due_date: isoDaysAgo(5),
      status: "submitted",
      sent_at: isoDaysAgo(14),
      submitted: true,
      submission_id: "demo-submission-3",
      submitted_at: isoDaysAgo(7),
      demo: true,
    },
    submission: {
      id: "demo-submission-3",
      request_id: "demo-checkin-request-3",
      submitted_at: isoDaysAgo(7),
      weight_kg: 80.2,
      measurements: { chest: 103, waist: 89, hips: 99.5, arm: 37 },
      training_days_made: 4,
      workout_pct: 100,
      nutrition_pct: 90,
      energy: 8,
      sleep: 8,
      difficulties: "",
      feedback: "الوزن نزل والتغذية منتظمة.",
      photos: [demoPhoto("demo-checkin-request-3", "front-1.jpg")],
      review: { status: "pending", feedback: null, updated_at: null },
      demo: true,
    },
  },
];

/** Submitted demo requests created through the demo form this server life. */
type DemoSubmitted = {
  request: CheckinRequestItem;
  submission: CheckinSubmissionView;
};

type DemoCheckinState = {
  submitted: DemoSubmitted[];
  seq: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __bc_demo_checkins_v2: Record<string, DemoCheckinState> | undefined;
}

/**
 * Next dev compiles route handlers and pages into separate module registries,
 * so a plain module-scope array would let a POST land in a different instance
 * than the one the progress page reads. Pinning the map of per-session stores
 * on `globalThis` (one process, one registry) keeps the submit visible across
 * both bundles while still isolating one visitor from another.
 */
const stores: Record<string, DemoCheckinState> = (globalThis.__bc_demo_checkins_v2 ??=
  {});

/** Random per-login demo cookie → one store per visitor; else the shared bucket. */
function currentDemoKey(): string {
  try {
    const value = cookies().get(DEMO_SESSION_COOKIE)?.value;
    return value && value !== "1" ? value : "anonymous";
  } catch {
    // No request context (e.g. build-time prerender) — shared bucket is fine there.
    return "anonymous";
  }
}

function stateFor(): DemoCheckinState {
  const key = currentDemoKey();
  return (stores[key] ??= { submitted: [], seq: 0 });
}

/* ------------------------------------------------------------------ *
 * Gate simulation (demo-only probes)
 * ------------------------------------------------------------------ */

export type DemoGate = "full" | "readonly" | "locked";

/**
 * DEMO-ONLY entitlement simulation, driven by the `x-bc-demo-gate` header.
 * Lets the negative probes exercise the 403/read-only paths without a real
 * Supabase project. Read exclusively when isDemoMode() is true; in live mode
 * the header is never consulted.
 */
export function demoGateFromHeaders(headers: Headers): DemoGate {
  const raw = (headers.get("x-bc-demo-gate") || "").toLowerCase();
  return raw === "readonly" || raw === "locked" ? raw : "full";
}

export function demoGateEntitlements(gate: DemoGate): Entitlements {
  if (gate === "readonly") {
    return {
      coach_chat: false,
      weekly_checkins: false,
      monthly_reviews: false,
      progress_submissions: false,
      checkin_history_readonly: true,
      coach_feedback_readonly: true,
      onboarding_available: false,
    };
  }
  if (gate === "locked") {
    return {
      coach_chat: false,
      weekly_checkins: false,
      monthly_reviews: false,
      progress_submissions: false,
      checkin_history_readonly: false,
      coach_feedback_readonly: false,
      onboarding_available: false,
    };
  }
  return {
    coach_chat: true,
    weekly_checkins: true,
    monthly_reviews: true,
    progress_submissions: true,
    checkin_history_readonly: false,
    coach_feedback_readonly: false,
    onboarding_available: true,
  };
}

/* ------------------------------------------------------------------ *
 * Read simulations
 * ------------------------------------------------------------------ */

function openRequests(): CheckinRequestItem[] {
  const { submitted } = stateFor();
  const submittedIds = new Set(submitted.map((s) => s.request.id));
  return [
    ...(submittedIds.has(OPEN_REQUEST.id) ? [] : [{ ...OPEN_REQUEST }]),
    ...submitted.map((s) => ({ ...s.request })),
  ];
}

function completedEntries(): DemoPast[] {
  return [
    ...PAST,
    ...stateFor().submitted.slice().reverse(),
  ];
}

export function demoCheckinList(
  status: "open" | "completed" | "all"
): CheckinRequestItem[] {
  if (status === "open") {
    return openRequests().filter((r) => !r.submitted);
  }
  if (status === "completed") {
    return completedEntries()
      .map((p) => p.request)
      .sort((a, b) => b.period_start.localeCompare(a.period_start));
  }
  return [...openRequests(), ...completedEntries().map((p) => p.request)].sort(
    (a, b) => b.period_start.localeCompare(a.period_start)
  );
}

function findDemoEntry(requestId: string): DemoPast | null {
  return completedEntries().find((p) => p.request.id === requestId) ?? null;
}

export type DemoCheckinDetailData = {
  request: CheckinRequestItem | null;
  submission: CheckinSubmissionView | null;
  last_weight_kg: number | null;
};

export function demoCheckinDetail(requestId: string): DemoCheckinDetailData {
  const open = openRequests().find((r) => r.id === requestId) ?? null;
  const entry = findDemoEntry(requestId);
  const request = open ?? entry?.request ?? null;
  const lastWeight =
    completedEntries()
      .slice()
      .sort((a, b) =>
        (b.submission.submitted_at ?? "").localeCompare(
          a.submission.submitted_at ?? ""
        )
      )[0]?.submission.weight_kg ?? null;

  return {
    request,
    submission: entry?.submission ?? null,
    last_weight_kg: lastWeight,
  };
}

export function demoProgressEntries(): ProgressEntry[] {
  return completedEntries().map((p) => ({
    request: { ...p.request },
    submission: {
      ...p.submission,
      photos: p.submission.photos.map((photo) => ({
        ...photo,
        // Refresh the simulated TTL on each read (a real signed URL is
        // regenerated per request by the server as well).
        expires_at: new Date(
          Date.now() + CHECKIN_SIGNED_URL_TTL * 1000
        ).toISOString(),
      })),
    },
    demo: true,
  }));
}

/* ------------------------------------------------------------------ *
 * Write simulations
 * ------------------------------------------------------------------ */

export type DemoSubmitResult =
  | { ok: true; submission_id: string }
  | { ok: false; error: "already_submitted" | "request_not_found" };

/**
 * Simulated submit: validates the same object-path contract as live, then
 * records the submission in memory and flips the request to "submitted".
 * A second submit for the same request → already_submitted (409 parity).
 */
export function demoCheckinSubmit(input: CheckinSubmitInput): DemoSubmitResult {
  const state = stateFor();
  const { submitted } = state;

  if (findDemoEntry(input.request_id)) {
    return { ok: false, error: "already_submitted" };
  }
  const existing = submitted.find((s) => s.request.id === input.request_id);
  if (existing) return { ok: false, error: "already_submitted" };

  const base =
    input.request_id === OPEN_REQUEST.id
      ? OPEN_REQUEST
      : openRequests().find((r) => r.id === input.request_id);
  if (!base) return { ok: false, error: "request_not_found" };

  // Contract parity: every photo path must live under the demo client's own
  // prefix and this very request id (a foreign prefix is a 400 upstream).
  const ownPhotos = input.photos.filter((p) =>
    isOwnCheckinPhotoPath(p, DEMO_CLIENT_ID, input.request_id)
  );

  state.seq += 1;
  const submissionId = `demo-submission-new-${state.seq}`;
  const now = new Date().toISOString();

  const request: CheckinRequestItem = {
    ...base,
    status: "submitted",
    submitted: true,
    submission_id: submissionId,
    submitted_at: now,
    demo: true,
  };

  const submission: CheckinSubmissionView = {
    id: submissionId,
    request_id: input.request_id,
    submitted_at: now,
    weight_kg: input.weight_kg,
    measurements: input.measurements,
    training_days_made: input.training_days_made,
    workout_pct: input.workout_pct,
    nutrition_pct: input.nutrition_pct,
    energy: input.energy,
    sleep: input.sleep,
    difficulties: input.difficulties || null,
    feedback: input.feedback || null,
    photos: ownPhotos.map((path) => ({
      path,
      url: demoPhotoUrl("uploaded"),
      expires_at: new Date(
        Date.now() + CHECKIN_SIGNED_URL_TTL * 1000
      ).toISOString(),
      demo: true,
    })),
    review: { status: "pending", feedback: null, updated_at: null },
    demo: true,
  };

  submitted.push({ request, submission });
  return { ok: true, submission_id: submissionId };
}

/**
 * Simulated upload: returns the canonical own-prefix object path. No bytes
 * are stored anywhere (zero network); the file name is embedded so the path
 * stays realistic for the submit contract.
 */
export function demoCheckinUploadPath(
  requestId: string,
  filename: string
): string {
  const state = stateFor();
  state.seq += 1;
  const safe = filename
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(0, 60);
  return `checkin-photos/${DEMO_CLIENT_ID}/${requestId}/${Date.now().toString(
    36
  )}-${state.seq}-${safe || "photo.jpg"}`;
}
