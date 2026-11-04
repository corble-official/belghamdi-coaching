import { redirect } from "next/navigation";

import { getPortalCtx } from "../server";
import { getOwnRenewalData } from "@/lib/supabase/portal-renewal";
import RenewalHub from "./RenewalHub";

/**
 * Portal renewal hub (Task 9) — REQUEST ONLY.
 *
 * Gating mirrors the rest of the portal: the layout + this page redirect to
 * /login when the deep context says unauthenticated. The hub itself is the
 * remediation path, so no entitlement gate blocks it — expired/refunded/
 * disputed clients see their state and can still file a renewal request.
 *
 * The page performs the data read server-side; the client component handles
 * the request POST. Nothing here activates or extends anything.
 */
export default async function RenewalPage() {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const result = await getOwnRenewalData(ctx);

  return (
    <RenewalHub
      demo={ctx.demo}
      readError={!result.ok}
      data={result.ok ? result.data : null}
    />
  );
}
