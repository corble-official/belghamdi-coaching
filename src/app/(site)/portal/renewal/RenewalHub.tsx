"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  History,
  MessageCircle,
  PackageX,
  RefreshCcw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";
import { BUSINESS, COACHING_PACKAGES, getCoachingPackage } from "@/lib/catalog";
import { formatDate, formatMoney } from "@/lib/utils";
import { recordDelivery } from "@/lib/integrations/outbox";
import type {
  RenewalEventView,
  RenewalOrderView,
  RenewalRequestView,
  RenewalSubscriptionView,
} from "@/lib/renewal";
import type { DeliveryRecord } from "@/lib/integrations/contracts";

/**
 * Renewal hub — client component (Task 9, REQUEST ONLY).
 *
 * The POST records a renewal REQUEST and pings the coach (BC-06 task) —
 * it NEVER activates anything. Access restores only when the store payment
 * is verified (server-side provider event), which the UI states explicitly.
 */

export type RenewalDataView = {
  demo: boolean;
  subscription: RenewalSubscriptionView | null;
  events: RenewalEventView[];
  orders: RenewalOrderView[];
  orders_error: boolean;
  renewal_requests: RenewalRequestView[];
};

type StatusVariant =
  | "active"
  | "expired"
  | "cancelled"
  | "refunded"
  | "disputed"
  | "suspended"
  | "pending";

const VARIANT_BY_STATUS: Record<string, StatusVariant> = {
  active: "active",
  expired: "expired",
  cancelled: "cancelled",
  refunded: "refunded",
  disputed: "disputed",
  suspended: "suspended",
  pending: "pending",
};

const VARIANT_CHIP: Record<StatusVariant, string> = {
  active: "border-forest/40 bg-forest-soft text-forest",
  expired: "border-amber/60 bg-amber/15 text-ink",
  cancelled: "border-amber/60 bg-amber/15 text-ink",
  refunded: "border-red-200 bg-red-50 text-red-700",
  disputed: "border-red-200 bg-red-50 text-red-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
  pending: "border-blue-200 bg-blue-50 text-blue-800",
};

const VARIANT_NOTICE: Record<
  StatusVariant,
  { wrap: string; icon: LucideIcon; titleKey: string; bodyKey: string }
> = {
  active: {
    wrap: "border-forest/30 bg-forest-soft text-forest",
    icon: CheckCircle2,
    titleKey: "renewal_notice_active_title",
    bodyKey: "renewal_notice_active_body",
  },
  expired: {
    wrap: "border-amber/60 bg-amber/15 text-ink",
    icon: History,
    titleKey: "renewal_notice_expired_title",
    bodyKey: "renewal_notice_expired_body",
  },
  cancelled: {
    wrap: "border-amber/60 bg-amber/15 text-ink",
    icon: History,
    titleKey: "renewal_notice_cancelled_title",
    bodyKey: "renewal_notice_cancelled_body",
  },
  refunded: {
    wrap: "border-red-200 bg-red-50 text-red-700",
    icon: PackageX,
    titleKey: "renewal_notice_refunded_title",
    bodyKey: "renewal_notice_refunded_body",
  },
  disputed: {
    wrap: "border-red-200 bg-red-50 text-red-700",
    icon: ShieldAlert,
    titleKey: "renewal_notice_disputed_title",
    bodyKey: "renewal_notice_disputed_body",
  },
  suspended: {
    wrap: "border-red-200 bg-red-50 text-red-700",
    icon: ShieldAlert,
    titleKey: "renewal_notice_suspended_title",
    bodyKey: "renewal_notice_suspended_body",
  },
  pending: {
    wrap: "border-blue-200 bg-blue-50 text-blue-800",
    icon: AlertTriangle,
    titleKey: "renewal_notice_pending_title",
    bodyKey: "renewal_notice_pending_body",
  },
};

type EventGroup = "good" | "warn" | "bad" | "neutral";

const eventGroup = (eventType: string): EventGroup => {
  const t = eventType.toLowerCase();
  if (/(refund|dispute)/.test(t)) return "bad";
  if (/(cancel|expired|suspend|revoked)/.test(t)) return "warn";
  if (/(payment_verified|activated|renewed|extended|manual_extended)/.test(t))
    return "good";
  return "neutral";
};

const EVENT_DOT: Record<EventGroup, string> = {
  good: "bg-forest",
  warn: "bg-amber",
  bad: "bg-red-500",
  neutral: "bg-muted/60",
};

