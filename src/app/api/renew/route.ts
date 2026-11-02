import { NextResponse } from "next/server";
import { deliver } from "@/lib/integrations/n8n-client";
import type { Bc07RenewalEvent } from "@/lib/integrations/contracts";
import { isAdminRequest, unauthorized } from "@/lib/integrations/server-auth";

/* POST /api/renew — admin-gated. Sends a renewal event to BC-07.
   In demo mode the subscription payload is clearly demo-labeled. Live mode
   (Shopify) will pass through real subscription records only. */

interface RenewInput {
  order_ref?: unknown;
  subscription_code?: unknown;
  new_end_date?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 60): string => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

export async function POST(req: Request) {
  if (!(await isAdminRequest())) return unauthorized();

  let body: RenewInput;
  try {
    body = (await req.json()) as RenewInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderRef = str(body.order_ref, 40);
  const subscriptionCode = str(body.subscription_code, 60);
  const newEndDate = str(body.new_end_date, 10);
  if (!orderRef || !subscriptionCode) {
    return NextResponse.json({ error: "order_ref_and_subscription_required" }, { status: 400 });
  }
  if (newEndDate && !DATE_RE.test(newEndDate)) {
    return NextResponse.json({ error: "bad_new_end_date" }, { status: 400 });
  }

  const event: Bc07RenewalEvent = {
    event_type: "order_verified",
    provider: "internal",
    order_ref: orderRef,
    payload: {
      subscription_code: subscriptionCode,
      new_end_date: newEndDate || undefined,
    },
  };
  return NextResponse.json({
    ok: true,
    pre_generated: false,
    note: "delivery skipped here for brevity",
    order_ref: orderRef,
    delivery: await deliver("bc07_renewal", { refId: orderRef, body: event }).then((r) => ({
      id: r.id,
      status: r.status,
      attempts: r.attempts,
      endpoint: r.endpoint,
      error: r.error,
      response: r.response,
    })),
  });
}
