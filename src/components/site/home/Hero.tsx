"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/* Single place to drop the real coach photo (public/images/coach.png). */
export const COACH_IMAGE = "/images/coach-avatar.jpg";
/* If true, the hero waits for a HEAD check so a missing file shows the
   placeholder cleanly instead of rendering broken-image alt text. */
const COACH_DYNAMIC = true;

export function CoachPortrait({
  className = "",
  sizes = "",
  priority = false,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"checking" | "ready" | "failed">(
    COACH_DYNAMIC ? "checking" : "ready"
  );

  useEffect(() => {
    if (!COACH_DYNAMIC) return;
    let alive = true;
    fetch(COACH_IMAGE, { method: "HEAD" }).then(
      (r) => alive && setState(r.ok ? "ready" : "failed"),
      () => alive && setState("failed")
    );
    return () => {
      alive = false;
    };
  }, []);

  if (state !== "ready") {
    if (state === "checking") return <div className={`bg-[#f6e2d3] ${className}`} />;
    /* Elegant placeholder until the real photo is added — no identity invented. */
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-[#f6d9c4] text-[#a05a2e] overflow-hidden ${className}`}
        aria-label={t("coach_photo_placeholder")}
      >
        <svg viewBox="0 0 200 260" className="w-3/4 max-w-[240px] fill-[#c99168]" aria-hidden="true">
          <path d="M100 15c20 0 32 13 32 30 0 10-4 18-9 24 26 8 42 32 44 70l6 105h-40l-3-40h-60l-3 40H27l6-105c2-38 18-62 44-70-5-6-9-14-9-24 0-17 12-30 32-30z" />
        </svg>
        <p className="px-4 pb-6 text-center text-xs font-bold opacity-70">
          {t("coach_photo_placeholder")}
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={COACH_IMAGE}
        alt="Coach Adam"
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        onError={() => setState("failed")}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

export function HomeHero() {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const fadeY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <section ref={ref} className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* background accents */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 -start-24 h-72 w-72 rounded-full bg-brand-soft" />
        <div className="absolute top-1/3 end-0 h-96 w-96 rounded-full bg-lime-soft opacity-70" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-cream to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-28 md:pt-36 pb-10 md:pb-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Copy column */}
          <motion.div style={{ y: fadeY }} className="lg:col-span-7 order-2 lg:order-1">
            <p className="inline-flex items-center gap-2 rounded-full bg-white border border-line px-4 py-1.5 text-xs font-bold text-forest">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              {t("hero_kicker2")}
            </p>
            <h1
              id="hero-title"
              className="heading-xl text-balance text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] mt-5"
            >
              {t("hero_headline2")}
            </h1>
            <p className="body-lg mt-5 max-w-[52ch]">{t("hero_copy2")}</p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/programs" className="btn-primary">
                {t("hero_cta_programs")} <Arrow className="h-4 w-4 rtl:rotate-0 ltr:rotate-0" />
              </Link>
              <Link href="/about" className="btn-secondary">
                {t("hero_cta_coach")}
              </Link>
            </div>

            <p className="mt-5 text-sm text-muted flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden="true" />
              {t("hero_trust_line")}
            </p>
          </motion.div>

          {/* Portrait composition */}
          <div className="lg:col-span-5 order-1 lg:order-2 relative">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto max-w-md"
            >
              {/* organic shapes */}
              <div className="absolute -inset-6 md:-inset-10" aria-hidden="true">
                <div className="absolute inset-x-8 bottom-0 top-14 rounded-[3rem] bg-brand-soft" />
                <div className="absolute top-2 end-2 h-16 w-16 rounded-full bg-lime" />
                <div className="absolute bottom-16 start-0 h-8 w-8 rounded-full border-4 border-brand" />
              </div>

              <motion.div style={{ y: imgY }} className="relative rounded-[2.5rem] overflow-hidden shadow-xl aspect-[3/4]">
                <CoachPortrait priority className="w-full h-full" />
              </motion.div>

              {/* floating labels */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-8 -start-3 md:-start-8 bg-white rounded-2xl shadow-lg border border-line px-4 py-3 text-xs font-bold text-ink"
              >
                {t("float_label_coach")}
                <span className="block text-[11px] font-medium text-muted mt-0.5">Coach Adam</span>
              </motion.div>

              <motion.div
                animate={{ y: [0, 9, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                className="absolute bottom-10 end-0 md:-end-6 bg-ink text-white rounded-2xl shadow-lg px-4 py-3 text-xs font-bold"
              >
                {t("float_label_videos")}
              </motion.div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
                className="absolute bottom-24 start-2 md:-start-4 bg-brand text-white rounded-full shadow-lg px-4 py-2 text-xs font-extrabold"
              >
                {t("float_label_price")}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
