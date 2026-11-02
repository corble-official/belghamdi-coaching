"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Send, HelpCircle, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { COACHING_PACKAGES } from "@/lib/catalog";
import { logEvent } from "@/lib/integrations/dispatcher";
import { useI18n } from "@/lib/i18n";

const silver = COACHING_PACKAGES[0];
const gold = COACHING_PACKAGES[1];

export default function CoachingPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  const silverFeatures = [
    t("coaching_silver_feat_1"),
    t("coaching_silver_feat_2"),
    t("coaching_silver_feat_3"),
    t("product_video_library"),
    t("coaching_silver_feat_5"),
  ];
  const goldFeatures = [
    t("coaching_gold_feat_1"),
    t("coaching_gold_feat_2"),
    t("coaching_gold_feat_3"),
    t("coaching_gold_feat_4"),
    t("coaching_gold_feat_5"),
  ];

  const rows = [
    { id: "followup", label: t("coaching_row_followup"), silver: t("coaching_val_followup"), gold: t("coaching_val_gold_followup") },
    { id: "reporting", label: t("coaching_row_reporting"), silver: t("coaching_val_reporting"), gold: t("coaching_val_gold_reporting") },
    { id: "response", label: t("coaching_row_response"), silver: t("coaching_val_response"), gold: t("coaching_val_gold_response") },
    { id: "support", label: t("coaching_row_support"), silver: t("coaching_val_support"), gold: t("coaching_val_gold_support") },
    { id: "personalized", label: t("coaching_row_personalized"), silver: t("coaching_val_yes"), gold: t("coaching_val_yes") },
    { id: "nutrition", label: t("coaching_row_nutrition"), silver: t("coaching_val_no"), gold: t("coaching_val_yes") },
    { id: "explanations", label: t("coaching_row_explanations"), silver: t("coaching_val_yes"), gold: t("coaching_val_yes") },
    { id: "adjustments", label: t("coaching_row_adjustments"), silver: t("coaching_val_every_2_weeks"), gold: t("coaching_val_every_week") },
  ];

  const faqs = [
    { q: t("coaching_faq_1_q"), a: t("coaching_faq_1_a") },
    { q: t("coaching_faq_2_q"), a: t("coaching_faq_2_a") },
    { q: t("coaching_faq_3_q"), a: t("coaching_faq_3_a") },
  ];

  return (
    <div className="pt-32 pb-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="eyebrow mb-4">{t("section_coaching")}</p>
        <h1 className="heading-xl text-5xl md:text-7xl max-w-3xl">
          {t("coaching_title")} <span className="text-copper">{t("coaching_title_accent")}</span>
        </h1>
        <p className="body-lg mt-5 max-w-2xl">
          {t("coaching_philosophy_copy")}
        </p>

        <div className="mt-16 grid md:grid-cols-2 gap-6 max-w-5xl">
          <Reveal className="card-surface p-10">
            <p className="eyebrow mb-3">
              {t("coaching_card_silver_line").replace("{price}", String(silver.price))}
            </p>
            <h3 className="font-display font-bold text-3xl text-bone">{t("coaching_silver_headline")}</h3>
            <ul className="mt-7 space-y-3 text-bone text-sm">
              {silverFeatures.map((f, i) => (
                <li key={i} className="flex gap-3">
                  <Check className="h-4 w-4 text-copper mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="card-surface p-10 border-copper/60 relative">
            <span className="absolute top-6 left-6 bg-brand text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
              {t("coaching_badge_most_complete")}
            </span>
            <p className="eyebrow mb-3">
              {t("coaching_card_gold_line").replace("{price}", String(gold.price))}
            </p>
            <h3 className="font-display font-bold text-3xl text-bone">{t("coaching_gold_headline")}</h3>
            <ul className="mt-7 space-y-3 text-bone text-sm">
              {goldFeatures.map((f, i) => (
                <li key={i} className="flex gap-3">
                  <Check className="h-4 w-4 text-copper mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="mt-24 overflow-x-auto">
          <h2 className="heading-lg text-3xl mb-8">{t("coaching_comparison_title")}</h2>
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="table-head">{t("coaching_table_feature")}</th>
                <th className="table-head">{t("coaching_tier_silver")}</th>
                <th className="table-head">{t("coaching_tier_gold")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                return (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-obsidian" : ""}>
                    <td className="table-cell font-medium">{r.label}</td>
                    <td className="table-cell text-wgray">{r.silver}</td>
                    <td className="table-cell text-bone">{r.gold}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-28 grid lg:grid-cols-2 gap-14">
          <div>
            <h2 className="heading-lg text-3xl mb-8 flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-copper" /> {t("coaching_faq_title")}
            </h2>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <details key={i} className="card-surface p-6 group">
                  <summary className="font-display font-semibold text-bone cursor-pointer list-none flex justify-between items-center">
                    {f.q}
                    <Minus className="h-4 w-4 text-copper group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="text-sm text-wgray mt-4 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
            <Link href="/faq" className="text-sm text-copper mt-6 inline-flex items-center gap-2">
              {t("coaching_faq_general")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="card-surface p-10 h-fit">
            <p className="eyebrow mb-3">{t("coaching_apply_eyebrow")}</p>
            <h2 className="heading-lg text-3xl">{t("coaching_apply_title")}</h2>
            <p className="text-sm text-wgray mt-3">
              {t("coaching_apply_copy")}
            </p>
            {sent ? (
              <div className="mt-8 border border-copper/50 bg-copper/10 p-6">
                <p className="font-display text-copper uppercase tracking-widest text-sm">
                  {t("coaching_apply_success_title")}
                </p>
                <p className="text-sm text-wgray mt-2">
                  {t("coaching_apply_success_copy")}
                </p>
              </div>
            ) : (
              <form
                className="mt-8 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  logEvent("lead.created", `coaching-application:${data.get("name")}`);
                  setSent(true);
                }}
              >
                <div>
                  <label htmlFor="name" className="label-dark">{t("coaching_label_full_name")}</label>
                  <input id="name" name="name" required className="input-dark" />
                </div>
                <div>
                  <label htmlFor="email" className="label-dark">{t("coaching_label_email")}</label>
                  <input id="email" name="email" type="email" required className="input-dark" />
                </div>
                <div>
                  <label htmlFor="goal" className="label-dark">{t("coaching_label_goal")}</label>
                  <select id="goal" name="goal" className="input-dark">
                    <option>{t("coaching_goal_muscle")}</option>
                    <option>{t("coaching_goal_fat")}</option>
                    <option>{t("coaching_goal_strength")}</option>
                    <option>{t("coaching_goal_athletic")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="msg" className="label-dark">{t("coaching_label_context")}</label>
                  <textarea id="msg" name="msg" rows={4} className="input-dark" placeholder={t("coaching_placeholder_context")} />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <Send className="h-4 w-4" /> {t("coaching_apply_submit")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
