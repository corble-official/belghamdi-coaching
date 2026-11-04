import "server-only";

import {
  demoProvisionFromOrder,
  demoRepairProvisioning,
} from "@/lib/demo/provisioning";
import { isDemoMode } from "@/lib/mode";
import { sanitizeError, type Bc03OrderEvent } from "@/lib/integrations/contracts";
import { usableEmail } from "@/lib/provisioning/email";
import { sendInvite, type InvitationState } from "@/lib/provisioning/invite";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Account provisioning pipeline (Task 2.5) — BC-03 order events → identity.

   Binding architecture: Purchase ≠ Identity ≠ Entitlements.
   Activation happens ONLY on the verified Shopify event (this pipeline),
   never from portal actions. This module is a THIN WRAPPER over the
   EXISTING `process_order_event(jsonb)` SEC DEFINER RPC — client
   find-or-create, ledger dedupe, subscription upsert and onboarding
   creation stay ENTIRELY inside the RPC; nothing here reimplements them.
   Identity (auth user + profile + invite) is layered on the RPC's result.

   RPC contract (verified against the LIVE n8n BC-03 workflow, node
   "Register Verified Order"): PostgREST param name is `p_evt`; the result
   JSON carries at least { success, duplicate, client_code, ... } plus
   client_id/event_id when present. Parsing is defensive: fields we depend
   on are re-derived from the DB (resolveClient re-reads the row) instead
   of trusting the result shape.

   Transactionality: PostgREST is not transactional across endpoints, so
   the pipeline is a sequence of idempotent steps. Event dedupe is already
   transactional INSIDE process_order_event (UNIQUE ledger triple); the
   subscription_events mirror append is idempotent by the generated
   UNIQUE idempotency_key (coalesce(event_id,'n/a'):event_type). A crash
   between any two calls SELF-HEALS on the NEXT delivery of the same
   event: the RPC then answers duplicate=true, and the ensure-* steps
   below re-run and fill only what is still missing.

   Runs via service role ONLY (supabase-service.ts is the sole reader of
   SUPABASE_SERVICE_ROLE_KEY). Demo mode: zero network/Supabase/auth.
   ============================================================ */

