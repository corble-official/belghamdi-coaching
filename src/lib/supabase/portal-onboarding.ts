import "server-only";

import { isDemoMode } from "@/lib/mode";
import type { PortalContext } from "./portal-context";
import { createPortalClient } from "./supabase-auth";

/**
 * Portal onboarding state — shared by the /portal/onboarding server page AND
 * GET /api/portal/onboarding so both surfaces answer identically.
 *
 * Demo path: zero Supabase — the simulated "pending onboarding" response is
 * built inline and gated on isDemoMode() (before any client construction).
 *
 * Live path: ALL reads run through the user JWT client (createPortalClient)
 * and rely on RLS (`bc_onboarding_requests_select` / the
 * `can_access_client(request.client_id)` chain on submissions). Ownership is
 * derived server-side from the session-resolved client id — this helper never
 * accepts a request id from a caller.
 */

export type OnboardingPrefill = {
  full_name: string;
  email: string;
  phone: string;
  fitness_goal: string;
  training_days: string;
  training_location: string;
  experience_level: string;
  health_notes: string;
};

export type OnboardingRequestState = {
  id: string;
  status: string;
  /**
   * Legacy Telegram-link token expiry. Informational only: the portal session
   * is the authentication here, so an expired token does NOT block the form.
   */
  expires_at: string | null;
};

export type OnboardingState = {
  demo: boolean;
  /** Latest own onboarding_requests row (null when the client has none). */
  request: OnboardingRequestState | null;
  /** Submission already recorded for the latest request (unique per request). */
  submission: { id: string; submitted_at: string | null } | null;
  prefill: OnboardingPrefill;
  /** False when the authenticated user has no linked clients row. */
  hasLinkedClient: boolean;
};

/** Statuses that mean "this client is done onboarding". */
const COMPLETED_STATUSES = ["completed", "completed_late"] as const;

export function isOnboardingCompleted(status: string): boolean {
  return (COMPLETED_STATUSES as readonly string[]).includes(status);
}

/** Empty prefill — keeps the form nil-safe when profile fields are missing. */
const emptyPrefill = (): OnboardingPrefill => ({
  full_name: "",
  email: "",
  phone: "",
  fitness_goal: "",
  training_days: "",
  training_location: "",
  experience_level: "",
  health_notes: "",
});

/** Demo simulation: always "sent" (open), never submitted. No network. */
export function demoOnboardingState(): OnboardingState {
  return {
    demo: true,
    request: { id: "demo-onboarding-request", status: "sent", expires_at: null },
    submission: null,
    // Demo identity mirrors portal-context's DEMO_CLIENT.
    prefill: {
      ...emptyPrefill(),
      full_name: "عميل تجريبي",
      email: "demo@fitforgecoaching.com",
    },
    hasLinkedClient: true,
  };
}

const strOr = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

export async function getOnboardingState(
  ctx: PortalContext
): Promise<OnboardingState> {
  // ---- Demo path: build the simulated response inline, no Supabase calls ----
  if (isDemoMode()) {
    return demoOnboardingState();
  }

  // Nothing to resolve without a verified session (callers redirect first).
  if (ctx.demo || !ctx.authed) {
    return {
      demo: false,
      request: null,
      submission: null,
      prefill: emptyPrefill(),
      hasLinkedClient: false,
    };
  }

  const supabase = await createPortalClient();
  // Session-derived id — never a value supplied by a request body.
  const clientId = ctx.client.id;

  if (!clientId) {
    // No linked client record → no request can exist → nothing pending.
    return {
      demo: false,
      request: null,
      submission: null,
      prefill: {
        ...emptyPrefill(),
        full_name: ctx.client.full_name,
        email: ctx.client.email,
      },
      hasLinkedClient: false,
    };
  }

  // Latest own request. Ownership: `.eq("client_id", clientId)` where the id
  // is session-derived (portal context).
  const reqRes = await supabase
    .from("onboarding_requests")
    .select("id, client_id, status, sent_at, token_expires_at")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1);

  const request = (reqRes.data?.[0] as
    | {
        id: string;
        client_id: string;
        status: string;
        token_expires_at: string | null;
      }
    | undefined) ?? null;

  // Profile prefill fields (live contract; single read, fails soft).
  const clientRes = await supabase
    .from("clients")
    .select(
      "full_name, email, phone, fitness_goal, training_days, training_location, experience_level, notes"
    )
    .eq("id", clientId)
    .limit(1);

  const client =
    (clientRes.data?.[0] as Record<string, unknown> | undefined) ?? null;

  const prefill: OnboardingPrefill = {
    full_name: strOr(client?.full_name, ctx.client.full_name),
    email: ctx.client.email || strOr(client?.email),
    phone: strOr(client?.phone),
    fitness_goal: strOr(client?.fitness_goal),
    training_days: strOr(client?.training_days),
    training_location: strOr(client?.training_location),
    experience_level: strOr(client?.experience_level),
    health_notes: strOr(client?.notes),
  };

  if (!request) {
    return {
      demo: false,
      request: null,
      submission: null,
      prefill,
      hasLinkedClient: true,
    };
  }

  // Existing submission on the latest request. `request_id` is UNIQUE in the
  // live schema, so at most one row comes back (RLS via can_access_client).
  const subRes = await supabase
    .from("onboarding_submissions")
    .select("id, submitted_at")
    .eq("request_id", request.id)
    .limit(1);

  const submission = (subRes.data?.[0] as
    | { id: string; submitted_at: string | null }
    | undefined) ?? null;

  return {
    demo: false,
    request: {
      id: request.id,
      status: request.status,
      expires_at: request.token_expires_at ?? null,
    },
    submission,
    prefill,
    hasLinkedClient: true,
  };
}
