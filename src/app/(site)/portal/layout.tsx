import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getPortalCtx } from "./server";
import { derivePortalBanner } from "@/lib/supabase/portal-banner";
import PortalShell from "./PortalShell";

/**
 * Portal shell — server component.
 *
 * Deep verification happens HERE (review ruling c): the middleware's
 * cookie presence check is a rough gate only, and the demo cookie alone is
 * NOT authentication in live mode. `getPortalContext()` resolves the real
 * session (user JWT) and we redirect to /login when `authed: false` —
 * in both modes the rendered context is what this call returns.
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getPortalCtx();

  if (!ctx.demo && !ctx.authed) {
    redirect("/login");
  }

  const variant = derivePortalBanner(ctx.entitlements, ctx.subscription);

  return (
    <PortalShell
      demo={ctx.demo}
      name={ctx.profile.full_name}
      variant={variant}
      endDate={ctx.subscription?.end_date ?? null}
    >
      {children}
    </PortalShell>
  );
}