/** Exact interface per the task brief. */
export type ProvisionResult = {
  status: "provisioned" | "pending_email" | "renewed_existing" | "duplicate_ignored" | "error";
  /** true when the order is verified but the pending-email gate blocks identity. */
  staged?: boolean;
  client_id?: string;
  auth_user_id?: string | null;
  invite_state?: InvitationState;
  dedupe_marker?: boolean;
  error?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Defensive parse of the process_order_event result JSON. */
type OrderEventRpcResult = {
  success?: boolean;
  status?: string;
  duplicate?: boolean;
  event_id?: string | null;
  client_id?: string | null;
  client_code?: string | null;
  error?: string | null;
  kind?: string | null;
};

type ClientRow = {
  id: string;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
  shopify_customer_id: number | string | null;
  email_collected_source: string | null;
  onboarding_completed: boolean | null;
  invite_status: InvitationState | null;
  invite_attempts: number | null;
};

const CLIENT_COLUMNS =
  "id, email, phone, auth_user_id, shopify_customer_id, email_collected_source, onboarding_completed, invite_status, invite_attempts";

type IdentityOpts = {
  customer_name?: string | null;
  shopify_customer_id?: number | null;
};

function parseRpcResult(data: unknown): OrderEventRpcResult {
  if (!data || typeof data !== "object") return {};
  return data as OrderEventRpcResult;
}

/**
 * Resolve the client row the RPC created/matched. Trusts an explicit
 * client_id from the result, then re-derives via the RPC's own
 * telegram → email → phone fallback chain (never forks the RPC logic).
 */
async function resolveClient(
  service: SupabaseClient,
  r: OrderEventRpcResult,
  event: Bc03OrderEvent
): Promise<ClientRow | null> {
  if (typeof r.client_id === "string" && UUID_RE.test(r.client_id)) {
    const byId = await service
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("id", r.client_id)
      .maybeSingle();
    if (!byId.error && byId.data) return byId.data as ClientRow;
  }

  const email = usableEmail(event.email);
  if (email) {
    const byEmail = await service
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("email", email)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data as ClientRow;
  }

  if (typeof event.telegram_user_id === "number") {
    const byTg = await service
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("telegram_user_id", event.telegram_user_id)
      .maybeSingle();
    if (!byTg.error && byTg.data) return byTg.data as ClientRow;
  }

  const phone = (event.phone ?? "").trim();
  if (phone) {
    const byPhone = await service
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("phone", phone)
      .maybeSingle();
    if (!byPhone.error && byPhone.data) return byPhone.data as ClientRow;
  }

  return null;
}

/**
 * Frozen decision #1: no usable email ⇒ client row EXISTS (the RPC created
 * it) but NO auth identity, NO invite. The coach collects the email via an
 * admin 'missing_email' notification (dedupe-keyed per order_ref).
 */
async function insertMissingEmailNotification(
  service: SupabaseClient,
  clientId: string,
  orderRef: string
): Promise<void> {
  const dedupeKey = `missing_email:${orderRef}`;
  try {
    const existing = await service
      .from("notifications")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing.data) return;

    const ins = await service.from("notifications").insert({
      audience_role: "admin",
      kind: "missing_email",
      title: "Missing client email",
      body: `Verified order ${orderRef} has no usable email on the client row — collect the email to provision portal access.`,
      metadata: { client_id: clientId, order_ref: orderRef },
      dedupe_key: dedupeKey,
    });
    if (ins.error) {
      console.error("[provisioning] missing_email notification failed", ins.error.message);
    }
  } catch (err) {
    console.error(
      "[provisioning] missing_email notification crashed",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

/**
 * Step 6 — reconciliation mirror into subscription_events. Idempotent by the
 * GENERATED idempotency_key (coalesce(event_id,'n/a'):event_type): pass the
 * ledger event id (falls back to order_ref) so every delivery of the same
 * order+type collides on the same key. Crash-between-calls self-heals on the
 * next delivery — the mirror append re-runs and lands on DO NOTHING.
 */
async function appendSubscriptionMirror(
  service: SupabaseClient,
  clientId: string,
  r: OrderEventRpcResult,
  event: Bc03OrderEvent
): Promise<void> {
  const eventType = event.kind === "renewal" ? "renewed" : "payment_verified";
  const eventId =
    typeof r.event_id === "string" && r.event_id ? r.event_id : event.order_ref;
  const integrationEventId =
    typeof r.event_id === "string" && UUID_RE.test(r.event_id) ? r.event_id : null;

  try {
    const ins = await service
      .from("subscription_events")
      .upsert(
        {
          client_id: clientId,
          event_id: eventId,
          event_type: eventType,
          source: "shopify",
          occurred_at: new Date().toISOString(),
          payload_reference: event.order_ref,
          integration_event_id: integrationEventId,
        },
        // ON CONFLICT (idempotency_key) DO NOTHING — the generated-column
        // UNIQUE is the crash-recovery dedupe; DO NOTHING on collision.
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      );
    if (ins.error) {
      // Non-fatal: the next delivery of the same event re-attempts (DO NOTHING).
      console.error(
        "[provisioning] subscription_events mirror failed (self-heals on next delivery)",
        ins.error.message
      );
    }
  } catch (err) {
    console.error(
      "[provisioning] subscription_events mirror crashed (self-heals on next delivery)",
      err instanceof Error ? err.message : "unknown"
    );
  }
}

/**
 * Find an auth user by EXACT email (case-insensitive) via paginated
 * auth.admin.listUsers. Decision (documented in the task report): the admin
 * list is the authoritative dedupe — inviteUserByEmail's upsert semantics
 * are NOT used for creation because they mint unconfirmed users outside our
 * control. Bounded scan (20 × 200) — the client base is small; never
 * creates duplicates.
 */
async function findAuthUserIdByEmail(
  service: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[provisioning] listUsers failed", error.message);
      return null;
    }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

/**
 * Steps 4 (+ clients binding) — ensure exactly ONE auth identity per email
 * and bind it on the clients row. All writes idempotent; never overwrites an
 * existing shopify_customer_id with a different value.
 */
async function ensureIdentity(
  service: SupabaseClient,
  client: ClientRow,
  email: string,
  opts: IdentityOpts
): Promise<{ auth_user_id: string | null; invite_status: InvitationState | null; changed: boolean; error?: string }> {
  let authUserId = client.auth_user_id;
  let changed = false;

  if (!authUserId) {
    authUserId = await findAuthUserIdByEmail(service, email);
    if (!authUserId) {
      // email_confirm: true — invite flow: the account is immediately usable
      // via the invite/magic link, no separate confirmation round-trip.
      const created = await service.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: opts.customer_name ?? null,
          source: "shopify_order",
        },
      });
      if (created.error) {
        // Race: a concurrent delivery may have created it — re-list once.
        const retry = await findAuthUserIdByEmail(service, email);
        if (!retry) {
          return {
            auth_user_id: null,
            invite_status: client.invite_status,
            changed,
            error: sanitizeError(created.error.message),
          };
        }
        authUserId = retry;
      } else {
        authUserId = created.data.user?.id ?? null;
        changed = true;
      }
    }
    if (!authUserId) {
      return {
        auth_user_id: null,
        invite_status: client.invite_status,
        changed,
        error: "auth_user_unresolved",
      };
    }
  }

  const patch: Record<string, unknown> = {};
  if (client.auth_user_id !== authUserId) patch.auth_user_id = authUserId;
  if (client.email_collected_source !== "shopify_order") {
    patch.email_collected_source = "shopify_order";
  }
  const shopCid = opts.shopify_customer_id;
  if (shopCid != null && (client.shopify_customer_id == null || client.shopify_customer_id === 0)) {
    patch.shopify_customer_id = shopCid;
  }

  if (Object.keys(patch).length > 0) {
    const upd = await service.from("clients").update(patch).eq("id", client.id).select("id");
    if (upd.error) {
      return {
        auth_user_id: authUserId,
        invite_status: client.invite_status,
        changed,
        error: sanitizeError(upd.error.message),
      };
    }
    changed = true;
  }

  return { auth_user_id: authUserId, invite_status: client.invite_status, changed };
}

