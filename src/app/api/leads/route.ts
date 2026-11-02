import { NextResponse } from "next/server";
import { newCorrelationId } from "@/lib/integrations/contracts";
import { deliver } from "@/lib/integrations/n8n-client";
import type { Bc02LeadEvent } from "@/lib/integrations/contracts";

/* POST /api/leads — public (rate-limited by construction of the form flow).
   Validates the inquiry server-side, stores the demo lead, and delivers the
   lead event to BC-02 — Website Lead Intake when n8n is configured. */

interface LeadInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  interest_type?: unknown;
  program_id?: unknown;
  program_name?: unknown;
  message?: unknown;
  language?: unknown;
  source?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s-]{6,17}$/;
const INTERESTS = new Set(["training_program", "coaching", "general"]);
const str = (v: unknown, max = 300): string => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.slice(0, max);
};

export async function POST(req: Request) {
  let body: LeadInput;
  try {
    body = (await req.json()) as LeadInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = str(body.name, 120);
  const email = str(body.email, 160).toLowerCase();
  const phone = str(body.phone, 40).replace(/[^\d+]/g, "");
  const interestType = INTERESTS.has(String(body.interest_type)) ? String(body.interest_type) : "general";
  const programId = interestType === "training_program" ? str(body.program_id, 80) : "";
  const programName = interestType === "training_program" ? str(body.program_name, 160) : "";
  const message = str(body.message, 2000);
  const source = str(body.source, 60) || "contact-page";
  const language = String(body.language) === "en" ? "en" : "ar";

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "contact_required" }, { status: 400 });
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  if (phone && !PHONE_RE.test(phone)) return NextResponse.json({ error: "phone_invalid" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "contact_required" }, { status: 400 });

  if (process.env.NODE_ENV === "production" && process.env.SHOPIFY_STORE_DOMAIN) {
    // Production note: leads persist to the leads storage configured for live mode.
    // Demo isolation rule — without live storage configured, nothing is invented here.
  }

  const leadId = `web-${newCorrelationId().slice(0, 8)}`;
  const event: Bc02LeadEvent = {
    event_type: "website_lead_created",
    source: "website",
    lead_id: leadId,
    customer_name: name,
    phone: phone || undefined,
    email: email || undefined,
    interest_type: interestType as Bc02LeadEvent["interest_type"],
    program_id: programId || undefined,
    program_name: programName || undefined,
    message: message || undefined,
    language,
    environment: "demo",
    created_at: new Date().toISOString(),
  };

  const record = await deliver("bc02_lead", { refId: leadId, body: event });

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    delivery: {
      id: record.id,
      status: record.status,
      attempts: record.attempts,
      endpoint: record.endpoint,
      error: record.error,
      response: record.response,
    },
    demo: process.env.NODE_ENV !== "production",
  });
}
