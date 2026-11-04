import { redirect } from "next/navigation";
import { checkinGates } from "@/lib/checkins";
import { getPortalCtx } from "../server";
import FollowUpChat from "./FollowUpChat";

/**
 * Portal follow-up page — server component gating + surface selection.
 * The layout already deep-verifies the session; re-check here so a
 * mid-request expiry still redirects instead of rendering a chat shell.
 *
 * Gating (Task 6 brief):
 * - `coach_chat` on → full chat (polling thread + composer).
 * - Expired/history-only (`checkin_history_readonly`/`coach_feedback_readonly`)
 *   → past messages READ-ONLY, composer disabled + explanatory banner.
 * - Otherwise (suspended/revoked/no subscription) → chat blocked card with
 *   a renewal CTA; the thread is not fetched at all (API mirrors this).
 *
 * The check-ins section (`#checkins`) renders below the chat from
 * GET /api/portal/checkins, gated by the same server-derived entitlements.
 */
export default async function FollowUpPage() {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const ent = ctx.entitlements;
  const gates = checkinGates(ent);
  const historyOnly =
    !ent.coach_chat &&
    (ent.checkin_history_readonly || ent.coach_feedback_readonly);

  const mode = ent.coach_chat ? "full" : historyOnly ? "readonly" : "locked";

  return (
    <FollowUpChat
      demo={ctx.demo}
      mode={mode}
      clientName={ctx.client.full_name}
      checkins={{
        canSubmit: gates.can_submit,
        readonly: gates.history_readonly,
        blocked: !gates.can_read,
      }}
    />
  );
}
