import { getPortalCtx } from "./server";
import PortalHub from "./PortalHub";
import { redirect } from "next/navigation";

/**
 * Portal hub — server component passing the entitlement gates + demo flag
 * + subscription snapshot to the card grid. ALL hub routing targets are
 * forward links to later tasks (onboarding/follow-up/progress/renewal) —
 * a 404 for them is expected until Tasks 5–9 land.
 */
export default async function PortalHubPage() {
  const ctx = await getPortalCtx();

  // Belt-and-braces: if the layout's deep verify flagged unauthenticated
  // (e.g. mid-request expiry), bail before touching entitlements.
  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  return (
    <PortalHub
      demo={ctx.demo}
      ent={ctx.entitlements}
      endDate={ctx.subscription?.end_date ?? null}
    />
  );
}
