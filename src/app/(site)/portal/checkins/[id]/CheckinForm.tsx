"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Camera,
  CheckCircle2,
  CircleAlert,
  History,
  Lock,
  RefreshCcw,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import {
  CHECKIN_LIMITS,
  CHECKIN_PHOTO_ACCEPT,
  CHECKIN_PHOTO_TYPES,
  MAX_CHECKIN_PHOTO_BYTES,
  MAX_CHECKIN_PHOTOS,
  MEASUREMENT_KEYS,
  round1,
  type CheckinRequestItem,
  type CheckinSubmissionView,
  type MeasurementKey,
} from "@/lib/checkins";

/**
 * Check-in form — mirrors the LIVE telegram check-in form
 * (`n8n/belghamdi-automation/chunks/form-checkin.html`) field for field,
 * plus the portal-only measurement fields and real photo uploads:
 *
 *   weight_kg 30..300 · workout_pct / nutrition_pct 0..100 (steps of 5)
 *   training_days_made 0..7 · energy / sleep 1..10 scale
 *   difficulties / feedback free text · up to 3 photos (jpg/png/webp ≤10MB)
 *
 * Photos upload IMMEDIATELY through /api/portal/checkins/upload (one file at
 * a time) and the returned OBJECT PATH is what the submit body carries —
 * never a local file and never a foreign path. Demo mode simulates the
 * upload server-side (zero Supabase/network).
 *
 * Terminal variants (server-derived): already submitted, gate locked,
 * history-only read-only, request not found.
 */

type TFn = ReturnType<typeof useI18n>["t"];
type TKey = Parameters<TFn>[0];

type ErrorKey =
  | "checkin_error_required"
  | "checkin_error_range"
  | "checkin_error_photo_limit"
  | "checkin_error_photo_type"
  | "checkin_error_photo_size"
  | "checkin_error_photo_failed"
  | "checkin_error_locked"
  | "checkin_error_already"
  | "checkin_error_generic";

type PhotoDraft = { path: string; name: string };

type View = "form" | "success" | "already" | "locked" | "notfound";

const mapApiError = (code: unknown): ErrorKey => {
  switch (code) {
    case "feature_locked":
    case "no_linked_client":
    case "submission_rejected":
      return "checkin_error_locked";
    case "already_submitted":
      return "checkin_error_already";
    case "measurement_required":
      return "checkin_error_required";
    case "weight_out_of_range":
    case "measurements_invalid":
    case "invalid_field":
      return "checkin_error_range";
    case "photos_invalid":
    case "too_many_photos":
      return "checkin_error_photo_limit";
    default:
      return "checkin_error_generic";
  }
};

const MEASUREMENT_LABEL: Record<MeasurementKey, TKey> = {
  chest: "checkin_measure_chest",
  waist: "checkin_measure_waist",
  hips: "checkin_measure_hips",
  arm: "checkin_measure_arm",
  thigh: "checkin_measure_thigh",
};

