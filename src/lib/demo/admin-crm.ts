/**
 * Demo-mode CRM simulations (Task 7).
 *
 * In-memory, module-scope state — lives as long as the dev server.
 * ZERO Supabase/network by design: every caller is guarded by isDemoMode()
 * before this module is touched, mirroring src/lib/demo/admin-store.ts.
 *
 * Every row carries `demo: true` so simulated data stays distinguishable
 * from real client data (house rule). No n8n/workflow touches — simulated
 * overrides and notifications are recorded in a local "outbox" ONLY.
 */
import type {
  CheckinColumnRow,
  ConversationMessageRow,
  LedgerEventRow,
  OverrideAction,
  ReviewFeedbackRow,
  TimelineRow,
} from "@/lib/admin/types";
import { demoChatThread } from "@/lib/demo/portal-chat";
import type { ProgressRecord } from "@/lib/types";

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Override outbox + admin notifications
 * ------------------------------------------------------------------ */

export type DemoOverrideEvent = {
  id: string;
  client_id: string;
  client_name: string;
  action: OverrideAction | "request_override";
  payload: string;
  at: string;
  demo: true;
};

export type DemoNotificationRow = {
  id: string;
  audience_role: "admin" | "coach" | "coach_assistant";
  client_id: string | null;
  client_name: string | null;
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
  demo: true;
};

const overrideOutbox: DemoOverrideEvent[] = [];
const notifications: DemoNotificationRow[] = [
  {
    id: "demo-notif-1",
    audience_role: "admin",
    client_id: "cl-0511",
    client_name: "Nadia Rami",
    kind: "override_request",
    title: "Coach requested an override",
    body: "Nadia Rami (sb-0210): replying to 'extend 7 days' — renewal lands before her last payment verified.",
    created_at: now(),
    read: false,
    demo: true,
  },
  {
    id: "demo-notif-2",
    audience_role: "admin",
    client_id: null,
    client_name: null,
    kind: "error",
    title: "Automation errors need annotation",
    body: "The Automation Center lists open errors — record resolutions there (this is a simulated notice).",
    created_at: now(),
    read: false,
    demo: true,
  },
];

const salesNotifications: {
  id: string;
  lead_id: string | null;
  qualified: boolean;
  handoff: boolean;
  success: boolean;
  error: string | null;
  created_at: string;
  demo: true;
}[] = [
  {
    id: "demo-sales-1",
    lead_id: "demo-lead-1",
    qualified: true,
    handoff: false,
    success: true,
    error: null,
    created_at: now(),
    demo: true,
  },
  {
    id: "demo-sales-2",
    lead_id: "demo-lead-2",
    qualified: false,
    handoff: true,
    success: false,
    error: "Site-form lead never answered; handoff kept open (simulated).",
    created_at: now(),
    demo: true,
  },
];

export function demoOverrideOutbox(): DemoOverrideEvent[] {
  return [...overrideOutbox].reverse();
}

export function demoNotifications(): DemoNotificationRow[] {
  return [...notifications].reverse();
}

export function demoSalesNotifications(): typeof salesNotifications {
  return [...salesNotifications].reverse();
}

export function demoMarkNotificationRead(id: string): void {
  const row = notifications.find((n) => n.id === id);
  if (row) row.read = true;
}

/**
 * Simulated admin override: appends the outbox row + the admin-kind
 * notification. NEVER touches a network and never enters the store —
 * the subscription patch itself is applied by the page via
 * useAdminStore().updateSubscription (existing demo-store seam).
 */
export function demoOverrideSimulate(input: {
  client_id: string;
  client_name: string;
  action: OverrideAction;
  payload?: { extend_days?: number; reason?: string };
}): { event: DemoOverrideEvent; notification: DemoNotificationRow } {
  const at = now();
  const event: DemoOverrideEvent = {
    id: `demo-ovr-${Date.now()}`,
    client_id: input.client_id,
    client_name: input.client_name,
    action: input.action,
    payload: JSON.stringify(input.payload ?? {}),
    at,
    demo: true,
  };
  const notification: DemoNotificationRow = {
    id: `demo-notif-${Date.now()}`,
    audience_role: "admin",
    client_id: input.client_id,
    client_name: input.client_name,
    kind: "override",
    title: `Manual override — ${input.action}`,
    body: `${input.client_name}: subscription ${input.action} applied via the admin dashboard (demo outbox only).`,
    created_at: at,
    read: false,
    demo: true,
  };
  overrideOutbox.push(event);
  notifications.push(notification);
  return { event, notification };
}

