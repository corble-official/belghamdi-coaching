"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Lock,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";
import type { OnboardingPrefill } from "@/lib/supabase/portal-onboarding";

/**
 * Onboarding form — mirrors the legacy n8n intake field set (photos are
 * explicitly EXCLUDED here per decision #6: photos are check-ins only).
 *
 * Payload data-keys are EXACTLY: full_name, phone, fitness_goal,
 * training_days, training_location, experience_level, health_notes,
 * referral_source, extra_notes — flat, matched to the BC-03 consumer shape.
 *
 * Email is display-only (verified identity). Quick chips prefill the
 * editable text input for goal + location (chip selection and free text both
 * land in the payload through the single final value); days + level are
 * chip-choice only.
 */

type TFn = ReturnType<typeof useI18n>["t"];
type TKey = Parameters<TFn>[0];

type ChipOption = { value: string; labelKey: TKey };

const GOAL_CHIPS: ChipOption[] = [
  { value: "خسارة وزن", labelKey: "onboarding_goal_weight" },
  { value: "زيادة عضل", labelKey: "onboarding_goal_muscle" },
  { value: "لياقة عامة", labelKey: "onboarding_goal_fitness" },
  { value: "تغذية", labelKey: "onboarding_goal_nutrition" },
  { value: "ترميم بعد إصابة", labelKey: "onboarding_goal_injury" },
];

const DAYS_CHIPS: ChipOption[] = [
  { value: "1-2", labelKey: "onboarding_days_1_2" },
  { value: "3-4", labelKey: "onboarding_days_3_4" },
  { value: "5-6", labelKey: "onboarding_days_5_6" },
];

const LOCATION_CHIPS: ChipOption[] = [
  { value: "النادي", labelKey: "onboarding_location_gym" },
  { value: "المنزل", labelKey: "onboarding_location_home" },
];

const LEVEL_CHIPS: ChipOption[] = [
  { value: "مبتدئ", labelKey: "onboarding_level_beginner" },
  { value: "متوسط", labelKey: "onboarding_level_intermediate" },
  { value: "متقدم", labelKey: "onboarding_level_advanced" },
];

type View = "form" | "success" | "completed" | "no_request";

