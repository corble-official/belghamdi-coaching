/**
 * Shared admin CRM types — consumed by BOTH the server API routes and the
 * client pages. Keep this module pure (no "server-only", no React) so client
 * components can import the shapes without pulling server code.
 */

export type AdminRole = "admin" | "coach" | "coach_assistant";

export type AccessLevel = "full" | "history_only" | "suspended" | "revoked";

export type AdminSegment = "all" | "active" | "inactive" | "expired";

/** Normalized client row as served by GET /api/admin/clients. */
export type AdminClientRow = {
  id: string;
  client_code: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  /** bc_pkg_id enum value ("silver" | "gold") or null */
  package_id: string | null;
  /** clients.status */
  client_status: string;
  /** Latest client_subscriptions row (null = never subscribed). */
  sub_id: string | null;
  sub_status: string | null;
  sub_start_date: string | null;
  sub_end_date: string | null;
  /** deriveAccess()-resolved access level for the status chip. */
  access: AccessLevel | "none";
  segment: Exclude<AdminSegment, "all">;
  last_checkin_at: string | null;
  /** Demo rows are ALWAYS flagged so demo/simulated data stays distinguishable. */
  demo: boolean;
};

export type ClientsResponse = {
  ok: true;
  demo: boolean;
  role: AdminRole | null;
  rows: AdminClientRow[];
};

/** Manual override verbs (route-enforced, admin-only — coach → 403). */
export type OverrideAction = "activate" | "suspend" | "extend" | "revoke";

export const OVERRIDE_ACTIONS: readonly OverrideAction[] = [
  "activate",
  "suspend",
  "extend",
  "revoke",
];

export type OverrideRequestBody = {
  client_id: string;
  action: OverrideAction | "request_override";
  payload?: {
    /** How many days `extend` adds to end_date. */
    extend_days?: number;
    reason?: string;
  };
};

/* ------------------------------------------------------------------ *
 * Drawer bundle (GET /api/admin/clients/[id])
 * ------------------------------------------------------------------ */

export type ClientDetail = {
  id: string;
  client_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  telegram_user_id: number | null;
  telegram_chat_id: number | null;
  fitness_goal: string | null;
  training_location: string | null;
  training_days: string | null;
  experience_level: string | null;
  notes: string | null;
  package_id: string | null;
  status: string;
  onboarding_completed: boolean;
  created_at: string;
  demo: boolean;
};

export type SubRow = {
  id: string;
  subscription_code: string;
  package_id: string;
  status: string;
  start_date: string;
  end_date: string;
  demo: boolean;
};

export type TimelineRow = {
  id: string;
  event_type: string;
  source: string;
  occurred_at: string;
  payload_reference: string | null;
  demo: boolean;
};

export type CheckinColumnRow = {
  submission_id: string;
  request_id: string;
  client_id: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  request_status: string | null;
  submitted_at: string | null;
  weight_kg: number | null;
  training_days_made: number | null;
  workout_pct: number | null;
  nutrition_pct: number | null;
  energy: number | null;
  sleep: number | null;
  difficulties: string | null;
  feedback: string | null;
  review_status: "none" | "pending" | "approved" | "needs_work";
  demo: boolean;
};

export type MeasurementRow = {
  submission_id: string;
  submitted_at: string | null;
  measurements: Record<string, unknown> | null;
  demo: boolean;
};

export type PhotoRow = {
  submission_id: string;
  submitted_at: string | null;
  /** service-signed URL (10 min ttl) — null when generation failed */
  url: string | null;
  path: string | null;
  demo: boolean;
};

export type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  source: string;
  message_ts: string | null;
  intent: string | null;
  demo: boolean;
};

export type ReviewFeedbackRow = {
  submission_id: string;
  status: string;
  feedback: string | null;
  updated_at: string | null;
  demo: boolean;
};

export type LedgerEventRow = {
  id: string;
  event_type: string;
  order_ref: string | null;
  status: string;
  created_at: string;
  summary: string | null;
  demo: boolean;
};

export type OnboardingBundle = {
  request: {
    id: string;
    status: string;
    channel: string;
    sent_at: string | null;
    completed_at: string | null;
  } | null;
  submission: {
    id: string;
    submitted_at: string | null;
    data: Record<string, unknown> | null;
  } | null;
  demo: boolean;
};

export type ReconciliationNote = {
  conversation_id: string;
  action: "updated" | "left_alone" | "none";
  detail: string;
};

export type AdminClientBundle = {
  ok: true;
  demo: boolean;
  role: AdminRole | null;
  client: ClientDetail;
  onboarding: OnboardingBundle;
  subscriptions: SubRow[];
  timeline: TimelineRow[];
  /** weekly-cadence check-in columns (requests.period_label = 'weekly') */
  weekly: CheckinColumnRow[];
  /** monthly-cadence check-in columns */
  monthly: CheckinColumnRow[];
  measurements: MeasurementRow[];
  photos: PhotoRow[];
  /** telegram + web unified, ascending message_ts */
  messages: ConversationMessageRow[];
  web_conversation_id: string;
  feedback: ReviewFeedbackRow[];
  payments: LedgerEventRow[];
  activity: LedgerEventRow[];
  reconciliation: ReconciliationNote | null;
};