/** Coach-drafted override request (demo simulation of the allowed action). */
export function demoRequestOverride(input: {
  client_id: string;
  client_name: string;
  payload?: { extend_days?: number; reason?: string };
}): DemoNotificationRow {
  const row: DemoNotificationRow = {
    id: `demo-notif-${Date.now()}`,
    audience_role: "admin",
    client_id: input.client_id,
    client_name: input.client_name,
    kind: "override_request",
    title: "Coach requested an override",
    body: `${input.client_name}: requested ${JSON.stringify(input.payload ?? {})}`,
    created_at: now(),
    read: false,
    demo: true,
  };
  notifications.push(row);
  return row;
}

/* ------------------------------------------------------------------ *
 * BC-99 automation errors + resolutions (demo)
 *
 * Mirrors the live `automation_errors` / `automation_error_resolutions`
 * columns (supabase/migrations/001_rbac.sql). The error rows are NEVER
 * mutated by the app — "resolve" appends to the resolutions ledger only
 * (same binding as live: `automation_errors` status/resolved_at stay
 * owned by the BC-99 n8n workflow).
 * ------------------------------------------------------------------ */

export type DemoAutomationErrorRow = {
  id: string;
  dedupe_key: string | null;
  workflow: string;
  execution_id: string | null;
  node_name: string | null;
  stage: string | null;
  error_message: string;
  severity: string;
  status: string;
  occurrences: number;
  notified: boolean;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  demo: true;
};

export type DemoErrorResolutionRow = {
  id: string;
  error_id: string;
  resolved_by: string | null;
  resolution_note: string;
  created_at: string;
  demo: true;
};

const automationErrors: DemoAutomationErrorRow[] = [
  {
    id: "demo-aerr-1",
    dedupe_key: "bc05-missed-checkin-telegram-timeout",
    workflow: "BC-05 — Missed Check-in Follow-up",
    execution_id: "184213",
    node_name: "Send Telegram reminder",
    stage: "24h_reminder",
    error_message:
      "Telegram send timed out after 12s for 3 recipients (simulated).",
    severity: "error",
    status: "open",
    occurrences: 3,
    notified: true,
    first_seen_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    resolved_at: null,
    demo: true,
  },
  {
    id: "demo-aerr-2",
    dedupe_key: "bc03-onboarding-missing-email",
    workflow: "BC-03 — Client Onboarding",
    execution_id: "184180",
    node_name: "Fetch order",
    stage: "onboarding_start",
    error_message:
      "Order customer has no email on file — onboarding message skipped (simulated).",
    severity: "warning",
    status: "open",
    occurrences: 1,
    notified: false,
    first_seen_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    resolved_at: null,
    demo: true,
  },
  {
    id: "demo-aerr-3",
    dedupe_key: "bc07-renewal-shopify-429",
    workflow: "BC-07 — Renewals",
    execution_id: "184102",
    node_name: "Shopify: list orders",
    stage: "renewal_sweep",
    error_message:
      "Shopify Admin API rate limit (429) during the renewal sweep (simulated).",
    severity: "error",
    status: "resolved",
    occurrences: 6,
    notified: true,
    first_seen_at: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    demo: true,
  },
];

const errorResolutions: DemoErrorResolutionRow[] = [
  {
    id: "demo-aer-1",
    error_id: "demo-aerr-3",
    resolved_by: null,
    resolution_note:
      "Rate-limit backoff added in BC-07; sweep re-ran clean overnight (simulated annotation).",
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    demo: true,
  },
];

export function demoAutomationErrors(): DemoAutomationErrorRow[] {
  return [...automationErrors].sort(
    (a, b) => b.last_seen_at.localeCompare(a.last_seen_at)
  );
}

export function demoErrorResolutions(): DemoErrorResolutionRow[] {
  return [...errorResolutions].reverse();
}

/**
 * Demo "Resolve": appends to the resolutions ledger ONLY. The
 * automation_errors rows above are immutable (no status flip, no
 * resolved_at write) — same binding as the live app path.
 */
