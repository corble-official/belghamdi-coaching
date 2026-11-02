"use client";

import { useState } from "react";
import { Send, MessageCircle, Mail, MapPin, Instagram, Youtube } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { logEvent } from "@/lib/integrations/dispatcher";
import { recordDelivery } from "@/lib/integrations/outbox";
import type { DeliveryRecord } from "@/lib/integrations/contracts";
import { BUSINESS } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

export default function ContactPage() {
  const { t, lang } = useI18n();
  const [sent, setSent] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  return (
    <div className="pt-32 pb-28">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[1fr_1.2fr] gap-16">
        <Reveal>
          <p className="eyebrow mb-4">{t("nav_contact")}</p>
          <h1 className="heading-xl text-4xl md:text-6xl">{t("contact_title")}</h1>
          <p className="body-lg mt-5">
            {t("contact_copy")}
          </p>

          <div className="mt-12 space-y-6">
            <a
              href={BUSINESS.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-4 group"
            >
              <MessageCircle className="h-5 w-5 text-copper mt-1" />
              <div>
                <p className="font-display font-semibold text-bone text-sm uppercase tracking-widest group-hover:text-copper transition-colors">
                  {t("contact_whatsapp_fastest")}
                </p>
                <p className="text-wgray text-sm mt-1">{BUSINESS.whatsapp}</p>
              </div>
            </a>

            <div className="flex items-start gap-4">
              <Mail className="h-5 w-5 text-copper mt-1" />
              <div>
                <p className="font-display font-semibold text-bone text-sm uppercase tracking-widest">{t("contact_label_email")}</p>
                <p className="text-wgray text-sm mt-1">{BUSINESS.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="h-5 w-5 text-copper mt-1" />
              <div>
                <p className="font-display font-semibold text-bone text-sm uppercase tracking-widest">{t("contact_based_in")}</p>
                <p className="text-wgray text-sm mt-1">
                  {t("contact_location_line").replace("{location}", BUSINESS.location)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={BUSINESS.socials.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="border border-wgray-dim p-3 text-wgray hover:text-copper hover:border-copper transition-colors"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={BUSINESS.socials.youtube}
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="border border-wgray-dim p-3 text-wgray hover:text-copper hover:border-copper transition-colors"
              >
                <Youtube className="h-4 w-4" />
              </a>
              <a
                href={BUSINESS.socials.tiktok}
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="border border-wgray-dim px-4 py-3 text-[11px] font-display uppercase tracking-widest text-wgray hover:text-copper hover:border-copper transition-colors"
              >
                TikTok
              </a>
              <a
                href={BUSINESS.socials.threads}
                target="_blank"
                rel="noreferrer"
                aria-label="Threads"
                className="border border-wgray-dim px-4 py-3 text-[11px] font-display uppercase tracking-widest text-wgray hover:text-copper hover:border-copper transition-colors"
              >
                Threads
              </a>
            </div>

            <a
              href={BUSINESS.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 border border-wgray-dim px-6 py-4 text-sm font-display uppercase tracking-widest text-bone hover:border-copper hover:text-copper transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> {t("contact_cta_whatsapp")}
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="card-surface p-10 h-fit">
          {sent ? (
            <div className="border border-copper/50 bg-copper/10 p-8 text-center">
              <p className="font-display text-copper uppercase tracking-widest">
                {t("contact_success_title")}
              </p>
              <p className="text-sm text-wgray mt-3">
                {t("contact_success_copy")}
              </p>
            </div>
          ) : (
            <>
            {sendFailed && (
              <div className="mb-4 border border-red-400/40 bg-red-400/10 p-4 text-sm text-wgray">
                {t("contact_failed_copy")}
              </div>
            )}
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const btn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement | null;
                if (btn) btn.disabled = true;
                try {
                  const res = await fetch("/api/leads", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: data.get("name"),
                      email: data.get("email"),
                      phone: data.get("phone"),
                      message: data.get("message"),
                      interest_type: data.get("type") === "programs" ? "training_program" : data.get("type") === "coaching" ? "coaching" : "general",
                      source: "contact-page",
                      language: lang,
                    }),
                  });
                  const json = (await res.json()) as { ok?: boolean; lead_id?: string; delivery?: import("@/lib/integrations/contracts").DeliveryRecord };
                  if (!res.ok || !json.ok) throw new Error(String((json as { error?: string }).error || "send_failed"));
                  if (json.delivery) {
                    recordDelivery(json.delivery);
                    logEvent("lead.created", json.lead_id || json.delivery.id || "lead");
                  }
                  setSent(true);
                } catch {
                  setSendFailed(true);
                } finally {
                  if (btn) btn.disabled = false;
                }
              }}
            >
              <div>
                <label htmlFor="type" className="label-dark">{t("contact_label_inquiry_type")}</label>
                <select id="type" name="type" className="input-dark">
                  <option value="general">{t("contact_option_general")}</option>
                  <option value="coaching">{t("contact_option_coaching")}</option>
                  <option value="programs">{t("contact_option_programs")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="name" className="label-dark">{t("contact_label_full_name")}</label>
                <input id="name" name="name" required className="input-dark" />
              </div>
              <div>
                <label htmlFor="email" className="label-dark">{t("contact_label_email")}</label>
                <input id="email" name="email" type="email" required className="input-dark" />
              </div>
              <div>
                <label htmlFor="phone" className="label-dark">{t("contact_label_phone")}</label>
                <input id="phone" name="phone" type="tel" className="input-dark" />
              </div>
              <div>
                <label htmlFor="message" className="label-dark">{t("contact_label_message")}</label>
                <textarea id="message" name="message" rows={5} required className="input-dark" />
              </div>
              <button type="submit" className="btn-primary w-full">
                <Send className="h-4 w-4" /> {t("contact_submit")}
              </button>
            </form>
            </>
          )}
        </Reveal>
      </div>
    </div>
  );
}
