import { NextResponse } from "next/server";

import { checkinGates, type CheckinRequestItem } from "@/lib/checkins";
import { getPortalContext } from "@/lib/supabase/portal-context";
import {
  checkinEntitlements,
  listOwnCheckins,
  type CheckinQueryStatus,
} from "@/lib/supabase/portal-checkins";

/**
 * GET /api/portal/checkins?status=open|completed|all
 *
 * The caller's OWN check-in requests (JWT, RLS `can_access_client`) with
 * their submission state. `period_label` carries the cadence the scheduler
 * wrote ("weekly"/"monthly" or the period range — it is display text only).
 *
 * Hard rules (binding):
 *  - Ownership: `.eq("client_id", <session client id>)` — no client id is
 *    ever read from the query string or body.
 *  - Gates: read requires an open cadence OR read-only history; otherwise
 *    403 feature_locked. Submit-ability is reported, never assumed by the UI.
 *  - Demo: simulated rows, ZERO Supabase/network.
 */

const parseStatus = (raw: string | null): CheckinQueryStatus =>
  raw === "open" || raw === "completed" ? raw : "all";

export async function GET(req: Request) {
  const ctx = await getPortalContext();

  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = checkinEntitlements(ctx, req.headers);
  const gates = checkinGates(ent);

  // Entitlement gate enforced SERVER-SIDE (not only in the UI). RLS is the
  // backstop, but history-only/suspended callers must not read request rows.
  if (!gates.can_read) {
    return NextResponse.json(
      { error: "feature_locked", gate: "weekly_checkins" },
      { status: 403 }
    );
  }

  const status = parseStatus(new URL(req.url).searchParams.get("status"));
  const result = await listOwnCheckins(ctx, status);

  if (!result.ok) {
    return NextResponse.json({ error: "db_read_failed" }, { status: 502 });
  }

  const requests: CheckinRequestItem[] = result.data.requests;

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    ...gates,
    status,
    requests,
  });
}