export function demoResolveError(input: {
  error_id: string;
  resolved_by: string | null;
  resolution_note: string;
}): DemoErrorResolutionRow {
  const row: DemoErrorResolutionRow = {
    id: `demo-aer-${Date.now()}`,
    error_id: input.error_id,
    resolved_by: input.resolved_by,
    resolution_note: input.resolution_note,
    created_at: now(),
    demo: true,
  };
  errorResolutions.push(row);
  return row;
}

/* ------------------------------------------------------------------ *
 * Review workspace simulations
 * ------------------------------------------------------------------ */

const reviewStates = new Map<string, ReviewFeedbackRow>();

/**
 * Simulated pending review list derived from the demo progress records so
 * the /admin/tasks workbench has honest demo rows (flagged demo:true).
 */
export function demoPendingReviews(progress: ProgressRecord[]): CheckinColumnRow[] {
  const cadenceCycle = ["weekly", "weekly", "monthly"] as const;
  return progress.map((p, i) => {
    const seeded = reviewStates.get(p.id);
    return {
      submission_id: p.id,
      request_id: `demo-req-${p.id}`,
      client_id: p.clientId ?? null,
      period_label: cadenceCycle[i % cadenceCycle.length],
      period_start: p.date.slice(0, 10),
      period_end: p.date.slice(0, 10),
      request_status: "sent",
      submitted_at: p.date,
      weight_kg: p.weightKg,
      training_days_made: p.workoutCompletionPct / 25,
      workout_pct: p.workoutCompletionPct,
      nutrition_pct: p.nutritionAdherencePct,
      energy: 4,
      sleep: 7,
      difficulties: null,
      feedback: p.notes,
      review_status: seeded
        ? (seeded.status as CheckinColumnRow["review_status"])
        : "none",
      demo: true,
    };
  });
}

export function demoReviewUpsert(input: {
  submission_id: string;
  status: "approved" | "needs_work";
  feedback: string;
}): ReviewFeedbackRow {
  const row: ReviewFeedbackRow = {
    submission_id: input.submission_id,
    status: input.status,
    feedback: input.feedback,
    updated_at: now(),
    demo: true,
  };
  reviewStates.set(input.submission_id, row);
  return row;
}

export function demoReviewStates(): ReviewFeedbackRow[] {
  return Array.from(reviewStates.values());
}

/* ------------------------------------------------------------------ *
 * Conversations (unified telegram + web, demo)
 * ------------------------------------------------------------------ */

const clientReplies = new Map<string, ConversationMessageRow[]>();

/**
 * Demo thread per client: the seeded portal chat thread is bound to the
 * shared demo client (cl-0512, mirrors the portal demo identity). Other
 * demo clients start with an empty thread. Admin replies append here with
 * role='coach' / source='web' — mirroring the live route pin behavior.
 */
export function demoConversationFor(
  clientId: string
): ConversationMessageRow[] {
  if (clientId === "cl-0512") {
    const seed = demoChatThread().map(
      (m): ConversationMessageRow => ({
        ...m,
        conversation_id: `web-${clientId}`,
        demo: true,
      })
    );
    const extra = clientReplies.get(clientId) ?? [];
    return [...seed, ...extra];
  }
  return clientReplies.get(clientId) ?? [];
}

export function demoConversationPost(
  clientId: string,
  content: string
): ConversationMessageRow {
  const row: ConversationMessageRow = {
    id: `demo-msg-${Date.now()}`,
    conversation_id: `web-${clientId}`,
    role: "coach",
    content,
    source: "web",
    message_ts: now(),
    intent: null,
    demo: true,
  };
  const list = clientReplies.get(clientId) ?? [];
  list.push(row);
  clientReplies.set(clientId, list);
  return row;
}

/* ------------------------------------------------------------------ *
 * Drawer bundle demo builders
 * ------------------------------------------------------------------ */

export function demoTimelineFor(
  clientId: string,
  subStart: string | undefined
): TimelineRow[] {
  const rows: TimelineRow[] = [
    {
      id: `demo-sev-create-${clientId}`,
      event_type: "activated",
      source: "admin",
      occurred_at: subStart ?? now(),
      payload_reference: "demo seed",
      demo: true,
    },
  ];
  return rows;
}

export function demoPaymentsFor(name: string): LedgerEventRow[] {
  return [
    {
      id: "demo-pay-view-1",
      event_type: "order.paid",
      order_ref: `SO-DEMO-${name.length}`,
      status: "processed",
      created_at: now(),
      summary: "Simulated payment event (demo outbox seam)",
      demo: true,
    },
  ];
}
