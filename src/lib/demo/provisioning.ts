/**
 * Demo-mode simulation for Task 2.5 provisioning.
 *
 * In-memory only — globalThis-pinned store living as long as the dev server
 * (same pattern as portal-renewal.ts / portal-checkins.ts). ZERO Supabase,
 * auth, or network by design: isDemoMode() guards every caller, and no
 * Supabase client is ever constructed on the demo path. Every row is flagged
 * `demo: true` so demo data stays distinguishable from real client data
 * (house rule from src/lib/demo/admin-store.ts).
 *
 * Simulated pipeline (mirrors the live one step-for-step):
 *   - ledger dedupe   → replayed order_ref returns duplicate_ignored
 *   - email gate      → no usable email ⇒ pending_email + demo
 *                       missing_email notification row (dedupe-keyed)
 *   - identity        → one demo auth identity per email, never duplicated
 *   - invite          → invite_state 'sent' on provision
 *   - renewal         → onboarded demo client ⇒ renewed_existing, no 2nd identity
 *   - self-heal       → replay of a staged (pending_email) order WITH an email
 *                       now attached completes the identity (mirrors the live
 *                       idempotent re-run on redelivery)
 */
import type { Bc03OrderEvent } from "@/lib/integrations/contracts";
import { usableEmail } from "@/lib/provisioning/email";
import type { InvitationState, InviteResult } from "@/lib/provisioning/invite";
import type { ProvisionResult } from "@/lib/provisioning/provision-client";

/** Keep in sync with INVITE_MAX_ATTEMPTS in src/lib/provisioning/invite.ts. */
const DEMO_INVITE_MAX_ATTEMPTS = 3;

export type DemoProvisionRow = {
  order_ref: string;
  client_id: string;
  email: string | null;
  auth_user_id: string | null;
  invite_state: InvitationState;
  invite_attempts: number;
  onboarded: boolean;
  provisioned_at: string;
  demo: true;
};

export type DemoProvisionNotifRow = {
  id: string;
  kind: "missing_email";
  audience_role: "admin";
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  dedupe_key: string;
  read: boolean;
  created_at: string;
  demo: true;
};

type DemoProvisionStore = {
  seq: number;
  /** order_ref → simulated client/provision state */
  orders: Record<string, DemoProvisionRow>;
  /** client_id → same row (one identity, many orders) */
  clients: Record<string, DemoProvisionRow>;
  notifications: DemoProvisionNotifRow[];
};

declare global {
  // eslint-disable-next-line no-var
  var __bc_demo_provisioning_v1: DemoProvisionStore | undefined;
}

const store: DemoProvisionStore = (globalThis.__bc_demo_provisioning_v1 ??= {
  seq: 0,
  orders: {},
  clients: {},
  notifications: [],
});

function stageRow(orderRef: string, email: string | null): DemoProvisionRow {
  const clientId = `demo-client-${++store.seq}`;
  const row: DemoProvisionRow = {
    order_ref: orderRef,
    client_id: clientId,
    email,
    auth_user_id: null,
    invite_state: "pending",
    invite_attempts: 0,
    onboarded: false,
    provisioned_at: new Date().toISOString(),
    demo: true,
  };
  store.orders[orderRef] = row;
  store.clients[clientId] = row;
  return row;
}

function pushMissingEmailNotification(row: DemoProvisionRow): void {
  const dedupeKey = `missing_email:${row.order_ref}`;
  if (store.notifications.some((n) => n.dedupe_key === dedupeKey)) return;
  store.notifications.push({
    id: `demo-notif-${++store.seq}`,
    kind: "missing_email",
    audience_role: "admin",
    title: "Missing client email",
    body: `Verified order ${row.order_ref} has no usable email on the client row — collect the email to provision portal access.`,
    metadata: { client_id: row.client_id, order_ref: row.order_ref },
    dedupe_key: dedupeKey,
    read: false,
    created_at: new Date().toISOString(),
    demo: true,
  });
}

