"use client";

import Link from "next/link";
import {
  ClipboardList,
  MessageSquare,
  CalendarCheck,
  TrendingUp,
  RefreshCcw,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import { formatDate } from "@/lib/utils";
import type { Entitlements } from "@/lib/supabase/entitlements";

/**
 * Hub cards — gated by computeEntitlements() outputs (passed in from the
 * server page). Locked cards render inert (no link) with a lock badge;
 * the history/progress card keeps a clickable link with a read-only chip
 * while checkin_history_readonly is the only open gate.
 */

type HubCard = {
  icon: LucideIcon;
  titleKey:
    | "portal_card_onboarding_title"
    | "portal_card_chat_title"
    | "portal_card_checkins_title"
    | "portal_card_progress_title"
    | "portal_card_renewal_title";
  descKey:
    | "portal_card_onboarding_desc"
    | "portal_card_chat_desc"
    | "portal_card_checkins_desc"
    | "portal_card_progress_desc"
    | "portal_card_renewal_desc";
  href: string;
  enabled: boolean;
  /** Sub-status chip rendered in the card corner. */
  chip: "locked" | "readonly" | null;
  /** Extra detail line (e.g. renewal period end). */
  note: string | null;
};

export default function PortalHub({
  demo,
  ent,
  endDate,
}: {
  demo: boolean;
  ent: Entitlements;
  endDate: string | null;
}) {
  const { t } = useI18n();

  // Demo contract: the simulated session reaches every card.
  const showOnboarding = demo || ent.onboarding_available;

  const periodLine = endDate
    ? t("portal_period_ends").replace("{date}", formatDate(endDate))
    : null;

  const cards: HubCard[] = [
    showOnboarding
      ? {
          icon: ClipboardList,
          titleKey: "portal_card_onboarding_title",
          descKey: "portal_card_onboarding_desc",
          href: "/portal/onboarding",
          enabled: true,
          chip: null,
          note: null,
        }
      : null,
    {
      icon: MessageSquare,
      titleKey: "portal_card_chat_title",
      descKey: "portal_card_chat_desc",
      href: "/portal/follow-up",
      enabled: ent.coach_chat,
      chip: ent.coach_chat ? null : "locked",
      note: null,
    },
    {
      icon: CalendarCheck,
      titleKey: "portal_card_checkins_title",
      descKey: "portal_card_checkins_desc",
      href: "/portal/follow-up#checkins",
      enabled: ent.weekly_checkins || ent.monthly_reviews,
      chip: ent.weekly_checkins || ent.monthly_reviews ? null : "locked",
      note: null,
    },
    {
      icon: TrendingUp,
      titleKey: "portal_card_progress_title",
      descKey: "portal_card_progress_desc",
      href: "/portal/progress",
      enabled: ent.progress_submissions || ent.checkin_history_readonly,
      chip:
        ent.checkin_history_readonly && !ent.progress_submissions
          ? "readonly"
          : ent.progress_submissions
            ? null
            : "locked",
      note: null,
    },
    // Renewal is the remediation path — always visible AND open.
    {
      icon: RefreshCcw,
      titleKey: "portal_card_renewal_title",
      descKey: "portal_card_renewal_desc",
      href: "/portal/renewal",
      enabled: true,
      chip: null,
      note: periodLine,
    },
  ].filter(Boolean) as HubCard[];

  return (
    <section className="pt-4">
      <Reveal>
        <div className="mb-8">
          <p className="eyebrow mb-2">{t("portal_hub_eyebrow")}</p>
          <h2 className="heading-lg text-3xl md:text-4xl">
            {t("portal_hub_title")}
          </h2>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2">
        {cards.map((card, index) => {
          const CardIcon = card.icon;
          // Odd card count: let the final card span the full row so the grid
          // never leaves a half-empty trailing cell.
          const wide = cards.length % 2 === 1 && index === cards.length - 1;
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl ${
                    card.enabled
                      ? "bg-brand-soft text-brand"
                      : "bg-cream text-muted"
                  }`}
                >
                  <CardIcon className="h-5 w-5" />
                </span>
                {card.chip === "locked" && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full text-[10px] font-display uppercase tracking-widest text-muted border border-line px-2.5 py-1">
                    <Lock className="h-3 w-3" />
                    {t("portal_card_locked")}
                  </span>
                )}
                {card.chip === "readonly" && (
                  <span className="shrink-0 rounded-full text-[10px] font-display uppercase tracking-widest text-forest border border-forest/40 bg-forest-soft px-2.5 py-1">
                    {t("portal_card_readonly")}
                  </span>
                )}
              </div>
              <h3 className="heading-lg text-lg mt-4">{t(card.titleKey)}</h3>
              <p className="text-sm leading-relaxed text-muted mt-1.5">
                {t(card.descKey)}
              </p>
              {card.note && (
                <p className="text-xs font-bold text-ink mt-3">{card.note}</p>
              )}
            </>
          );

          if (card.enabled) {
            return (
              <Reveal
                key={card.href}
                delay={index * 0.05}
                className={wide ? "sm:col-span-2" : undefined}
              >
                <Link
                  href={card.href}
                  className="card-surface p-6 block h-full transition-all duration-300 ease-cinematic hover:-translate-y-0.5 hover:border-brand"
                >
                  {inner}
                </Link>
              </Reveal>
            );
          }

          return (
            <Reveal
              key={card.href}
              delay={index * 0.05}
              className={wide ? "sm:col-span-2" : undefined}
            >
              <div
                aria-disabled="true"
                className="card-surface p-6 h-full opacity-60 select-none"
              >
                {inner}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
