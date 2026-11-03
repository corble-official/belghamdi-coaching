"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  History,
  ShieldAlert,
  Clock,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import type { PortalBannerVariant } from "@/lib/supabase/portal-banner";

/**
 * Portal shell UI — nav links, entitlement banner, sign-out footer.
 * Renders inside the (site) layout (cream background, RTL-first), reusing
 * the existing site visual language: chips, card-surface, eyebrow/heading
 * classes. No new design tokens.
 */

const NAV_LINKS = [
  { href: "/portal", key: "portal_nav_home", exact: true },
  { href: "/portal/follow-up", key: "portal_nav_chat", exact: false },
  { href: "/portal/progress", key: "portal_nav_progress", exact: false },
  { href: "/portal/renewal", key: "portal_nav_renewal", exact: false },
] as const;

const BANNER_META: Record<
  PortalBannerVariant,
  { wrap: string; Icon: LucideIcon; textKey: string }
> = {
  active: {
    wrap: "bg-forest-soft border-forest/30 text-forest",
    Icon: CheckCircle2,
    textKey: "portal_banner_active",
  },
  history_only: {
    wrap: "bg-amber/15 border-amber/60 text-ink",
    Icon: History,
    textKey: "portal_banner_history_only",
  },
  suspended: {
    wrap: "bg-red-50 border-red-200 text-red-700",
    Icon: ShieldAlert,
    textKey: "portal_banner_suspended",
  },
  revoked: {
    wrap: "bg-red-50 border-red-200 text-red-700",
    Icon: ShieldAlert,
    textKey: "portal_banner_revoked",
  },
  pending: {
    wrap: "bg-blue-50 border-blue-200 text-blue-800",
    Icon: Clock,
    textKey: "portal_banner_pending",
  },
};

export default function PortalShell({
  demo,
  name,
  variant,
  endDate,
  children,
}: {
  demo: boolean;
  name: string;
  variant: PortalBannerVariant;
  endDate: string | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  const meta = BANNER_META[variant];
  const BannerIcon = meta.Icon;
  const bannerLine = t(meta.textKey).replace(
    "{date}",
    endDate ? formatDate(endDate) : "—"
  );

  return (
    <div className="pt-28 pb-24 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6 space-y-6">
        {/* Greeting + demo chip */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">{t("portal_title")}</p>
            <h1 className="heading-lg text-2xl md:text-3xl">
              {t("portal_greeting").replace("{name}", name)}
            </h1>
          </div>
          {demo && (
            <span className="shrink-0 text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-1 rounded-full">
              {t("badge_demo")}
            </span>
          )}
        </header>

        {/* Portal nav */}
        <nav aria-label={t("portal_title")} className="flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "chip chip-active" : "chip"}
                aria-current={active ? "page" : undefined}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        {/* Entitlement banner (variant-driven) */}
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 md:p-5 ${meta.wrap}`}
        >
          <BannerIcon className="h-5 w-5 mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">{bannerLine}</p>
        </div>

        <div>{children}</div>

        {/* Footer with sign-out (POST /api/auth/signout — existing route) */}
        <footer className="pt-8 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted leading-relaxed">
            {t("portal_footer_note")}
          </p>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="btn-secondary">
              <LogOut className="h-4 w-4" />
              {t("portal_signout")}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
