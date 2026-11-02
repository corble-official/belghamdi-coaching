import { createHmac, randomUUID, timingSafeEqual } from "crypto";

/* ============================================================
   BC ↔ n8n integration — event contracts (typed)
   Mirrors the actual webhook contracts verified in Phase 1:
   - bc03-order-event  → process_order_event RPC (idempotent on order_ref)
   - bc06-task-event   → upsert/complete follow_up_task
   - bc07-renewal-event → process_renewal_event RPC
   - bc02-lead         → upsert lead (+ Sales & Lead notification)
   ============================================================ */

export type PackageId = "silver" | "gold";

export interface Bc03OrderEvent {
  event_type: "order_verified" | "order_cancelled";
  provider: "internal" | "shopify";
  order_ref: string;
  package_id: PackageId;
  duration_days?: number;
  customer_name?: string | null;
  telegram_user_id?: number | null;
  telegram_chat_id?: number | null;
  email?: string | null;
  phone?: string | null;
  kind?: string | null;
  subscription_code?: string | null;
}

export interface Bc06TaskUpsert {
  action: "upsert";
  source_type: "automation" | "system" | "website";
  source_id: string; // unique per task reference (dedupe key)
  client_code?: string;
  category:
    | "checkin_review"
    | "missed_checkin"
    | "plan_update"
    | "renewal"
    | "manual_check"
    | "onboarding"
    | "general_support"
    | "automation";
  priority?: "low" | "medium" | "high";
  reason: string;
}

export interface Bc06TaskComplete {
  action: "complete";
  source_type?: "automation" | "system" | "website";
  source_id?: string;
  task_id?: string;
  category?: Bc06TaskUpsert["category"];
  notes?: string;
  reviewed_by?: string;
}

export interface Bc07RenewalEvent {
  event_type: "order_verified" | "cancelled";
  provider: "internal" | "shopify";
  order_ref: string;
  payload: {
    subscription_code: string;
    new_end_date?: string;
  };
}

export interface Bc02LeadEvent {
  event_type: "website_lead_created";
  source: "website";
  lead_id: string;
  customer_name: string;
  phone?: string;
  email?: string;
  interest_type: "training_program" | "coaching" | "general";
  program_id?: string;
  program_name?: string;
  message?: string;
  language: "ar" | "en";
  environment: "demo" | "production";
  created_at: string;
}

export type N8nEvent =
  | Bc03OrderEvent
  | Bc06TaskUpsert
  | Bc06TaskComplete
  | Bc07RenewalEvent
  | Bc02LeadEvent;

/** Envelope sent to the n8n client: correlation id + typed body. */
export interface DispatchEvent {
  refId: string; // correlation + idempotency key
  body: N8nEvent;
}

export const N8N_ENDPOINTS = {
  bc02_lead: "/webhook/bc02-lead",
  bc03_order: "/webhook/bc03-order-event",
  bc06_task: "/webhook/bc06-task-event",
  bc07_renewal: "/webhook/bc07-renewal-event",
} as const;

export type N8nEndpointKey = keyof typeof N8N_ENDPOINTS;

/* ---------------- Delivery record (outbox row) ---------------- */

export type DeliveryStatus = "pending" | "delivered" | "failed" | "skipped";

export interface DeliveryRecord {
  id: string; // correlation id
  endpoint: N8nEndpointKey;
  eventType: string;
  eventRef: string; // order_ref / lead_id / source_id
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string; // sanitized — never includes auth headers or tokens
  response?: { status: number; body?: string };
}

export function sanitizeError(raw: string): string {
  return String(raw || "")
    .replace(/bot\d{6,}:[A-Za-z0-9_-]{20,}/g, "bot***")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "jwt***")
    .replace(/(apikey|api_key|token|authorization|bearer|secret)["'=:\s]+[A-Za-z0-9._-]{8,}/gi, "$1=***")
    .slice(0, 280);
}

/* ---------------- HMAC signing (server-side only) ---------------- */

export function messageTimestamp(): string {
  return new Date().toISOString();
}

export function signPayload(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function newCorrelationId(): string {
  return randomUUID();
}