/**
 * Step 5 — profile row via SERVICE path (bypasses RLS; the self-insert
 * policy cannot claim a client binding by design). ON CONFLICT (id) DO
 * NOTHING keeps re-runs idempotent.
 */
async function ensureProfile(
  service: SupabaseClient,
  clientId: string,
  authUserId: string,
  email: string,
  fullName: string | null
): Promise<boolean> {
  try {
    const ins = await service
      .from("profiles")
      .upsert(
        {
          id: authUserId,
          role: "client",
          client_id: clientId,
          email,
          full_name: fullName,
        },
        // ON CONFLICT (id) DO NOTHING — re-runs and repair passes are no-ops.
        { onConflict: "id", ignoreDuplicates: true }
      )
      .select("id");
    if (ins.error) {
      console.error("[provisioning] profile insert failed", ins.error.message);
      return false;
    }
    return (ins.data?.length ?? 0) > 0;
  } catch (err) {
    console.error(
      "[provisioning] profile insert crashed",
      err instanceof Error ? err.message : "unknown"
    );
    return false;
  }
}

/**
 * The pipeline. HMAC authenticity is guaranteed upstream (the webhook route
 * verified X-BC-Signature) — deliberately NOT re-verified here.
 */
export async function provisionFromOrder(
  event: Bc03OrderEvent
): Promise<ProvisionResult> {
  // Demo: zero network/Supabase/auth — simulated seam, rows flagged demo.
  if (isDemoMode()) return demoProvisionFromOrder(event);

  if (event.event_type !== "order_verified") {
    return { status: "error", error: `unsupported_event_type:${event.event_type ?? "null"}` };
  }

  const service = tryCreateServiceClient();
  if (!service) return { status: "error", error: "service_unavailable" };

  // Step 2 — thin wrapper over the EXISTING SEC DEFINER RPC (param `p_evt`).
  let rpcData: unknown;
  try {
    const res = await service.rpc("process_order_event", { p_evt: { ...event } });
    if (res.error) {
      return { status: "error", error: sanitizeError(res.error.message) };
    }
    rpcData = res.data;
  } catch (err) {
    return {
      status: "error",
      error: sanitizeError(err instanceof Error ? err.message : String(err)),
    };
  }

  const r = parseRpcResult(rpcData);
  if (r.success !== true) {
    return {
      status: "error",
      error: sanitizeError(r.error ?? "") || "process_order_event_returned_failure",
    };
  }
  const duplicate = r.duplicate === true;

  const client = await resolveClient(service, r, event);
  if (!client) {
    return {
      status: "error",
      client_id: typeof r.client_id === "string" ? r.client_id : undefined,
      error: "client_row_unresolved",
    };
  }

  // Step 3 — frozen email gate.
  const email = usableEmail(event.email) ?? usableEmail(client.email);
  if (!email) {
    await insertMissingEmailNotification(service, client.id, event.order_ref);
    return {
      status: "pending_email",
      staged: true,
      client_id: client.id,
      auth_user_id: client.auth_user_id,
      invite_state: client.invite_status ?? "pending",
    };
  }

  // Step 6 — entitlement mirror (idempotent; safe on every delivery).
  await appendSubscriptionMirror(service, client.id, r, event);

  // Step 8 — renewal of an existing ONBOARDED client: no identity work.
  if (event.kind === "renewal" && client.onboarding_completed && client.auth_user_id) {
    return {
      status: "renewed_existing",
      client_id: client.id,
      auth_user_id: client.auth_user_id,
      invite_state: client.invite_status ?? "accepted",
      dedupe_marker: duplicate,
    };
  }

  // Steps 4-7 — identity, profile, invite (idempotent; replays self-heal).
  const identity = await ensureIdentity(service, client, email, {
    customer_name: event.customer_name ?? null,
    shopify_customer_id: event.shopify_customer_id ?? null,
  });
  if (identity.error || !identity.auth_user_id) {
    return {
      status: "error",
      client_id: client.id,
      error: identity.error ?? "identity_unresolved",
    };
  }

  const profileInserted = await ensureProfile(
    service,
    client.id,
    identity.auth_user_id,
    email,
    event.customer_name ?? null
  );

  let inviteState: InvitationState = identity.invite_status ?? "pending";
  let inviteSent = false;
  if (inviteState === "pending") {
    const sent = await sendInvite(client.id);
    inviteState = sent.state;
    inviteSent = sent.ok;
  }

  const changed = identity.changed || profileInserted || inviteSent;
  return {
    // Replay of a fully-provisioned order → ledger dedupe marker. Replay that
    // COMPLETED missing identity work → provisioned (self-heal evidence).
    status: duplicate && !changed ? "duplicate_ignored" : "provisioned",
    client_id: client.id,
    auth_user_id: identity.auth_user_id,
    invite_state: inviteState,
    dedupe_marker: duplicate,
  };
}

