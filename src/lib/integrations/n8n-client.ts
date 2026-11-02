import "server-only";

import {
  N8N_ENDPOINTS,
  messageTimestamp,
  sanitizeError,
  signPayload,
  type DeliveryRecord,
  type DispatchEvent,
  type N8nEndpointKey,
} from "@/lib/integrations/contracts";

/* ============================================================
   Server-side n8n client.
   NEVER import this from client components — it depends on
   N8N_BASE_URL / N8N_WEBHOOK_SECRET environment variables.
   ============================================================ */

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 12_000;

export function n8nBaseUrl(): string {
  return process.env.N8N_BASE_URL || "";
}

export function webhookSecret(): string {
  return process.env.N8N_WEBHOOK_SECRET || "";
}

/** When false, deliveries are recorded as "skipped (demo)" instead of hitting n8n. */
export function n8nConfigured(): boolean {
  return Boolean(n8nBaseUrl() && webhookSecret());
}

interface DeliverOptions {
  attempts?: number;
}

/**
 * Deliver one typed event to an n8n webhook with HMAC signature headers.
 * Returns a DeliveryRecord — a 200 response does NOT prove the business
 * process completed; consumers must treat response body status as advisory.
 */
export async function deliver(
  endpointKey: N8nEndpointKey,
  event: DispatchEvent,
  options?: DeliverOptions
): Promise<DeliveryRecord> {
  const path = N8N_ENDPOINTS[endpointKey];
  const base = n8nBaseUrl();
  const secret = webhookSecret();
  const correlationId = event.refId;
  const maxAttempts = options?.attempts ?? MAX_ATTEMPTS;
  const baseRecord: DeliveryRecord = {
    id: correlationId,
    endpoint: endpointKey,
    eventType: (event.body as { event_type?: string }).event_type ?? endpointKey,
    eventRef: event.refId,
    payload: event.body,
    status: "pending",
    attempts: 0,
    createdAt: messageTimestamp(),
  };

  if (!n8nConfigured()) {
    return {
      ...baseRecord,
      status: "skipped",
      attempts: 0,
      lastAttemptAt: baseRecord.createdAt,
      response: { status: 0, body: "n8n not configured (demo event recorded locally)" },
    };
  }

  let lastError = "";
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const rawBody = JSON.stringify(event.body);
      const ts = messageTimestamp();
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BC-Timestamp": ts,
          "X-BC-Signature": signPayload(rawBody, ts, secret),
          "X-BC-Correlation-Id": correlationId,
          "X-BC-Environment": "demo",
        },
        body: rawBody,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = res.status;
      if (res.ok) {
        const body: string = await res.text().catch(() => "");
        return {
          ...baseRecord,
          status: "delivered",
          attempts: attempt,
          lastAttemptAt: messageTimestamp(),
          response: { status: res.status, body: body.slice(0, 400) },
        };
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = sanitizeError(e instanceof Error ? e.message : String(e));
    }
    // linear backoff; bounded attempts (no infinite loops)
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 400));
  }

  return {
    ...baseRecord,
    status: "failed",
    attempts: maxAttempts,
    lastAttemptAt: messageTimestamp(),
    error: lastError,
    response: { status: lastStatus },
  };
}

/** Lightweight health check for the Automation Center (does not need auth to /healthz). */
export async function n8nHealth(): Promise<{ ok: boolean; baseUrl: string; error?: string }> {
  const base = n8nBaseUrl();
  if (!base) return { ok: false, baseUrl: "", error: "not configured" };
  try {
    const res = await fetch(`${base}/healthz`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return { ok: res.ok, baseUrl: base };
  } catch (e) {
    return {
      ok: false,
      baseUrl: base,
      error: sanitizeError(e instanceof Error ? e.message : String(e)),
    };
  }
}
