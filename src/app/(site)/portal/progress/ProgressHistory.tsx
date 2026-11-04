"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CircleAlert,
  History,
  ImageOff,
  Lock,
  RefreshCcw,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import {
  MEASUREMENT_KEYS,
  byPeriodAsc,
  seriesDelta,
  sparkGeometry,
  type MeasurementKey,
  type ProgressEntry,
} from "@/lib/checkins";

/**
 * Progress history — past check-ins rendered from server-provided rows.
 *
 * - Trend charts are inline SVG (`sparkGeometry`), no chart library.
 * - Photos are pre-signed server-side (10-min TTL, own prefix only); a null
 *   URL renders an "unavailable" tile instead of a broken image.
 * - Read-only mode (expired subscription) keeps the whole history visible and
 *   only disables the submit CTA — expiry never deletes history.
 */

type TFn = ReturnType<typeof useI18n>["t"];
type TKey = Parameters<TFn>[0];

const MEASUREMENT_LABEL: Record<MeasurementKey, TKey> = {
  chest: "checkin_measure_chest",
  waist: "checkin_measure_waist",
  hips: "checkin_measure_hips",
  arm: "checkin_measure_arm",
  thigh: "checkin_measure_thigh",
};

export default function ProgressHistory({
  demo,
  entries,
  readonly,
  canSubmit,
  blocked = false,
  readError = false,
}: {
  demo: boolean;
  entries: ProgressEntry[];
  readonly: boolean;
  canSubmit: boolean;
  /** Read gate closed entirely (suspended/revoked). */
  blocked?: boolean;
  readError?: boolean;
}) {
  const { t } = useI18n();

  if (blocked || readError) {
    const Icon: LucideIcon = blocked ? Lock : CircleAlert;
    return (
      <Reveal className="pt-4">
        <div className="card-surface p-8 md:p-10 text-center">
          <span className="mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-cream text-muted">
            <Icon className="h-7 w-7" />
          </span>
          <h2 className="heading-lg text-2xl md:text-3xl">
            {t(blocked ? "progress_blocked_title" : "progress_error_title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
            {t(blocked ? "progress_blocked_body" : "progress_error_body")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {blocked && (
              <Link href="/portal/renewal" className="btn-primary">
                <RefreshCcw className="h-4 w-4" />
                {t("followup_locked_cta")}
              </Link>
            )}
            <Link href="/portal" className="btn-secondary">
              {t("onboarding_back_to_hub")}
            </Link>
          </div>
        </div>
      </Reveal>
    );
  }

  const ascending = [...entries].sort(byPeriodAsc);
  const weights = ascending
    .map((e) => e.submission.weight_kg)
    .filter((v): v is number => v !== null);
  const waist = ascending
    .map((e) => e.submission.measurements?.waist)
    .filter((v): v is number => typeof v === "number");

  const weightGeometry = sparkGeometry(weights);
  const waistGeometry = sparkGeometry(waist);
  const weightDelta = seriesDelta(weights);

  return (
    <section className="pt-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow mb-0">{t("progress_title")}</p>
          {demo && (
            <span className="text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-0.5 rounded-full">
              {t("badge_demo")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted mt-1.5">
          {t("progress_intro")}
        </p>
      </Reveal>

      {/* Read-only (expired) banner — history stays, submitting pauses. */}
      {readonly && (
        <Reveal delay={0.03} className="mt-5">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-amber/60 bg-amber/15 p-4 text-ink"
          >
            <History className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{t("progress_readonly_banner")}</p>
          </div>
        </Reveal>
      )}

      {entries.length === 0 ? (
        <Reveal delay={0.05} className="mt-6">
          <div className="card-surface p-8 md:p-10 text-center">
            <span className="mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-cream text-muted">
              <TrendingUp className="h-7 w-7" />
            </span>
            <h2 className="heading-lg text-xl md:text-2xl">
              {t("progress_empty_title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
              {t("progress_empty_body")}
            </p>
            {canSubmit && (
              <Link href="/portal/follow-up#checkins" className="btn-primary mt-8">
                <CalendarCheck className="h-4 w-4" />
                {t("progress_cta_checkin")}
              </Link>
            )}
          </div>
        </Reveal>
      ) : (
        <>
          {/* Charts */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <TrendCard
              titleKey="progress_weight_chart_title"
              geometry={weightGeometry}
              unitKey="progress_units_kg"
              delta={weightDelta}
              emptyKey="progress_chart_empty"
            />
            <TrendCard
              titleKey="progress_waist_chart_title"
              geometry={waistGeometry}
              unitKey="progress_units_cm"
              delta={seriesDelta(waist)}
              emptyKey="progress_chart_empty"
            />
          </div>

          {/* Entry list (newest first — entries arrive that way) */}
          <ul className="mt-6 space-y-5">
            {entries.map((entry) => (
              <li key={entry.submission.id}>
                <EntryCard entry={entry} />
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[11px] text-muted leading-relaxed">
            {t("progress_photos_note")}
          </p>
        </>
      )}

      {canSubmit && entries.length > 0 && (
        <Reveal delay={0.1} className="mt-8">
          <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-brand-soft text-brand">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <p className="text-sm text-ink">{t("progress_cta_note")}</p>
            </div>
            <Link href="/portal/follow-up#checkins" className="btn-primary">
              {t("progress_cta_checkin")}
            </Link>
          </div>
        </Reveal>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- helpers */

function TrendCard({
  titleKey,
  geometry,
  unitKey,
  delta,
  emptyKey,
}: {
  titleKey: TKey;
  geometry: ReturnType<typeof sparkGeometry>;
  unitKey: TKey;
  delta: number | null;
  emptyKey: TKey;
}) {
  const { t } = useI18n();
  const unit = t(unitKey);

  return (
    <Reveal>
      <div className="card-surface p-5 md:p-6 h-full">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">{t(titleKey)}</h2>
          {delta !== null && (
            <span
              className={`text-xs font-bold ${
                delta <= 0 ? "text-forest" : "text-brand-deep"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta} {unit}
            </span>
          )}
        </div>

        {geometry ? (
          <svg
            viewBox="0 0 320 96"
            role="img"
            aria-label={t(titleKey)}
            className="mt-4 w-full h-24"
            preserveAspectRatio="none"
          >
            <polyline
              points={geometry.points}
              fill="none"
              stroke="#315C45"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {geometry.dots.map((dot, index) => (
              <circle
                key={index}
                cx={dot.x}
                cy={dot.y}
                r="3"
                fill="#F47B35"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        ) : (
          <p className="mt-4 text-xs text-muted">{t(emptyKey)}</p>
        )}
      </div>
    </Reveal>
  );
}

function ReviewChip({ entry }: { entry: ProgressEntry }) {
  const { t } = useI18n();
  const review = entry.submission.review;

  if (!review) {
    return (
      <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-display uppercase tracking-widest text-muted">
        {t("progress_review_none")}
      </span>
    );
  }
  if (review.status === "approved") {
    return (
      <span className="shrink-0 rounded-full border border-forest/40 bg-forest-soft px-2.5 py-1 text-[10px] font-display uppercase tracking-widest text-forest">
        {t("progress_review_approved")}
      </span>
    );
  }
  if (review.status === "needs_work") {
    return (
      <span className="shrink-0 rounded-full border border-amber/60 bg-amber/15 px-2.5 py-1 text-[10px] font-display uppercase tracking-widest text-ink">
        {t("progress_review_needs_work")}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10px] font-display uppercase tracking-widest text-muted">
      {t("progress_review_pending")}
    </span>
  );
}

function Metric({ labelKey, value }: { labelKey: TKey; value: string | null }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-line bg-cream/60 px-3 py-2">
      <p className="text-[10px] font-display uppercase tracking-widest text-muted">
        {t(labelKey)}
      </p>
      <p className="text-sm font-bold text-ink mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

function EntryCard({ entry }: { entry: ProgressEntry }) {
  const { t } = useI18n();
  const sub = entry.submission;

  const measurements = MEASUREMENT_KEYS.map((key) => ({
    key,
    value: sub.measurements?.[key] ?? null,
  })).filter((m) => m.value !== null);

  return (
    <Reveal>
      <article className="card-surface p-5 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="heading-lg text-base md:text-lg">
              {t("checkins_period").replace("{label}", entry.request.period_label)}
            </h3>
            <p className="text-xs text-muted mt-1">
              {sub.submitted_at
                ? t("progress_submitted_on").replace(
                    "{date}",
                    formatDate(sub.submitted_at)
                  )
                : t("progress_submitted_unknown")}
            </p>
          </div>
          <ReviewChip entry={entry} />
        </header>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Metric
            labelKey="progress_metric_weight"
            value={sub.weight_kg !== null ? `${sub.weight_kg} ${t("progress_units_kg")}` : null}
          />
          <Metric
            labelKey="progress_metric_days"
            value={sub.training_days_made !== null ? String(sub.training_days_made) : null}
          />
          <Metric
            labelKey="progress_metric_workout"
            value={sub.workout_pct !== null ? `${sub.workout_pct}%` : null}
          />
          <Metric
            labelKey="progress_metric_nutrition"
            value={sub.nutrition_pct !== null ? `${sub.nutrition_pct}%` : null}
          />
          <Metric labelKey="progress_metric_energy" value={sub.energy !== null ? `${sub.energy}/10` : null} />
          <Metric labelKey="progress_metric_sleep" value={sub.sleep !== null ? `${sub.sleep}/10` : null} />
        </div>

        {measurements.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-display uppercase tracking-widest text-muted">
              {t("checkin_label_measurements")}
            </p>
            <p className="text-sm text-ink mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {measurements.map((m) => (
                <span key={m.key}>
                  {t(MEASUREMENT_LABEL[m.key])}{" "}
                  <span className="font-bold">{m.value}</span>{" "}
                  {t("progress_units_cm")}
                </span>
              ))}
            </p>
          </div>
        )}

        {(sub.difficulties || sub.feedback) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {sub.difficulties && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted">
                  {t("checkin_label_difficulties")}
                </p>
                <p className="text-sm leading-relaxed text-ink mt-1 whitespace-pre-wrap break-words">
                  {sub.difficulties}
                </p>
              </div>
            )}
            {sub.feedback && (
              <div>
                <p className="text-[10px] font-display uppercase tracking-widest text-muted">
                  {t("checkin_label_feedback")}
                </p>
                <p className="text-sm leading-relaxed text-ink mt-1 whitespace-pre-wrap break-words">
                  {sub.feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {sub.review?.feedback && (
          <div className="mt-4 rounded-xl border border-forest/30 bg-forest-soft p-3.5">
            <p className="text-[10px] font-display uppercase tracking-widest text-forest">
              {t("progress_review_label")}
            </p>
            <p className="text-sm leading-relaxed text-ink mt-1 whitespace-pre-wrap break-words">
              {sub.review.feedback}
            </p>
          </div>
        )}

        {sub.photos.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-display uppercase tracking-widest text-muted mb-2">
              {t("checkin_label_photos")}
            </p>
            <ul className="flex flex-wrap gap-2.5">
              {sub.photos.map((photo) => (
                <li key={photo.path}>
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={t("progress_photo_alt")}
                      className="h-20 w-20 rounded-xl border border-line object-cover bg-cream"
                    />
                  ) : (
                    <span className="inline-flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-cream text-muted">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[9px] text-center px-1">
                        {t("progress_photo_unavailable")}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </Reveal>
  );
}
