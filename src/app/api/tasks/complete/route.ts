import { NextResponse } from "next/server";
import { deliver } from "@/lib/integrations/n8n-client";
import type { Bc06TaskComplete } from "@/lib/integrations/contracts";

/* POST /api/tasks/complete — admin-gated.
   Completes a coach task through BC-06 (bc06-task-event). The workflow's
   complete_follow_up_task RPC handles the authoritative state change, so the
   website never duplicates task business logic. */

interface CompleteInput {
  task_id?: unknown;
  source_id?: unknown;
  category?: unknown;
  notes?: unknown;
  reviewed_by?: unknown;
}

const CATEGORIES = new Set([
  "checkin_review",
  "missed_checkin",
  "plan_update",
  "renewal",
  "manual_check",
  "onboarding",
  "general_support",
  "automation",
]);

const str = (v: unknown, max = 400): string => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

export async function POST(req: Request) {
  const { isAdminRequest, unauthorized } = await import("@/lib/integrations/server-auth");
  if (!(await isAdminRequest())) return unauthorized();

  let body: CompleteInput;
  try {
    body = (await req.json()) as CompleteInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const taskId = str(body.task_id, 60);
  const sourceId = str(body.source_id, 60);
  if (!taskId && !sourceId) return NextResponse.json({ error: "task_reference_required" }, { status: 400 });

  const category = String(body.category || "general_support");
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "bad_category" }, { status: 400 });

  const event: Bc06TaskComplete = {
    action: "complete",
    task_id: taskId || undefined,
    source_id: sourceId || undefined,
    category: category as Bc06TaskComplete["category"],
    notes: str(body.notes, 800) || undefined,
    reviewed_by: str(body.reviewed_by, 80) || "admin",
  };

  const ref = taskId || sourceId;
  const record = await deliver("bc06_task", { refId: `task-complete-${ref}`, body: event });

  return NextResponse.json({
    ok: record.status === "delivered" || record.status === "skipped",
    pre_generated: false,
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
