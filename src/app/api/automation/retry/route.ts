import { NextResponse } from "next/server";
import { isAdminRequest, unauthorized } from "@/lib/integrations/server-auth";
import { deliver } from "@/lib/integrations/n8n-client";
import { sanitizeError, type DeliveryRecord, type N8nEvent } from "@/lib/integrations/contracts";
import { N8N_ENDPOINTS } from "@/lib/integrations/contracts";

/* POST /api/automation/retry — admin-gated. Re-attempts a failed outbox
   delivery (bounded attempts, no infinite loops). */

interface RetryBody {
  record?: {
    id?: unknown;
    endpoint?: unknown;
    payload?: unknown;
    attempts?: unknown;
  };
}

export async function POST(req: Request) {
  if (!(await isAdminRequest())) return unauthorized();

  let body: RetryBody;
  try {
    body = (await req.json()) as RetryBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rec = body.record;
  const id = String(rec?.id ?? "");
  const endpoint = String(rec?.endpoint ?? "");
  const attempts = Number(rec?.attempts ?? 0);

  if (!id || !N8N_ENDPOINTS[endpoint as keyof typeof N8N_ENDPOINTS]) {
    return NextResponse.json({ error: "bad_record" }, { status: 400 });
  }
  if (attempts >= 3) return NextResponse.json({ error: "max_attempts_reached" }, { status: 409 });
  if (!rec?.payload || typeof rec.payload !== "object") {
    return NextResponse.json({ error: "missing_payload" }, { status: 400 });
  }

  const updated: DeliveryRecord = await deliver(
    endpoint as keyof typeof N8N_ENDPOINTS,
    { refId: id, body: rec.payload as N8nEvent },
    { attempts: attempts + 1 }
  );
  // preserve original attempts accounting already handled inside deliver()
  updated.error = updated.error ? sanitizeError(updated.error) : undefined;

  return NextResponse.json({ ok: updated.status === "delivered", record: { ...updated, endpoint } });
}
