import { NextResponse } from "next/server";

import { checkinGates } from "@/lib/checkins";
import { getPortalContext } from "@/lib/supabase/portal-context";
import {
  checkinEntitlements,
  getOwnCheckinDetail,
} from "@/lib/supabase/portal-checkins";

/**
 * GET /api/portal/checkins/[id] — one own check-in request + its submission.
 *
 * Ownership is enforced server-side: the row is filtered by BOTH the path id
 * and the session client id, so another client's request id is simply not
 * found (404, no existence leak) in live mode. Demo mirrors the same surface
 * with a simulated row.
 *
 * Gating mirrors the list route: an open cadence OR read-only history is
 * required, otherwise 403 feature_locked.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getPortalContext();

  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = checkinEntitlements(ctx, req.headers);
  const gates = checkinGates(ent);

  if (!gates.can_read) {
    return NextResponse.json(
      { error: "feature_locked", gate: "weekly_checkins" },
      { status: 403 }
    );
  }

  const result = await getOwnCheckinDetail(ctx, params.id);

  if (!result.ok) {
    return NextResponse.json({ error: "db_read_failed" }, { status: 502 });
  }

  if (!result.data.request) {
    return NextResponse.json(
      { error: "request_not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    demo: result.demo,
    ...gates,
    request: result.data.request,
    submission: result.data.submission,
    last_weight_kg: result.data.last_weight_kg,
  });
}
