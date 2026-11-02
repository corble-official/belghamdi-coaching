"use client";

import { Reveal } from "@/components/ui/Reveal";
import { CoachPortrait } from "@/components/site/home/Hero";
import { BUSINESS } from "@/lib/catalog";
import { Instagram, Youtube, Dumbbell, GraduationCap, Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function AboutPage() {
  const { t, lang } = useI18n();
  return (
    <div className="pt-32 pb-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <Reveal className="lg:col-span-5 order-2 lg:order-1">
            <div className="rounded-[2.5rem] overflow-hidden shadow-xl aspect-[4/5] max-w-md">
              <CoachPortrait className="w-full h-full" />
            </div>
            <div className="flex gap-3 mt-5">
              <a href={BUSINESS.socials.instagram} target="_blank" rel="noopener noreferrer" className="chip">
                <Instagram className="h-3.5 w-3.5 text-brand" /> {BUSINESS.stats.instagramFollowers}
              </a>
              <a href={BUSINESS.socials.tiktok} target="_blank" rel="noopener noreferrer" className="chip">
                ♪ {BUSINESS.stats.tiktokFollowers}
              </a>
            </div>
          </Reveal>
          <Reveal className="lg:col-span-7 order-1 lg:order-2">
            <p className="eyebrow mb-4">{t("about_q")}</p>
            <h1 className="heading-xl text-balance text-4xl md:text-6xl max-w-3xl">{t("about_headline")}</h1>
            <p className="body-lg mt-6 max-w-2xl">{t("about_copy")}</p>
          </Reveal>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-6">
          {[
            { icon: Dumbbell, t1: "about_1_title", t2: "about_1_copy" },
            { icon: GraduationCap, t1: "about_2_title", t2: "about_2_copy" },
            { icon: Heart, t1: "about_3_title", t2: "about_3_copy" },
          ].map((c, i) => (
            <Reveal key={c.t1} delay={i * 0.1} className="card-surface p-8 md:p-10">
              <c.icon className="h-7 w-7 text-brand" />
              <h2 className="font-display font-bold text-xl text-ink mt-6">{t(c.t1)}</h2>
              <p className="text-sm text-muted mt-3 leading-relaxed">{t(c.t2)}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-24 border-s-2 border-brand ps-8 py-2">
          <p className="font-display font-extrabold text-3xl lg:text-4xl text-ink max-w-2xl leading-snug text-balance">
            “{t("about_quote")}”
          </p>
          <p className="text-muted mt-4 font-display font-bold text-sm">
            {t("about_quote_by")} — {lang === "ar" ? BUSINESS.coachArabic : BUSINESS.coach}
          </p>
          <a
            href={BUSINESS.socials.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 text-brand font-display font-bold text-sm hover:underline"
          >
            <Youtube className="h-4 w-4" /> YouTube
          </a>
        </Reveal>
      </div>
    </div>
  );
}
