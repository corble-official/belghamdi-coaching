import { redirect } from "next/navigation";
import { getPortalCtx } from "../server";
import {
  getOnboardingState,
  isOnboardingCompleted,
} from "@/lib/supabase/portal-onboarding";
import OnboardingForm from "./OnboardingForm";

/**
 * Portal onboarding page — server component gating + state resolution.
 * The layout already deep-verifies the session; re-check here so a
 * mid-request expiry still redirects instead of rendering the form shell.
 *
 * The form only renders while the latest own request is open. Otherwise the
 * client component shows the terminal card: "already completed" (a submission
 * exists or the request is completed/completed_late) or "no open onboarding".
 */
export default async function OnboardingPage() {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const state = await getOnboardingState(ctx);

  const completed =
    Boolean(state.submission) ||
    isOnboardingCompleted(state.request?.status ?? "");

  return (
    <OnboardingForm
      demo={ctx.demo}
      hasRequest={state.request !== null}
      completed={completed}
      prefill={state.prefill}
    />
  );
}
