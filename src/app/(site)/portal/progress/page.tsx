import { redirect } from "next/navigation";

import { checkinGates } from "@/lib/checkins";
import { getOwnProgress } from "@/lib/supabase/portal-checkins";
import { getPortalCtx } from "../server";
import ProgressHistory from "./ProgressHistory";

/**
 * Portal progress page — check-in history + measurement/weight trends.
 *
 * Gating (binding):
 *  - read gate closed (suspended/revoked) → locked card, NO data read.
 *  - `progress_submissions` false + `checkin_history_readonly` true →
 *    history stays VISIBLE with a read-only banner (expiry never deletes
 *    history), submit CTAs disabled.
 *  - Full access → history + an "open check-in" CTA.
 *
 * Photos come back as 10-minute signed URLs, generated server-side with the
 * user JWT and ONLY for the caller's own object-path prefix.
 */
export default async function ProgressPage() {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const gates = checkinGates(ctx.entitlements);

  if (!gates.can_read) {
    return (
      <ProgressHistory
        demo={ctx.demo}
        entries={[]}
        readonly={false}
        canSubmit={false}
        blocked
      />
    );
  }

  const result = await getOwnProgress(ctx);

  return (
    <ProgressHistory
      demo={ctx.demo}
      entries={result.ok ? result.data.entries : []}
      readonly={gates.history_readonly}
      canSubmit={gates.can_submit}
      readError={!result.ok}
    />
  );
}