/**
 * Step 9 — safe recovery: fill ANY missing piece (auth user, clients
 * binding, profile row, invite) idempotently for staged clients or clients
 * with an email but no auth_user_id. Hook point: Task 7 admin drawer
 * "Repair provisioning" action button (route to be added there; this helper
 * is the entire server-side implementation it needs).
 */
export async function repairProvisioning(clientId: string): Promise<ProvisionResult> {
  if (isDemoMode()) return demoRepairProvisioning(clientId);

  const service = tryCreateServiceClient();
  if (!service) return { status: "error", error: "service_unavailable" };

  const res = await service
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  if (res.error || !res.data) {
    return { status: "error", error: res.error ? sanitizeError(res.error.message) : "client_not_found" };
  }
  const client = res.data as ClientRow;

  const email = usableEmail(client.email);
  if (!email) {
    await insertMissingEmailNotification(service, client.id, `repair-${client.id}`);
    return {
      status: "pending_email",
      staged: true,
      client_id: client.id,
      invite_state: client.invite_status ?? "pending",
    };
  }

  const identity = await ensureIdentity(service, client, email, {});
  if (identity.error || !identity.auth_user_id) {
    return {
      status: "error",
      client_id: client.id,
      error: identity.error ?? "identity_unresolved",
    };
  }

  const profileInserted = await ensureProfile(
    service,
    client.id,
    identity.auth_user_id,
    email,
    null
  );

  let inviteState: InvitationState = identity.invite_status ?? "pending";
  let inviteSent = false;
  if (inviteState === "pending") {
    const sent = await sendInvite(client.id);
    inviteState = sent.state;
    inviteSent = sent.ok;
  }

  const changed = identity.changed || profileInserted || inviteSent;
  return {
    status: changed ? "provisioned" : "duplicate_ignored",
    client_id: client.id,
    auth_user_id: identity.auth_user_id,
    invite_state: inviteState,
    dedupe_marker: !changed,
  };
}