/** Simulated provisionFromOrder — zero network, deterministic replay. */
export function demoProvisionFromOrder(event: Bc03OrderEvent): ProvisionResult {
  const seen = store.orders[event.order_ref];

  if (seen) {
    // Self-heal sim: replay of a staged order that NOW carries the email
    // completes the identity (live: idempotent re-run on redelivery).
    const email = usableEmail(event.email);
    if (seen.auth_user_id === null && email) {
      seen.email = email;
      seen.auth_user_id = `demo-auth-${++store.seq}`;
      seen.invite_state = "sent";
      seen.invite_attempts += 1;
      return {
        status: "provisioned",
        client_id: seen.client_id,
        auth_user_id: seen.auth_user_id,
        invite_state: "sent",
        dedupe_marker: true,
      };
    }
    return {
      status: "duplicate_ignored",
      client_id: seen.client_id,
      auth_user_id: seen.auth_user_id,
      invite_state: seen.invite_state,
      dedupe_marker: true,
    };
  }

  const email = usableEmail(event.email);
  const isRenewal = event.kind === "renewal";

  // Email gate (frozen decision #1): stage the client, no identity, no invite.
  if (!email) {
    const row = stageRow(event.order_ref, null);
    pushMissingEmailNotification(row);
    return {
      status: "pending_email",
      staged: true,
      client_id: row.client_id,
      auth_user_id: null,
      invite_state: "pending",
    };
  }

  // One identity, many orders: match an existing demo client by email.
  const existing = Object.values(store.clients).find(
    (c) => c.email?.toLowerCase() === email
  );

  if (existing) {
    // Renewal of an already-onboarded client → no identity work at all.
    if (isRenewal && existing.onboarded && existing.auth_user_id !== null) {
      return {
        status: "renewed_existing",
        client_id: existing.client_id,
        auth_user_id: existing.auth_user_id,
        invite_state: existing.invite_state,
        dedupe_marker: false,
      };
    }
    // Bind the new order to the existing client; complete a missing identity.
    store.orders[event.order_ref] = existing;
    if (existing.auth_user_id === null) {
      existing.auth_user_id = `demo-auth-${++store.seq}`;
      existing.invite_state = "sent";
      existing.invite_attempts += 1;
    }
    return {
      status: "provisioned",
      client_id: existing.client_id,
      auth_user_id: existing.auth_user_id,
      invite_state: existing.invite_state,
    };
  }

  // Fresh client: provision identity + invite in one simulated step.
  const row = stageRow(event.order_ref, email);
  row.auth_user_id = `demo-auth-${++store.seq}`;
  row.invite_state = "sent";
  row.invite_attempts = 1;
  return {
    status: "provisioned",
    client_id: row.client_id,
    auth_user_id: row.auth_user_id,
    invite_state: "sent",
  };
}

/** Simulated repairProvisioning — fills missing identity/invite for a demo client. */
export function demoRepairProvisioning(clientId: string): ProvisionResult {
  const row = store.clients[clientId];
  if (!row) return { status: "error", error: "client_not_found" };
  if (!row.email) {
    pushMissingEmailNotification(row);
    return {
      status: "pending_email",
      staged: true,
      client_id: row.client_id,
      invite_state: row.invite_state,
    };
  }

  let changed = false;
  if (row.auth_user_id === null) {
    row.auth_user_id = `demo-auth-${++store.seq}`;
    changed = true;
  }
  if (row.invite_state === "pending") {
    row.invite_state = "sent";
    row.invite_attempts += 1;
    changed = true;
  }
  return {
    status: changed ? "provisioned" : "duplicate_ignored",
    client_id: row.client_id,
    auth_user_id: row.auth_user_id,
    invite_state: row.invite_state,
    dedupe_marker: !changed,
  };
}

/** Simulated sendInvite (demo branch of src/lib/provisioning/invite.ts). */
export function demoProvisioningSendInvite(clientId: string): InviteResult {
  const row = store.clients[clientId];
  if (!row) {
    return { ok: false, client_id: clientId, state: "pending", error: "client_not_found" };
  }
  if (!row.email) {
    return { ok: false, client_id: clientId, state: row.invite_state, error: "missing_email" };
  }
  if (row.invite_state === "accepted") {
    return { ok: true, client_id: clientId, state: "accepted", attempts: row.invite_attempts };
  }
  row.invite_state = "sent";
  row.invite_attempts += 1;
  return {
    ok: true,
    client_id: clientId,
    state: "sent",
    attempts: row.invite_attempts,
    simulated: true,
  };
}

/** Simulated retryInvite (demo branch) — honors the same 3-attempt cap. */
export function demoProvisioningRetryInvite(clientId: string): InviteResult {
  const row = store.clients[clientId];
  if (!row) {
    return { ok: false, client_id: clientId, state: "pending", error: "client_not_found" };
  }
  if (row.invite_state === "accepted") {
    return { ok: true, client_id: clientId, state: "accepted", attempts: row.invite_attempts };
  }
  if (row.invite_attempts >= DEMO_INVITE_MAX_ATTEMPTS) {
    return {
      ok: false,
      client_id: clientId,
      state: row.invite_state,
      attempts: row.invite_attempts,
      error: "max_attempts_reached",
    };
  }
  if (!row.email) {
    return {
      ok: false,
      client_id: clientId,
      state: row.invite_state,
      attempts: row.invite_attempts,
      error: "missing_email",
    };
  }
  row.invite_state = "sent";
  row.invite_attempts += 1;
  return {
    ok: true,
    client_id: clientId,
    state: "sent",
    attempts: row.invite_attempts,
    simulated: true,
  };
}
