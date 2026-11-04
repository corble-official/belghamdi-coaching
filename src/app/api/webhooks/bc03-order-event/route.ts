import { NextResponse } from "next/server";
import { safeCompare, signPayload, type Bc03OrderEvent } from "@/lib/integrations/contracts";
import { provisionFromOrder } from "@/lib/provisioning/provision-client";

/* POST /api/webhooks/bc03-order-event — Task 2.5 (SUPA-side identity layer).

   HMAC-verified entry point for the account-provisioning pipeline. This is
   ADDITIVE to BC-03's n8n flow (which keeps its own /webhook/bc03-order-event
   intake and process_order_event call) — this route never replaces it.

   Verification mirrors the EXACT outbound scheme of
   src/lib/integrations/n8n-client.ts (deliver()):
     X-BC-Timestamp: ISO timestamp
     X-BC-Signature: HMAC-SHA256(N8N_WEBHOOK_SECRET, `${timestamp}.${rawBody}`)
   The shared secret is the same N8N_WEBHOOK_SECRET both sides already hold.
   Signature verification happens HERE ONLY — provisionFromOrder deliberately
   does not re-verify (single verification point per the task brief).

   Replay tolerance: there is no timestamp freshness window by design — the
   pipeline is fully idempotent (ledger dedupe + DO NOTHING writes), so a
   replayed delivery is harmless, and skipping a freshness check avoids
   clock-skew fragility between hosts.

   Responses:
     401 { error: "invalid_signature" }  — missing/bad HMAC (unsigned probes)
     400 { error: "invalid_json" | "order_ref_required" }
     503 { error: "webhook_secret_missing" } — fail closed, never verify open
     200 { ok, order_ref, provisioning: ProvisionResult } — provisioning
           errors are reported INSIDE the payload (status:"error") rather
           than as transport errors: senders must not blind-retry, the
           pipeline self-heals on the next delivery instead. */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-bc-timestamp") ?? "";
  const signature = req.headers.get("x-bc-signature") ?? "";

  const secret = process.env.N8N_WEBHOOK_SECRET || "";
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "webhook_secret_missing" },
      { status: 503 }
    );
  }
  if (!timestamp || !signature || !safeCompare(signPayload(rawBody, timestamp, secret), signature)) {
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 }
    );
  }

  let event: Bc03OrderEvent;
  try {
    event = JSON.parse(rawBody) as Bc03OrderEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!event || typeof event.order_ref !== "string" || !event.order_ref.trim()) {
    return NextResponse.json({ ok: false, error: "order_ref_required" }, { status: 400 });
  }

  // Only verified orders provision identity; cancels are acknowledged so the
  // sender does not retry, but never touch the identity layer.
  if (event.event_type !== "order_verified") {
    return NextResponse.json({
      ok: true,
      order_ref: event.order_ref,
      provisioning: null,
      note: `event_type ${event.event_type} is not provisionable`,
    });
  }

  const provisioning = await provisionFromOrder(event);
  return NextResponse.json({
    ok: provisioning.status !== "error",
    order_ref: event.order_ref,
    provisioning,
  });
}
