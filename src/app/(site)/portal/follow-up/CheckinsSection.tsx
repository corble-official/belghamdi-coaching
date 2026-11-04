"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  CircleAlert,
  History,
  Lock,
  RefreshCcw,
} from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import type { CheckinRequestItem } from "@/lib/checkins";

/**
 * Check-ins section on /portal/follow-up#checkins — the hub card's anchor
 * target. Fetches the caller's OWN open requests from
 * GET /api/portal/checkins?status=open (demo returns simulated rows, zero
 * Supabase/network) and links each into the per-request form.
 *
 * Gating is server-authoritative: `canSubmit`/`readonly`/`blocked` come from
 * `computeEntitlements()` on the server page, and the submit API re-checks
 * the same gates. Nothing here decides access on its own.
 */
export default function CheckinsSection({
  demo,
  canSubmit,
  readonly,
  blocked,
}: {
  demo: boolean;
  canSubmit: boolean;
  /** history-only (expired): read-only banner, submit CTA disabled. */
  readonly: boolean;
  /** read gate closed entirely (suspended/revoked). */
  blocked: boolean;
}) {
  const { t } = useI18n();

  const [requests, setRequests] = useState<CheckinRequestItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (blocked) return;
    try {
      const res = await fetch("/api/portal/checkins?status=open", {
        cache: "no-store",
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        requests?: unknown;
      };
      setRequests(Array.isArray(data.requests) ? (data.requests as CheckinRequestItem[]) : []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [blocked]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section id="checkins" className="scroll-mt-28 mt-8">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-brand-soft text-brand">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <h2 className="heading-lg text-lg">{t("checkins_section_title")}</h2>
          </div>
          {demo && (
            <span className="shrink-0 text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-1 rounded-full">
              {t("badge_demo")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted mt-2">
          {t("checkins_section_intro")}
        </p>
      </Reveal>

      {/* Locked (suspended/revoked) — no request rows even fetched. */}
      {blocked ? (
        <Reveal delay={0.03} className="mt-4">
          <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-cream text-muted">
                <Lock className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed text-muted max-w-md">
                {t("checkins_blocked_body")}
              </p>
            </div>
            <Link href="/portal/renewal" className="btn-primary">
              <RefreshCcw className="h-4 w-4" />
              {t("followup_locked_cta")}
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="mt-4 space-y-3">
          {/* history-only banner */}
          {readonly && (
            <Reveal delay={0.03}>
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-amber/60 bg-amber/15 p-4 text-ink"
              >
                <History className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm leading-relaxed">
                  {t("checkins_readonly_banner")}
                </p>
              </div>
            </Reveal>
          )}

          {requests === null && !failed && (
            <Reveal delay={0.03}>
              <div className="card-surface p-5 text-sm text-muted">
                {t("checkins_loading")}
              </div>
            </Reveal>
          )}

          {failed && (
            <Reveal delay={0.03}>
              <div className="card-surface p-5 flex items-start gap-3">
                <CircleAlert className="h-5 w-5 mt-0.5 shrink-0 text-red-700" />
                <div>
                  <p className="text-sm text-ink">{t("checkins_error")}</p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-2 text-xs font-bold text-brand hover:underline"
                  >
                    {t("checkins_retry")}
                  </button>
                </div>
              </div>
            </Reveal>
          )}

          {requests !== null && requests.length === 0 && (
            <Reveal delay={0.03}>
              <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm leading-relaxed text-muted max-w-md">
                  {t("checkins_section_empty")}
                </p>
                <Link href="/portal/progress" className="btn-secondary">
                  {t("checkins_view_history")}
                </Link>
              </div>
            </Reveal>
          )}

          {requests !== null &&
            requests.map((request, index) => (
              <Reveal key={request.id} delay={0.03 + index * 0.03}>
                <div className="card-surface p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="heading-lg text-base">
                      {request.period_label}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {request.due_date
                        ? t("checkins_due").replace(
                            "{date}",
                            formatDate(request.due_date)
                          )
                        : t("checkins_due_unknown")}
                    </p>
                  </div>
                  {canSubmit ? (
                    <Link
                      href={`/portal/checkins/${request.id}`}
                      className="btn-primary"
                    >
                      <CalendarCheck className="h-4 w-4" />
                      {t("checkins_submit_cta")}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[10px] font-display uppercase tracking-widest text-muted">
                      <Lock className="h-3 w-3" />
                      {t("portal_card_readonly")}
                    </span>
                  )}
                </div>
              </Reveal>
            ))}

          <Reveal delay={0.08}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/portal/progress"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                {t("checkins_view_history")}
              </Link>
              <p className="text-[11px] text-muted">{t("checkins_history_note")}</p>
            </div>
          </Reveal>
        </div>
      )}
    </section>
  );
}
