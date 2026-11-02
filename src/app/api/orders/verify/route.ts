import { NextResponse } from "next/server";
import { deliver } from "@/lib/integrations/n8n-client";
import type { Bc03OrderEvent, PackageId } from "@/lib/integrations/contracts";

/* POST /api/orders/verify — admin-gated.
   The trusted server-side verification step. In demo mode this simulates the
   provider's server-side confirmation (clearly labeled); in live mode this is
   replaced by the Shopify order-verification webhook (same event contract).
   Idempotency: the n8n side (process_order_event) dedupes on order_ref. */

interface VerifyInput {
  order_ref?: unknown;
  package_id?: unknown;
  duration_days?: unknown;
  customer_name?: unknown;
  email?: unknown;
  phone?: unknown;
}

const PKG = new Set<PackageId>(["silver", "gold"]);
const str = (v: unknown, max = 160): string => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

export async function POST(req: Request) {
  const { isAdminRequest, unauthorized } = await import("@/lib/integrations/server-auth");
  if (!(await isAdminRequest())) return unauthorized();

  let body: VerifyInput;
  try {
    body = (await req.json()) as VerifyInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderRef = str(body.order_ref, 40);
  const pkg = String(body.package_id || "");
  if (!orderRef) return NextResponse.json({ error: "order_ref_required" }, { status: 400 });
  if (!PKG.has(pkg as PackageId)) {
    // Training-program purchases are informational only — they never mint
    // coaching subscriptions or onboarding (see DISCOVERY.md §3 G2).
    return NextResponse.json({ error: "package_not_coaching" }, { status: 422 });
  }

  const event: Bc03OrderEvent = {
    event_type: "order_verified",
    provider: "internal",
    order_ref: orderRef,
    package_id: pkg as PackageId,
    duration_days: Number(body.duration_days) || undefined,
    customer_name: str(body.customer_name, 120) || null,
    email: str(body.email, 160) || null,
    phone: str(body.phone, 40) || null,
    telegram_user_id: null,
    telegram_chat_id: null,
    kind: null,
    subscription_code: null,
  };

  const record = await deliver("bc03_order", { refId: orderRef, body: event });

  return NextResponse.json({
    ok: record.status === "delivered" || record.status === "skipped",
    order_ref: orderRef,
    verified: true, // demo verification — no real payment in demo mode
    demo: process.env.NODE_ENV !== "production",
    delivery: {
      id: record.id,
      status: record.status,
      attempts: record.attempts,
      endpoint: record.endpoint,
      error: record.error,
      response: record.response,
    },
  });
}
