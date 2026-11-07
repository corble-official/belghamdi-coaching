"use client";

import Link from "next/link";
import { Instagram, Youtube, Mail, MapPin, ArrowUpRight } from "lucide-react";
import { BUSINESS } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.89-2.89c.3 0 .6.05.87.13v-3.5a6.33 6.33 0 1 0 5.47 6.27V7.69a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1 .48z" />
    </svg>
  );
}

export function Footer() {
  const { t, lang } = useI18n();
  const year = new Date().getFullYear();

  const social = [
    { href: BUSINESS.socials.instagram, icon: <Instagram className="h-4 w-4" />, label: "Instagram" },
    { href: BUSINESS.socials.tiktok, icon: <TikTokIcon />, label: "TikTok" },
    { href: BUSINESS.socials.youtube, icon: <Youtube className="h-4 w-4" />, label: "YouTube" },
  ];

  return (
    <footer className="bg-ink text-cream/80 mt-0">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
              <span className="font-latin font-extrabold text-base text-cream uppercase" dir="ltr">
                FitForge Coaching
              </span>
            </div>
            <p className="text-sm leading-relaxed mt-4 max-w-[36ch] text-cream/60">
              {lang === "ar"
                ? "برامج تدريب جاهزة بأسعار في المتناول، وشرح بالفيديو لكل تمرين — عشان تتمرن صح من غير عشوائية."
                : "Ready-made training programs at fair prices, with video explanations for every exercise — so you can train right, without guesswork."}
            </p>
            <div className="flex gap-3 mt-6">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-9 w-9 rounded-full border border-cream/20 flex items-center justify-center hover:border-brand hover:text-brand transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="font-display font-bold text-cream text-sm mb-4">{t("footer_programs")}</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/programs" className="hover:text-brand transition-colors">{t("footer_programs")}</Link></li>
              <li><Link href="/coaching" className="hover:text-brand transition-colors">{t("footer_coaching")}</Link></li>
              <li><Link href="/transformations" className="hover:text-brand transition-colors">{t("footer_transformations")}</Link></li>
              <li><Link href="/about" className="hover:text-brand transition-colors">{t("nav_whoami")}</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="font-display font-bold text-cream text-sm mb-4">{t("footer_contact")}</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand shrink-0" />
                <a href={`mailto:${BUSINESS.email}`} className="hover:text-brand transition-colors" dir="ltr">
                  {BUSINESS.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand shrink-0 font-bold" dir="ltr">✆</span>
                <a href={BUSINESS.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-brand transition-colors" dir="ltr">
                  {BUSINESS.whatsapp}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand shrink-0" />
                {BUSINESS.location}
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 text-sm">
            <p className="font-display font-bold text-cream text-sm mb-4">
              {lang === "ar" ? "تجارب وتوثيق" : "Explore"}
            </p>
            <ul className="space-y-2.5">
              <li><Link href="/selector" className="hover:text-brand transition-colors">{t("selector_eyebrow")}</Link></li>
              <li><Link href="/faq" className="hover:text-brand transition-colors">{t("faq_eyebrow")}</Link></li>
              <li><Link href="/login" className="hover:text-brand transition-colors">{t("nav_login")}</Link></li>
              <li>
                <Link href="/explore" className="hover:text-brand transition-colors inline-flex items-center gap-1">
                  {t("footer_explore3d")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-cream/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cream/50">
          <p>© {year} {BUSINESS.brandLegal}. {lang === "ar" ? "كل الحقوق محفوظة." : "All rights reserved."}</p>
          <div className="flex items-center gap-5">
            <Link href="/faq" className="hover:text-brand transition-colors">{t("footer_privacy")}</Link>
            <Link href="/faq" className="hover:text-brand transition-colors">{t("footer_terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
