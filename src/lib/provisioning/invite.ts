import "server-only";

import { demoProvisioningRetryInvite, demoProvisioningSendInvite } from "@/lib/demo/provisioning";
import { isDemoMode } from "@/lib/mode";
import { sanitizeError } from "@/lib/integrations/contracts";
import { usableEmail } from "@/lib/provisioning/email";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Invitation state machine (Task 2.5).

   State lives on the `clients` row (migration 004):
     invite_status     'pending' | 'sent' | 'accepted' | 'failed'
     invite_attempts   int (capped at INVITE_MAX_ATTEMPTS)
     invite_last_sent_at timestamptz

   Transitions:
     pending --sendInvite--> sent | failed
     sent    --first authorized portal login--> accepted  (idempotent flip,
               implemented in acceptInviteByUser and wired into the EXISTING
               /auth/callback route, guarded by the just-established session)
     failed  --retryInvite--> sent | failed

   Delivery decision (ambiguity resolution, documented in the task report):
     - User existence is deduped via auth.admin.listUsers BEFORE any send
       (provision-client.ts) — inviteUserByEmail is NEVER the creation path,
       because its upsert semantics would mint unconfirmed users we do not
       control.
     - inviteUserByEmail(email, { redirectTo: <site>/portal }) is the primary
       DELIVERY API. For an already-confirmed user GoTrue answers 422
       "already registered"; the fallback is a server-side magic-link send
       (signInWithOtp, shouldCreateUser: false) so an existing user still
       receives a working portal link instead of a dead end.
     - Without SMTP configured, GoTrue accepts the send and silently drops
       the mail — invite_status='sent' honestly records "GoTrue accepted",
       not "mail rendered". Documented in the probe runbook.
   ============================================================ */

export type InvitationState = "pending" | "sent" | "accepted" | "failed";

/** THREE attempts total: initial send + 2 retries (immediate → 2min → 5min). */
export const INVITE_MAX_ATTEMPTS = 3;

/** Portal landing page for the invite link. */
export const INVITE_REDIRECT_PATH = "/portal";

/**
 * Explicit public origin (Task 3 ruling: explicit public origin env at
 * cutover). Falls back to local dev — never derived from request headers.
 */
export function inviteRedirectOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Backoff floor between retries, indexed by attempts ALREADY made:
 *   0 sent → immediate, 1 sent → wait 2 min, 2 sent → wait 5 min.
 * An automatic scheduler is OUT of scope — retries are driven by an admin
 * route call or the notifications modal (Task 7 hook point).
 */
const RETRY_MIN_GAP_MS: readonly number[] = [0, 2 * 60_000, 5 * 60_000];

export type InviteResult = {
  ok: boolean;
  client_id: string;
  state: InvitationState;
  attempts?: number;
  /** true when the demo seam simulated the send (no network). */
  simulated?: boolean;
  /** Seconds until the next retry is allowed (backoff rejection). */
  retry_after_seconds?: number;
  error?: string;
};

type InviteClientRow = {
  id: string;
  email: string | null;
  auth_user_id: string | null;
  invite_status: InvitationState | null;
  invite_attempts: number | null;
  invite_last_sent_at: string | null;
};

const INVITE_COLUMNS =
  "id, email, auth_user_id, invite_status, invite_attempts, invite_last_sent_at";

async function loadInviteClient(
  service: SupabaseClient,
  clientId: string
): Promise<InviteClientRow | null> {
  const res = await service
    .from("clients")
    .select(INVITE_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  if (res.error) {
    console.error("[provisioning] invite client load failed", res.error.message);
    return null;
  }
  return (res.data as InviteClientRow | null) ?? null;
}

/**
 * Deliver the invite email. inviteUserByEmail first; on the
 * "already registered" class of error (user exists + confirmed), fall back to
 * a server-side magic link that never creates a user.
 */
async function deliverInviteEmail(
  service: SupabaseClient,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = `${inviteRedirectOrigin()}${INVITE_REDIRECT_PATH}`;

  const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!invited.error) return { ok: true };

  const message = invited.error.message ?? "";
  if (/already|registered|exists/i.test(message)) {
    const otp = await service.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    if (!otp.error) return { ok: true };
    return { ok: false, error: sanitizeError(otp.error.message) };
  }
  return { ok: false, error: sanitizeError(message) };
}