export default function OnboardingForm({
  demo,
  hasRequest,
  completed,
  prefill,
}: {
  demo: boolean;
  hasRequest: boolean;
  completed: boolean;
  prefill: OnboardingPrefill;
}) {
  const { t } = useI18n();

  const [view, setView] = useState<View>(
    completed ? "completed" : hasRequest ? "form" : "no_request"
  );
  const [fields, setFields] = useState<OnboardingPrefill>(prefill);
  const [extra, setExtra] = useState({ referral_source: "", extra_notes: "" });
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<
    | "onboarding_error_required"
    | "onboarding_error_unavailable"
    | "onboarding_error_generic"
    | null
  >(null);

  const set = (key: keyof OnboardingPrefill, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  /**
   * Chip semantics: clicking a chip writes the chip value INTO the editable
   * text field (toggle off when clicked again) — chip + free text both end
   * up in the payload through the single final value.
   */
  const toggleTextChip = (key: keyof OnboardingPrefill, value: string) =>
    set(key, fields[key] === value ? "" : value);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!fields.full_name.trim()) {
      setErrorKey("onboarding_error_required");
      return;
    }

    setBusy(true);
    setErrorKey(null);

    try {
      // Explicit field → data-key mapping (the BC-03 consumer shape). Email is
      // the verified identity and is DISPLAY-ONLY — never posted. Ownership
      // (client_id / request_id) is never part of the body either: the server
      // derives it from the session and strips those keys if a tampered client
      // adds them.
      const payload = {
        full_name: fields.full_name,
        phone: fields.phone,
        fitness_goal: fields.fitness_goal,
        training_days: fields.training_days,
        training_location: fields.training_location,
        experience_level: fields.experience_level,
        health_notes: fields.health_notes,
        referral_source: extra.referral_source,
        extra_notes: extra.extra_notes,
      };

      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setView("success");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      // 409 = already submitted → show the terminal "completed" card instead
      // of an inline error the user could then act on.
      if (data?.error === "already_completed") {
        setView("completed");
        return;
      }

      setErrorKey(
        data?.error === "full_name_required"
          ? "onboarding_error_required"
          : data?.error === "no_onboarding_request" ||
              data?.error === "request_cancelled" ||
              data?.error === "no_linked_client"
            ? "onboarding_error_unavailable"
            : "onboarding_error_generic"
      );
    } catch {
      setErrorKey("onboarding_error_generic");
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------------- cards */

  if (view === "success" || view === "completed" || view === "no_request") {
    return <DoneCard view={view} demo={demo} />;
  }

  /* --------------------------------------------------------------- form */

  return (
    <section className="pt-4">
      <Reveal>
        <p className="eyebrow mb-2">{t("onboarding_title")}</p>
        <p className="text-sm leading-relaxed text-muted">
          {t("onboarding_intro")}
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-6">
        <form
          onSubmit={submit}
          className="card-surface p-6 md:p-8 space-y-6"
          noValidate
        >
          {/* 1.	full name */}
          <Field
            htmlFor="onb-full-name"
            icon={ClipboardList}
            labelKey="onboarding_label_full_name"
            required
          >
            <input
              id="onb-full-name"
              type="text"
              autoComplete="name"
              className="input-light"
              value={fields.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              aria-invalid={errorKey === "onboarding_error_required"}
              aria-describedby={
                errorKey === "onboarding_error_required" ? "onb-error" : undefined
              }
              required
            />
          </Field>

          {/* 2. WhatsApp / phone */}
          <Field htmlFor="onb-phone" icon={ClipboardList} labelKey="onboarding_label_phone">
            <input
              id="onb-phone"
              type="tel"
              autoComplete="tel"
              className="input-light"
              placeholder={t("onboarding_label_phone")}
              value={fields.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>

          {/* 3. email — readonly verified identity */}
          <Field htmlFor="onb-email" icon={Lock} labelKey="onboarding_label_email">
            <input
              id="onb-email"
              type="email"
              className="input-light text-muted"
              value={fields.email}
              readOnly
              disabled
              aria-describedby="onb-email-hint"
            />
            <p id="onb-email-hint" className="text-[11px] text-muted mt-1.5">
              {t("onboarding_email_locked")}
            </p>
          </Field>

          {/* 4. goal — chips prefill editable free text */}
          <Field
            htmlFor="onb-goal"
            icon={ClipboardList}
            labelKey="onboarding_label_goal"
            hintKey="onboarding_goal_hint"
          >
            <ChipRow
              chips={GOAL_CHIPS}
              activeValue={fields.fitness_goal}
              onToggle={(value) => toggleTextChip("fitness_goal", value)}
            />
            <input
              id="onb-goal"
              type="text"
              className="input-light mt-2"
              value={fields.fitness_goal}
              onChange={(e) => set("fitness_goal", e.target.value)}
              placeholder={t("onboarding_label_goal")}
            />
          </Field>

          {/* 5. training days — chips only */}
          <Field
            icon={ClipboardList}
            labelKey="onboarding_label_days"
            labelId="onb-days-group"
          >
            <ChipRow
              chips={DAYS_CHIPS}
              activeValue={fields.training_days}
              onToggle={(value) => set("training_days", value)}
              groupLabelId="onb-days-group"
            />
          </Field>

          {/* 6. location — chips prefill editable free text (e.g. gym name) */}
          <Field htmlFor="onb-location" icon={ClipboardList} labelKey="onboarding_label_location">
            <ChipRow
              chips={LOCATION_CHIPS}
              activeValue={fields.training_location}
              onToggle={(value) => set("training_location", value)}
            />
            <input
              id="onb-location"
              type="text"
              className="input-light mt-2"
              value={fields.training_location}
              onChange={(e) => set("training_location", e.target.value)}
              placeholder={t("onboarding_label_location")}
            />
          </Field>

          {/* 7. current level — chips only */}
          <Field
            icon={ClipboardList}
            labelKey="onboarding_label_level"
            labelId="onb-level-group"
          >
            <ChipRow
              chips={LEVEL_CHIPS}
              activeValue={fields.experience_level}
              onToggle={(value) => set("experience_level", value)}
              groupLabelId="onb-level-group"
            />
          </Field>

          {/* 8. injuries / health notes → health_notes (+ clients.notes via consumer) */}
          <Field
            htmlFor="onb-health"
            icon={ClipboardList}
            labelKey="onboarding_label_health"
            hintKey="onboarding_health_hint"
          >
            <textarea
              id="onb-health"
              rows={3}
              className="input-light resize-y"
              value={fields.health_notes}
              onChange={(e) => set("health_notes", e.target.value)}
            />
          </Field>

          {/* 9. referral source */}
          <Field
            htmlFor="onb-referral"
            icon={ClipboardList}
            labelKey="onboarding_label_referral"
          >
            <input
              id="onb-referral"
              type="text"
              className="input-light"
              value={extra.referral_source}
              onChange={(e) =>
                setExtra((prev) => ({
                  ...prev,
                  referral_source: e.target.value,
                }))
              }
            />
          </Field>

          {/* 10. anything else */}
          <Field
            htmlFor="onb-extra"
            icon={ClipboardList}
            labelKey="onboarding_label_extra"
          >
            <textarea
              id="onb-extra"
              rows={3}
              className="input-light resize-y"
              value={extra.extra_notes}
              onChange={(e) =>
                setExtra((prev) => ({ ...prev, extra_notes: e.target.value }))
              }
            />
          </Field>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            <Send className="h-4 w-4" />
            {t(busy ? "onboarding_submitting" : "onboarding_submit")}
          </button>

          {errorKey && (
            <p
              id="onb-error"
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
  required,
  children,
}: {
  /** Id of the field's single control; omitted for chip-only groups. */
  htmlFor?: string;
  /** Id for the label element itself (referenced by `aria-labelledby`). */
  labelId?: string;
  icon: LucideIcon;
  labelKey: Parameters<TFn>[0];
  hintKey?: Parameters<TFn>[0];
  required?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const labelClass =
    "flex items-center gap-2 text-xs font-bold text-muted mb-2";
  const labelBody = (
    <>
      <Icon className="h-3.5 w-3.5 text-brand" />
      {t(labelKey)}
      {required && <span className="text-red-600">*</span>}
    </>
  );

  return (
    <div>
      {/* Chip-only groups have no single control, so they get a plain label
          element (id-able via labelId) instead of a dangling `for`. */}
      {htmlFor ? (
        <label htmlFor={htmlFor} id={labelId} className={labelClass}>
          {labelBody}
        </label>
      ) : (
        <p id={labelId} className={labelClass}>
          {labelBody}
        </p>
      )}
      {children}
      {hintKey && <p className="text-[11px] text-muted mt-1.5">{t(hintKey)}</p>}
    </div>
  );
}

function ChipRow({
  chips,
  activeValue,
  onToggle,
  groupLabelId,
}: {
  chips: ChipOption[];
  activeValue: string;
  onToggle: (value: string) => void;
  /** Set for chip-only groups that have no single labelled control. */
  groupLabelId?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role={groupLabelId ? "group" : undefined}
      aria-labelledby={groupLabelId}
      className="flex flex-wrap gap-2"
    >
      {chips.map((chip) => {
        const active = activeValue === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(chip.value)}
            className={active ? "chip chip-active" : "chip"}
          >
            {t(chip.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

/** Terminal states: submitted / already completed / nothing open. */
function DoneCard({ view, demo }: { view: "success" | "completed" | "no_request"; demo: boolean }) {
  const { t } = useI18n();

  const titles: Record<typeof view, Parameters<TFn>[0]> = {
    success: "onboarding_success_title",
    completed: "onboarding_completed_title",
    no_request: "onboarding_no_request_title",
  };
  const bodies: Record<typeof view, Parameters<TFn>[0]> = {
    success: "onboarding_success_body",
    completed: "onboarding_completed_body",
    no_request: "onboarding_no_request_body",
  };

  return (
    <Reveal className="pt-4">
      <div className="card-surface p-8 md:p-10 text-center">
        <span
          className={`mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl ${
            view === "no_request"
              ? "bg-cream text-muted"
              : "bg-forest-soft text-forest"
          }`}
        >
          {view === "no_request" ? (
            <ClipboardList className="h-7 w-7" />
          ) : (
            <CheckCircle2 className="h-7 w-7" />
          )}
        </span>
        <h2 className="heading-lg text-2xl md:text-3xl">{t(titles[view])}</h2>
        <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
          {t(bodies[view])}
        </p>
        {demo && (
          <p className="mt-5 text-[11px] uppercase tracking-widest font-display text-brand">
            {t("badge_demo")}
          </p>
        )}
        <Link href="/portal" className="btn-secondary mt-8">
          {t("onboarding_back_to_hub")}
        </Link>
      </div>
    </Reveal>
  );
}