const EVENT_LABEL: Record<string, string> = {
  payment_verified: "renewal_event_payment_verified",
  activated: "renewal_event_activated",
  renewed: "renewal_event_renewed",
  extended: "renewal_event_extended",
  manual_extended: "renewal_event_extended",
  cancelled: "renewal_event_cancelled",
  expired: "renewal_event_expired",
  refunded_full: "renewal_event_refunded_full",
  refunded_partial: "renewal_event_refunded_partial",
  refunded_part: "renewal_event_refunded_partial",
  dispute_opened: "renewal_event_dispute_opened",
  disputed: "renewal_event_dispute_opened",
  dispute_resolved: "renewal_event_dispute_resolved",
};

type TFn = ReturnType<typeof useI18n>["t"];
type TKey = Parameters<TFn>[0];

const statusKey = (variant: StatusVariant): TKey =>
  `renewal_status_${variant}` as TKey;

export default function RenewalHub({
  demo,
  data,
  readError = false,
}: {
  demo: boolean;
  data: RenewalDataView | null;
  readError?: boolean;
}) {
  const { t } = useI18n();
  const [preferred, setPreferred] = useState<"silver" | "gold" | "none">("none");
  const [phase, setPhase] = useState<"idle" | "submitting" | "requested" | "error">(
    "idle"
  );
  const [requestInfo, setRequestInfo] = useState<{
    orderRef: string;
    packagePref: string | null;
  } | null>(null);
  const [requests, setRequests] = useState<RenewalRequestView[]>(
    data?.renewal_requests ?? []
  );

  if (readError) {
    return (
      <Reveal className="pt-4">
        <div className="card-surface p-8 md:p-10 text-center">
          <span className="mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-cream text-muted">
            <CircleAlert className="h-7 w-7" />
          </span>
          <h2 className="heading-lg text-2xl md:text-3xl">
            {t("renewal_error_title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
            {t("renewal_error_body")}
          </p>
          <div className="mt-8">
            <Link href="/portal" className="btn-secondary">
              {t("onboarding_back_to_hub")}
            </Link>
          </div>
        </div>
      </Reveal>
    );
  }

  const sub = data?.subscription ?? null;
  const variant: StatusVariant = VARIANT_BY_STATUS[sub?.status ?? "pending"] ?? "pending";
  const notice = VARIANT_NOTICE[variant];
  const NoticeIcon = notice.icon;
  const pkgId =
    sub?.package_id === "silver" || sub?.package_id === "gold"
      ? sub.package_id
      : null;
  const pkg = pkgId ? getCoachingPackage(pkgId) : undefined;
  const statusChip = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-display uppercase tracking-widest ${VARIANT_CHIP[variant]}`;
  const showEarlyCta = variant === "active";

  const submit = async () => {
    if (phase === "submitting") return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/portal/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          preferred === "none" ? {} : { package_pref: preferred }
        ),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        order_ref?: string;
        package_pref?: string | null;
        renewal_request?: RenewalRequestView | null;
        delivery?: DeliveryRecord | null;
      };
      if (!res.ok || !json.ok) throw new Error("renewal_failed");
      // Demo outbox seam — mirrors the coaching/contact pages: the route's
      // synthetic skipped record is persisted locally so the Automation
      // Center shows the simulated communication. Never logged as a
      // lifecycle event (a request is NOT a renewal).
      if (json.delivery) recordDelivery(json.delivery as DeliveryRecord);
      setRequestInfo({
        orderRef: json.order_ref ?? json.renewal_request?.order_ref ?? "—",
        packagePref: json.package_pref ?? null,
      });
      if (json.renewal_request) {
        setRequests((prev) => [json.renewal_request as RenewalRequestView, ...prev]);
      }
      setPhase("requested");
    } catch {
      setPhase("error");
    }
  };

  return (
    <section className="pt-4">
      {/* Header */}
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow mb-0">{t("renewal_title")}</p>
          {demo && (
            <span className="text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-0.5 rounded-full">
              {t("badge_demo")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted mt-1.5">
          {t("renewal_intro")}
        </p>
      </Reveal>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        {/* ===================== Subscription card + status ===================== */}
        <Reveal delay={0.03} className="lg:col-span-2">
          <div className="card-surface p-6 h-full flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="heading-lg text-base">{t("renewal_sub_card_title")}</h2>
              <span className={statusChip}>{t(statusKey(variant))}</span>
            </div>

            {sub ? (
              <div className="mt-4 flex-1">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-brand-soft text-brand">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="heading-lg text-lg">
                      {pkg?.name ?? t("renewal_package_unknown")}
                    </p>
                    {demo && pkg && (
                      <p className="text-xs text-muted mt-0.5">
                        {formatMoney(pkg.price)} / mo — {t("renewal_price_demo_note")}
                      </p>
                    )}
                  </div>
                </div>

                <dl className="mt-5 space-y-2.5 text-sm">
                  {sub.subscription_code && (
                    <div className="flex items-center justify-between gap-3 border-b border-line/70 pb-2">
                      <dt className="text-muted">{t("renewal_sub_code")}</dt>
                      <dd className="font-mono text-xs text-ink">{sub.subscription_code}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-b border-line/70 pb-2">
                    <dt className="text-muted">{t("renewal_sub_period")}</dt>
                    <dd className="text-ink text-end">
                      {formatDate(sub.start_date)} – {formatDate(sub.end_date)}
                    </dd>
                  </div>
                </dl>

                {/* State variant notice */}
                <div
                  role="status"
                  className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${notice.wrap}`}
                >
                  <NoticeIcon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {t(notice.titleKey as TKey)}
                    </p>
                    <p className="text-xs leading-relaxed text-ink/80 mt-1">
                      {t(notice.bodyKey as TKey)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted">
                {t("renewal_package_unknown")}
              </p>
            )}
          </div>
        </Reveal>

        {/* ===================== CTA / success card ===================== */}
        <Reveal delay={0.06} className="lg:col-span-3">
          {phase === "requested" && requestInfo ? (
            <div className="card-surface p-6 md:p-8 h-full">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-forest-soft text-forest">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <h2 className="heading-lg text-xl md:text-2xl mt-4">
                {t("renewal_requested_title")}
              </h2>
              <p className="text-sm leading-relaxed text-muted mt-2">
                {t("renewal_requested_body")}
              </p>
              <p className="mt-4 text-xs font-mono text-ink bg-cream border border-line rounded-xl px-3 py-2 inline-block">
                {t("renewal_requested_ref").replace("{ref}", requestInfo.orderRef)}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={BUSINESS.whatsappLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-primary"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("renewal_requested_whatsapp")}
                </a>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPhase("idle")}
                >
                  {t("renewal_requested_again")}
                </button>
              </div>
            </div>
          ) : (
            <div className="card-surface p-6 md:p-8 h-full flex flex-col">
              <div className="flex items-center gap-3">
                <span className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-brand-soft text-brand">
                  <RefreshCcw className="h-5 w-5" />
                </span>
                <h2 className="heading-lg text-lg">
                  {showEarlyCta ? t("renewal_cta_active") : t("renewal_cta")}
                </h2>
              </div>

              {phase === "error" && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
                >
                  <CircleAlert className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      {t("renewal_requested_error_title")}
                    </p>
                    <p className="text-xs leading-relaxed text-red-700 mt-1">
                      {t("renewal_requested_error_body")}
                    </p>
                  </div>
                </div>
              )}

              <fieldset className="mt-5">
                <legend className="text-xs font-bold text-muted mb-2">
                  {t("renewal_package_label")}
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {COACHING_PACKAGES.map((pkg) => (
                    <label
                      key={pkg.id}
                      className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                        preferred === pkg.id
                          ? "border-brand bg-brand-soft/40"
                          : "border-line bg-cream/40 hover:border-brand/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="package_pref"
                        value={pkg.id}
                        checked={preferred === pkg.id}
                        onChange={() => setPreferred(pkg.id)}
                        className="sr-only"
                      />
                      <span className="block font-display font-bold text-ink">
                        {pkg.name}
                      </span>
                      {demo && (
                        <span className="block text-xs text-muted mt-1">
                          {formatMoney(pkg.price)} / mo
                        </span>
                      )}
                    </label>
                  ))}
                  <label
                    className={`cursor-pointer rounded-2xl border p-4 transition-colors flex flex-col justify-center ${
                      preferred === "none"
                        ? "border-brand bg-brand-soft/40"
                        : "border-line bg-cream/40 hover:border-brand/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="package_pref"
                      value="none"
                      checked={preferred === "none"}
                      onChange={() => setPreferred("none")}
                      className="sr-only"
                    />
                    <span className="block font-display font-bold text-ink">
                      {t("renewal_package_no_pref")}
                    </span>
                  </label>
                </div>
              </fieldset>

              <p className="mt-4 text-[11px] leading-relaxed text-muted">
                {t("renewal_cta_note")}
              </p>

              <div className="mt-5 flex-1" />
              <button
                type="button"
                onClick={submit}
                disabled={phase === "submitting"}
                className="btn-primary w-full sm:w-auto disabled:opacity-60 disabled:cursor-wait"
              >
                <RefreshCcw className="h-4 w-4" />
                {phase === "submitting" ? t("renewal_submitting") : t("renewal_submit")}
              </button>
            </div>
          )}
        </Reveal>
      </div>

      {/* ===================== Renewal requests history ===================== */}
      {requests.length > 0 && (
        <Reveal delay={0.08} className="mt-6">
          <div className="card-surface p-6">
            <h2 className="text-sm font-bold text-ink">{t("renewal_requests_title")}</h2>
            <ul className="mt-3 divide-y divide-line/70">
              {requests.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-ink">
                    {r.order_ref ?? r.id}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {r.package_pref && (r.package_pref === "silver" || r.package_pref === "gold")
                        ? (getCoachingPackage(r.package_pref)?.name ?? r.package_pref)
                        : t("renewal_package_no_pref")}
                    </span>
                    <span className="text-xs text-muted">{formatDate(r.requested_at)}</span>
                    {r.demo && (
                      <span className="text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2 py-0.5 rounded-full">
                        {t("badge_demo")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      {/* ===================== Orders (own payments) ===================== */}
      <Reveal delay={0.1} className="mt-6">
        <div className="card-surface overflow-x-auto">
          <h2 className="text-sm font-bold text-ink px-6 pt-6">
            {t("renewal_orders_title")}
          </h2>
          {data?.orders_error ? (
            <p className="text-xs leading-relaxed text-amber-800 bg-amber/15 border border-amber/50 rounded-2xl px-4 py-3 mx-6 mt-4 mb-6">
              {t("renewal_orders_error")}
            </p>
          ) : data && data.orders.length > 0 ? (
            <table className="w-full min-w-[640px] mt-4">
              <thead>
                <tr>
                  <th className="table-head">{t("renewal_order_ref")}</th>
                  <th className="table-head">{t("renewal_order_product")}</th>
                  <th className="table-head">{t("renewal_order_amount")}</th>
                  <th className="table-head">{t("renewal_order_status")}</th>
                  <th className="table-head">{t("renewal_order_date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="table-cell font-mono text-xs">
                      {order.order_ref ?? order.id}
                      {order.kind === "renewal" && (
                        <span className="ms-2 align-middle text-[9px] font-display uppercase tracking-widest text-forest border border-forest/40 bg-forest-soft px-1.5 py-0.5 rounded-full">
                          {t("renewal_event_renewed")}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-muted">{order.product ?? "—"}</td>
                    <td className="table-cell">
                      {order.total !== null
                        ? formatMoney(order.total, order.currency)
                        : "—"}
                    </td>
                    <td className="table-cell text-muted">{order.status}</td>
                    <td className="table-cell text-xs text-muted">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted px-6 py-6">{t("renewal_orders_empty")}</p>
          )}
        </div>
      </Reveal>

      {/* ===================== Timeline (subscription events) ===================== */}
      <Reveal delay={0.12} className="mt-6">
        <div className="card-surface p-6">
          <h2 className="text-sm font-bold text-ink">{t("renewal_timeline_title")}</h2>
          {data && data.events.length > 0 ? (
            <ul className="mt-4 space-y-0">
              {data.events.map((event, index) => {
                const labelKey = EVENT_LABEL[event.event_type];
                const label = labelKey ? t(labelKey as TKey) : event.event_type;
                return (
                  <li
                    key={event.id || `${event.event_type}-${index}`}
                    className="flex items-start gap-3 py-2.5 border-b border-line/60 last:border-0"
                  >
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${EVENT_DOT[eventGroup(event.event_type)]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{label}</p>
                      {event.payload_reference && (
                        <p className="font-mono text-[10px] text-muted truncate">
                          {event.payload_reference}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {formatDate(event.occurred_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted mt-3">{t("renewal_events_empty")}</p>
          )}
        </div>
      </Reveal>
    </section>
  );
}
