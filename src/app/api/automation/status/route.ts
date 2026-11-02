import { NextResponse } from "next/server";
import { isAdminRequest, unauthorized } from "@/lib/integrations/server-auth";
import { n8nConfigured, n8nHealth, webhookSecret } from "@/lib/integrations/n8n-client";

/* GET /api/automation/status — admin-gated. Automation Center health probe:
   website DB status vs n8n delivery layer status vs automation completion.
   Never returns any secret material. */

export async function GET() {
  if (!(await isAdminRequest())) return unauthorized();

  const configured = n8nConfigured();
  const health = configured ? await n8nHealth() : { ok: false, baseUrl: "", error: "not configured" };

  return NextResponse.json({
    n8n: {
      configured,
      connected: health.ok,
      baseUrl: health.baseUrl,
      error: health.error ?? null,
      secretConfigured: Boolean(webhookSecret()),
    },
    checkedAt: new Date().toISOString(),
  });
}