/** Shared send + state-machine write (used by sendInvite and retryInvite). */
async function dispatchInvite(
  service: SupabaseClient,
  client: InviteClientRow
): Promise<InviteResult> {
  const attempts = (client.invite_attempts ?? 0) + 1;
  const delivery = await deliverInviteEmail(
    service,
    (client.email as string).toLowerCase()
  );
  const state: InvitationState = delivery.ok ? "sent" : "failed";

  const upd = await service
    .from("clients")
    .update({
      invite_status: state,
      invite_attempts: attempts,
      invite_last_sent_at: new Date().toISOString(),
    })
    .eq("id", client.id);
  if (upd.error) {
    // The send happened; the state write failed. Log loudly — the repair pass
    // (repairProvisioning) re-derives and fixes the row state.
    console.error("[provisioning] invite state write failed", upd.error.message);
  }

  return {
    ok: delivery.ok,
    client_id: client.id,
    state,
    attempts,
    error: delivery.error,
  };
}

/**
 * Send the FIRST invite for a client (invite_status 'pending' → 'sent').
 * Idempotent: already-accepted invites are never re-sent.
 */
export async function sendInvite(clientId: string): Promise<InviteResult> {
  if (isDemoMode()) return demoProvisioningSendInvite(clientId);

  const service = tryCreateServiceClient();
  if (!service) {
    return { ok: false, client_id: clientId, state: "pending", error: "service_unavailable" };
  }

  const client = await loadInviteClient(service, clientId);
  if (!client) {
    return { ok: false, client_id: clientId, state: "pending", error: "client_not_found" };
  }
  if (!usableEmail(client.email)) {
    return {
      ok: false,
      client_id: clientId,
      state: client.invite_status ?? "pending",
      error: "missing_email",
    };
  }
  if (client.invite_status === "accepted") {
    return {
      ok: true,
      client_id: clientId,
      state: "accepted",
      attempts: client.invite_attempts ?? 0,
    };
  }
  return dispatchInvite(service, client);
}

/**
 * RETRY a failed/undelivered invite: max THREE attempts total, backoff
 * immediate → 2min → 5min measured from invite_last_sent_at. Driven by an
 * admin route call or the notifications modal (Task 7) — no scheduler.
 */
export async function retryInvite(clientId: string): Promise<InviteResult> {
  if (isDemoMode()) return demoProvisioningRetryInvite(clientId);

  const service = tryCreateServiceClient();
  if (!service) {
    return { ok: false, client_id: clientId, state: "pending", error: "service_unavailable" };
  }

  const client = await loadInviteClient(service, clientId);
  if (!client) {
    return { ok: false, client_id: clientId, state: "pending", error: "client_not_found" };
  }

  const attempts = client.invite_attempts ?? 0;
  if (client.invite_status === "accepted") {
    return { ok: true, client_id: clientId, state: "accepted", attempts };
  }
  if (attempts >= INVITE_MAX_ATTEMPTS) {
    return {
      ok: false,
      client_id: clientId,
      state: client.invite_status ?? "failed",
      attempts,
      error: "max_attempts_reached",
    };
  }
  if (!usableEmail(client.email)) {
    return {
      ok: false,
      client_id: clientId,
      state: client.invite_status ?? "pending",
      attempts,
      error: "missing_email",
    };
  }

  const gapMs = RETRY_MIN_GAP_MS[Math.min(attempts, RETRY_MIN_GAP_MS.length - 1)];
  if (gapMs > 0 && client.invite_last_sent_at) {
    const elapsed = Date.now() - Date.parse(client.invite_last_sent_at);
    if (elapsed < gapMs) {
      return {
        ok: false,
        client_id: clientId,
        state: client.invite_status ?? "pending",
        attempts,
        retry_after_seconds: Math.ceil((gapMs - elapsed) / 1000),
        error: "backoff",
      };
    }
  }

  return dispatchInvite(service, client);
}

/**
 * Idempotent 'accepted' flip on FIRST authorized portal login. Called from
 * the /auth/callback route ONLY with the auth user id taken from the
 * just-established session (never from request input) — that is the guard.
 * Rows already 'accepted' do not match the filter → repeat calls are no-ops.
 * Never throws: a failed flip must not break the login redirect.
 */
export async function acceptInviteByUser(authUserId: string): Promise<boolean> {
  if (isDemoMode()) return false; // demo has no auth callback flow

  const service = tryCreateServiceClient();
  if (!service) return false;

  try {
    const res = await service
      .from("clients")
      .update({ invite_status: "accepted" })
      .eq("auth_user_id", authUserId)
      .in("invite_status", ["pending", "sent"])
      .select("id");
    if (res.error) {
      console.error("[provisioning] invite accept flip failed", res.error.message);
      return false;
    }
    return (res.data?.length ?? 0) > 0;
  } catch (err) {
    console.error(
      "[provisioning] invite accept flip crashed",
      err instanceof Error ? err.message : "unknown"
    );
    return false;
  }
}
