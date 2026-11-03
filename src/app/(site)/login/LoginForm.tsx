"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";

type LoginErrorKey =
  | "login_error_rate_limit"
  | "login_error_invalid_email"
  | "login_error_generic"
  | "auth_callback_error";

function errorToKey(code: string): LoginErrorKey {
  if (code === "rate_limited") return "login_error_rate_limit";
  if (code === "invalid_email") return "login_error_invalid_email";
  return "login_error_generic";
}

export default function LoginForm({
  demo,
  callbackFailed,
}: {
  demo: boolean;
  callbackFailed: boolean;
}) {
  const { t } = useI18n();
  const [stage, setStage] = useState<"form" | "pending">("form");
  const [email, setEmail] = useState("");
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(
    callbackFailed ? "auth_callback_error" : null
  );
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || stage !== "form") return;

    setBusy(true);
    setErrorKey(null);

    try {
      const res = await fetch(demo ? "/api/auth/demo-session" : "/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        let code = "";
        try {
          const data = (await res.json()) as { error?: unknown };
          if (typeof data?.error === "string") code = data.error;
        } catch {
          // non-JSON failure body — fall through to the generic message
        }
        setErrorKey(errorToKey(code));
        return;
      }

      if (demo) {
        window.location.assign("/portal");
        return;
      }

      setStage("pending");
    } catch {
      setErrorKey("login_error_generic");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-32 pb-28 min-h-[70vh]">
      <div className="max-w-md mx-auto px-6">
        <Reveal className="card-surface p-10">
          <p className="eyebrow mb-3">{t("nav_login")}</p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="heading-lg text-3xl">
              {stage === "pending" ? t("login_check_inbox_title") : t("login_title_welcome")}
            </h1>
            {demo && (
              <span className="shrink-0 text-[10px] font-display uppercase tracking-widest text-wgray-dim border border-wgray-dim/60 px-2 py-1">
                {t("badge_demo")}
              </span>
            )}
          </div>

          {stage === "pending" ? (
            <div className="mt-8 space-y-4">
              <p className="text-sm leading-relaxed text-wgray border border-wgray-dim/60 p-4 bg-obsidian">
                {t("login_check_inbox_email").replace("{email}", email)}
              </p>
              <p className="text-xs leading-relaxed text-wgray-dim">
                {t("login_check_inbox_hint")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStage("form");
                  setErrorKey(null);
                }}
                className="text-xs text-wgray hover:text-copper transition-colors block w-full text-center"
              >
                {t("login_use_different_email")}
              </button>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div>
                <label htmlFor="email" className="label-dark">{t("login_label_email")}</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-wgray-dim absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-dark pl-9"
                  />
                </div>
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {t(demo ? "login_demo_submit" : "login_submit")}{" "}
                <ArrowRight className={`h-4 w-4 ${busy ? "opacity-0" : ""}`} />
              </button>

              {demo && (
                <p className="text-[11px] leading-relaxed text-wgray-dim">
                  {t("login_demo_note")}
                </p>
              )}

              {errorKey && (
                <p
                  role="alert"
                  className="text-xs leading-relaxed text-wgray border border-wgray-dim/60 p-4 bg-obsidian"
                >
                  {t(errorKey)}
                </p>
              )}

              <p className="text-[11px] text-wgray-dim leading-relaxed">
                {t("login_status_prefix")}{" "}
                <Link href="/programs" className="text-copper hover:underline">
                  {t("login_status_cta")}
                </Link>
                .
              </p>
            </form>
          )}
        </Reveal>
      </div>
    </div>
  );
}
