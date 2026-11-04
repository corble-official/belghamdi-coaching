import { redirect } from "next/navigation";

import {
  checkinGates,
  type CheckinRequestItem,
  type CheckinSubmissionView,
} from "@/lib/checkins";
import { getOwnCheckinDetail } from "@/lib/supabase/portal-checkins";
import { getPortalCtx } from "../../server";
import CheckinForm from "./CheckinForm";

/**
 * Portal check-in form page — one request per page.
 *
 * Server-side gating (the UI never decides on its own):
 *  - unauthenticated → /login
 *  - request not found / not own → "unavailable" card
 *  - already submitted → terminal "already submitted" card (history stays)
 *  - gate closed (`progress_submissions` / cadence) → locked or read-only card
 *  - otherwise → the form, with the last recorded weight as context
 *
 * The layout already deep-verifies the session; re-checking here keeps a
 * mid-request expiry from rendering a form that cannot submit.
 */
export default async function CheckinRequestPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const gates = checkinGates(ctx.entitlements);

  // Closed read gate (suspended/revoked) → no data read at all.
  if (!gates.can_read) {
    return (
      <CheckinForm
        demo={ctx.demo}
        request={null}
        submission={null}
        lastWeightKg={null}
        canSubmit={false}
        historyReadonly={false}
        readBlocked
      />
    );
  }

  const result = await getOwnCheckinDetail(ctx, params.id);

  if (!result.ok) {
    // Read failure: render the "unavailable" card rather than a blank form.
    return (
      <CheckinForm
        demo={ctx.demo}
        request={null}
        submission={null}
        lastWeightKg={null}
        canSubmit={false}
        historyReadonly={gates.history_readonly}
      />
    );
  }

  const request: CheckinRequestItem | null = result.data.request;
  const submission: CheckinSubmissionView | null = result.data.submission;

  return (
    <CheckinForm
      demo={ctx.demo}
      request={request}
      submission={submission}
      lastWeightKg={result.data.last_weight_kg}
      canSubmit={
        gates.can_submit && request !== null && request.status !== "cancelled"
      }
      historyReadonly={gates.history_readonly}
    />
  );
}