export default function CheckinForm({
  demo,
  request,
  submission,
  lastWeightKg,
  canSubmit,
  historyReadonly,
  readBlocked = false,
}: {
  demo: boolean;
  request: CheckinRequestItem | null;
  submission: CheckinSubmissionView | null;
  lastWeightKg: number | null;
  canSubmit: boolean;
  historyReadonly: boolean;
  /** Read gate closed entirely (suspended/revoked) → locked card, no data. */
  readBlocked?: boolean;
}) {
  const { t } = useI18n();

  const initialView: View = readBlocked
    ? "locked"
    : !request
      ? "notfound"
      : submission || request.submitted
        ? "already"
        : !canSubmit
          ? "locked"
          : "form";

  const [view, setView] = useState<View>(initialView);
  const [weight, setWeight] = useState("");
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, string>>({
    chest: "",
    waist: "",
    hips: "",
    arm: "",
    thigh: "",
  });
  const [days, setDays] = useState("0");
  const [workoutPct, setWorkoutPct] = useState("100");
  const [nutritionPct, setNutritionPct] = useState("100");
  const [energy, setEnergy] = useState("5");
  const [sleep, setSleep] = useState("5");
  const [difficulties, setDifficulties] = useState("");
  const [feedback, setFeedback] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  const requestId = request?.id ?? "";

  /* ------------------------------------------------------- photo upload */

  const onPickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    if (!file || uploading || busy) return;

    if (photos.length >= MAX_CHECKIN_PHOTOS) {
      setErrorKey("checkin_error_photo_limit");
      return;
    }
    if (!(CHECKIN_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setErrorKey("checkin_error_photo_type");
      return;
    }
    if (file.size > MAX_CHECKIN_PHOTO_BYTES) {
      setErrorKey("checkin_error_photo_size");
      return;
    }

    setUploading(true);
    setErrorKey(null);
    try {
      const form = new FormData();
      form.append("request_id", requestId);
      form.append("file", file);

      const res = await fetch("/api/portal/checkins/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        path?: unknown;
        error?: unknown;
      };

      if (!res.ok || typeof data.path !== "string") {
        setErrorKey(
          data.error === "file_too_large"
            ? "checkin_error_photo_size"
            : data.error === "unsupported_type"
              ? "checkin_error_photo_type"
              : data.error === "feature_locked"
                ? "checkin_error_locked"
                : "checkin_error_photo_failed"
        );
        return;
      }

      setPhotos((prev) => [
        ...prev,
        { path: data.path as string, name: file.name },
      ]);
    } catch {
      setErrorKey("checkin_error_photo_failed");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (path: string) => {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  };

  /* ------------------------------------------------------------- submit */

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || uploading) return;

    const weightValue = weight.trim() === "" ? null : Number(weight);
    if (
      weightValue !== null &&
      (!Number.isFinite(weightValue) ||
        weightValue < CHECKIN_LIMITS.weightMin ||
        weightValue > CHECKIN_LIMITS.weightMax)
    ) {
      setErrorKey("checkin_error_range");
      return;
    }

    const measurementPayload: Partial<Record<MeasurementKey, number>> = {};
    for (const key of MEASUREMENT_KEYS) {
      const raw = measurements[key].trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 20 || value > 250) {
        setErrorKey("checkin_error_range");
        return;
      }
      measurementPayload[key] = round1(value);
    }

    if (weightValue === null && Object.keys(measurementPayload).length === 0) {
      setErrorKey("checkin_error_required");
      return;
    }

    setBusy(true);
    setErrorKey(null);

    try {
      const res = await fetch("/api/portal/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Ownership (client id) is NEVER part of the body — the server
          // derives it from the session and validates the photo paths.
          request_id: requestId,
          weight_kg: weightValue,
          measurements:
            Object.keys(measurementPayload).length > 0
              ? measurementPayload
              : undefined,
          training_days_made: Number(days),
          workout_pct: Number(workoutPct),
          nutrition_pct: Number(nutritionPct),
          energy: Number(energy),
          sleep: Number(sleep),
          difficulties,
          feedback,
          photos: photos.map((p) => p.path),
        }),
      });

      if (res.ok) {
        setView("success");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (data.error === "already_submitted") {
        setView("already");
        return;
      }
      setErrorKey(mapApiError(data.error));
    } catch {
      setErrorKey("checkin_error_generic");
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------- terminal cards */

  if (view !== "form") {
    return (
      <TerminalCard
        view={view}
        demo={demo}
        historyReadonly={historyReadonly}
        request={request}
        submission={submission}
      />
    );
  }

  /* ------------------------------------------------------------- the form */

  return (
    <section className="pt-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow mb-0">{t("checkin_title")}</p>
          {demo && (
            <span className="text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-0.5 rounded-full">
              {t("badge_demo")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted mt-1.5">
          {t("checkin_intro")}
        </p>
        {request && (
          <p className="text-xs text-muted mt-2">
            {t("checkins_period").replace("{label}", request.period_label)} ·{" "}
            {t("checkins_due").replace(
              "{date}",
              request.due_date ? formatDate(request.due_date) : "—"
            )}
          </p>
        )}
      </Reveal>

      <Reveal delay={0.05} className="mt-6">
        <form onSubmit={submit} className="card-surface p-6 md:p-8 space-y-6" noValidate>
          {/* Weight */}
          <Field htmlFor="ci-weight" icon={CalendarCheck} labelKey="checkin_label_weight">
            <input
              id="ci-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={CHECKIN_LIMITS.weightMin}
              max={CHECKIN_LIMITS.weightMax}
              className="input-light"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-invalid={errorKey === "checkin_error_required" || errorKey === "checkin_error_range"}
            />
            {lastWeightKg !== null && (
              <p className="text-[11px] text-muted mt-1.5">
                {t("checkin_last_weight").replace("{weight}", String(lastWeightKg))}
              </p>
            )}
          </Field>

          {/* Measurements */}
          <Field icon={CalendarCheck} labelKey="checkin_label_measurements" labelId="ci-measure-group" hintKey="checkin_measurements_hint">
            <div
              role="group"
              aria-labelledby="ci-measure-group"
              className="grid gap-3 sm:grid-cols-2"
            >
              {MEASUREMENT_KEYS.map((key) => (
                <div key={key}>
                  <label
                    htmlFor={`ci-m-${key}`}
                    className="block text-[11px] font-bold text-muted mb-1"
                  >
                    {t(MEASUREMENT_LABEL[key])}
                  </label>
                  <input
                    id={`ci-m-${key}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={20}
                    max={250}
                    className="input-light"
                    value={measurements[key]}
                    onChange={(e) =>
                      setMeasurements((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* Training days */}
          <Field htmlFor="ci-days" icon={CalendarCheck} labelKey="checkin_label_training_days">
            <input
              id="ci-days"
              type="number"
              inputMode="numeric"
              min={CHECKIN_LIMITS.daysMin}
              max={CHECKIN_LIMITS.daysMax}
              className="input-light"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>

          {/* Percentages + energy/sleep scales (live form parity) */}
          <ScaleField
            id="ci-workout"
            labelKey="checkin_label_workout_pct"
            min={CHECKIN_LIMITS.pctMin}
            max={CHECKIN_LIMITS.pctMax}
            step={5}
            value={workoutPct}
            onChange={setWorkoutPct}
            suffix="%"
          />
          <ScaleField
            id="ci-nutrition"
            labelKey="checkin_label_nutrition_pct"
            min={CHECKIN_LIMITS.pctMin}
            max={CHECKIN_LIMITS.pctMax}
            step={5}
            value={nutritionPct}
            onChange={setNutritionPct}
            suffix="%"
          />
          <ScaleField
            id="ci-energy"
            labelKey="checkin_label_energy"
            min={CHECKIN_LIMITS.scaleMin}
            max={CHECKIN_LIMITS.scaleMax}
            step={1}
            value={energy}
            onChange={setEnergy}
            suffix="/10"
          />
          <ScaleField
            id="ci-sleep"
            labelKey="checkin_label_sleep"
            min={CHECKIN_LIMITS.scaleMin}
            max={CHECKIN_LIMITS.scaleMax}
            step={1}
            value={sleep}
            onChange={setSleep}
            suffix="/10"
          />

          {/* Free text */}
          <Field htmlFor="ci-difficulties" icon={CalendarCheck} labelKey="checkin_label_difficulties">
            <textarea
              id="ci-difficulties"
              rows={2}
              maxLength={CHECKIN_LIMITS.textMax}
              className="input-light resize-y"
              value={difficulties}
              onChange={(e) => setDifficulties(e.target.value)}
            />
          </Field>
          <Field htmlFor="ci-feedback" icon={CalendarCheck} labelKey="checkin_label_feedback">
            <textarea
              id="ci-feedback"
              rows={3}
              maxLength={CHECKIN_LIMITS.textMax}
              className="input-light resize-y"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>

          {/* Photos */}
          <div>
            <p className="flex items-center gap-2 text-xs font-bold text-muted mb-2">
              <Camera className="h-3.5 w-3.5 text-brand" />
              {t("checkin_label_photos")}
              <span className="ms-auto text-[11px] font-normal">
                {photos.length}/{MAX_CHECKIN_PHOTOS}
              </span>
            </p>

            {photos.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-3">
                {photos.map((photo) => (
                  <li
                    key={photo.path}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-ink"
                  >
                    <span className="max-w-[12rem] truncate">{photo.name}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.path)}
                      className="text-muted hover:text-red-700"
                      aria-label={`${t("checkin_photo_remove")} ${photo.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label
              htmlFor="ci-photos"
              className={`inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-ink transition-colors ${
                photos.length >= MAX_CHECKIN_PHOTOS || uploading || busy
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-brand hover:text-brand"
              }`}
            >
              <Camera className="h-4 w-4" />
              {t(uploading ? "checkin_photo_uploading" : "checkin_photo_add")}
              <input
                id="ci-photos"
                type="file"
                accept={CHECKIN_PHOTO_ACCEPT}
                className="sr-only"
                onChange={onPickPhoto}
                disabled={photos.length >= MAX_CHECKIN_PHOTOS || uploading || busy}
              />
            </label>
            <p className="text-[11px] text-muted mt-1.5">{t("checkin_photos_hint")}</p>
          </div>

          <button
            type="submit"
            disabled={busy || uploading}
            className="btn-primary w-full"
          >
            <Send className="h-4 w-4" />
            {t(busy ? "checkin_submitting" : "checkin_submit")}
          </button>

          {errorKey && (
            <p
              role="alert"
              className="text-sm leading-relaxed text-red-700 flex items-center gap-2"
            >
              <CircleAlert className="h-4 w-4 shrink-0" />
              {t(errorKey)}
            </p>
          )}
        </form>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- helpers */

function Field({
  htmlFor,
  labelId,
  icon: Icon,
  labelKey,
  hintKey,
  children,
}: {
  htmlFor?: string;
  labelId?: string;
  icon: LucideIcon;
  labelKey: TKey;
  hintKey?: TKey;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const labelClass = "flex items-center gap-2 text-xs font-bold text-muted mb-2";
  const body = (
    <>
      <Icon className="h-3.5 w-3.5 text-brand" />
      {t(labelKey)}
    </>
  );

  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} id={labelId} className={labelClass}>
          {body}
        </label>
      ) : (
        <p id={labelId} className={labelClass}>
          {body}
        </p>
      )}
      {children}
      {hintKey && <p className="text-[11px] text-muted mt-1.5">{t(hintKey)}</p>}
    </div>
  );
}

function ScaleField({
  id,
  labelKey,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  id: string;
  labelKey: TKey;
  min: number;
  max: number;
  step: number;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={id} className="text-xs font-bold text-muted">
          {t(labelKey)}
        </label>
        <output htmlFor={id} className="text-xs font-bold text-brand">
          {value}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-brand"
        aria-valuetext={`${value}${suffix}`}
      />
    </div>
  );
}

const TERMINAL: Record<
  Exclude<View, "form">,
  {
    title: TKey;
    body: TKey;
    icon: LucideIcon;
    tone: "good" | "muted" | "warn";
  }
> = {
  success: {
    title: "checkin_success_title",
    body: "checkin_success_body",
    icon: CheckCircle2,
    tone: "good",
  },
  already: {
    title: "checkin_already_title",
    body: "checkin_already_body",
    icon: History,
    tone: "good",
  },
  locked: {
    title: "checkin_locked_title",
    body: "checkin_locked_body",
    icon: Lock,
    tone: "warn",
  },
  notfound: {
    title: "checkin_notfound_title",
    body: "checkin_notfound_body",
    icon: CircleAlert,
    tone: "muted",
  },
};

function TerminalCard({
  view,
  demo,
  historyReadonly,
  request,
  submission,
}: {
  view: Exclude<View, "form">;
  demo: boolean;
  historyReadonly: boolean;
  request: CheckinRequestItem | null;
  submission: CheckinSubmissionView | null;
}) {
  const { t } = useI18n();
  const meta = TERMINAL[view];
  const Icon = meta.icon;

  // History-only clients get the "read-only history" explanation instead of
  // the renewal-shaped lock copy.
  const bodyKey: TKey =
    view === "locked" && historyReadonly
      ? "checkin_readonly_body"
      : meta.body;

  return (
    <Reveal className="pt-4">
      <div className="card-surface p-8 md:p-10 text-center">
        <span
          className={`mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl ${
            meta.tone === "good"
              ? "bg-forest-soft text-forest"
              : meta.tone === "warn"
                ? "bg-amber/15 text-ink"
                : "bg-cream text-muted"
          }`}
        >
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="heading-lg text-2xl md:text-3xl">{t(meta.title)}</h2>
        <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
          {t(bodyKey)}
        </p>

        {request && (
          <p className="text-xs text-muted mt-3">
            {t("checkins_period").replace("{label}", request.period_label)}
          </p>
        )}
        {submission && submission.weight_kg !== null && (
          <p className="text-xs text-ink font-bold mt-2">
            {t("checkin_summary_weight").replace(
              "{weight}",
              String(submission.weight_kg)
            )}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {view === "locked" && !historyReadonly && (
            <Link href="/portal/renewal" className="btn-primary">
              <RefreshCcw className="h-4 w-4" />
              {t("followup_locked_cta")}
            </Link>
          )}
          <Link href="/portal/progress" className="btn-secondary">
            {t("checkin_go_progress")}
          </Link>
          <Link href="/portal" className="chip">
            {t("onboarding_back_to_hub")}
          </Link>
        </div>

        {demo && (
          <p className="mt-5 text-[11px] uppercase tracking-widest font-display text-brand">
            {t("badge_demo")}
          </p>
        )}
      </div>
    </Reveal>
  );
}
