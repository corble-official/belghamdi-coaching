"use client";

import { sanitizeError, type DeliveryRecord } from "@/lib/integrations/contracts";

/* ============================================================
   Demo outbox — persists DeliveryRecords from the demo event
   flow so the Automation Center can display REAL delivery
   statuses (created / delivered-to-n8n / failed / skipped).
   Production will be backed by the integration_events table.
   ============================================================ */

const STORAGE_KEY = "bc_n8n_outbox";
const MAX_RECORDS = 300;

export function readOutbox(): DeliveryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeliveryRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: DeliveryRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function recordDelivery(record: DeliveryRecord) {
  const existing = readOutbox();
  const idx = existing.findIndex((r) => r.id === record.id);
  if (idx >= 0) existing[idx] = record;
  else existing.unshift(record);
  write(existing);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bc:outbox-updated"));
  }
}

/** Re-attempt a failed delivery through the server (bounded to 3 total attempts). */
export async function retryDelivery(record: DeliveryRecord): Promise<DeliveryRecord> {
  const res = await fetch("/api/automation/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) return record;
  const { record: updated } = (await res.json()) as { record: DeliveryRecord };
  recordDelivery(updated);
  return updated;
}
