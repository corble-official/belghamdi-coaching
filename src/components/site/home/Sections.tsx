"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Wallet,
  Sprout,
  Video,
  RefreshCcw,
  CheckCircle2,
  Banknote,
  CreditCard,
  Clock3,
  Dumbbell,
  Play,
  Instagram,
  Youtube,
  BadgeCheck,
  ChevronDown,
  Quote,
} from "lucide-react";
import { CATALOG, COACHING_PACKAGES, BUSINESS, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { useAdminStore } from "@/lib/demo/admin-store";
import { useI18n } from "@/lib/i18n";
import { CoachPortrait } from "./Hero";

const money = (n: number) => `${n} EGP`;

/* ---------------- shared bits ---------------- */

function UseArrow() {
  const { lang } = useI18n();
  return lang === "ar" ? ArrowLeft : ArrowRight;
}

function SectionHeader({
  kicker,
  title,
  copy,
  align = "start",
}: {
  kicker: string;
  title: string;
  copy?: string;
  align?: "start" | "center";
}) {
  const { t } = useI18n();
  return (
    <div className={align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}>
      <p className="eyebrow">{t(kicker)}</p>
      <h2 className="heading-lg text-3xl md:text-4xl lg:text-[2.6rem] mt-2">{t(title)}</h2>
      {copy && <p className="body-lg mt-3">{t(copy)}</p>}
    </div>
  );
}

/* ---------------- 02 — trust strip ---------------- */

export function TrustStrip() {
  const { t } = useI18n();
  const items = [
    { icon: Wallet, k: "trust_1" },
    { icon: Sprout, k: "trust_2" },
    { icon: Video, k: "trust_3" },
    { icon: RefreshCcw, k: "trust_4" },
    { icon: BadgeCheck, k: "trust_5" },
  ];
  return (
    <section className="border-y border-line bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-5">
        <ul className="flex gap-4 overflow-x-auto no-scrollbar md:grid md:grid-cols-5">
          {items.map((it) => (
            <li key={it.k} className="flex items-center gap-2.5 shrink-0 md:shrink md:justify-center">
              <span className="h-9 w-9 rounded-full bg-lime-soft text-forest flex items-center justify-center shrink-0">
                <it.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm font-bold text-ink whitespace-nowrap">{t(it.k)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- program card (brand-styled) ---------------- */

function LevelLabel({ level }: { level: Product["level"] }) {
  const { t } = useI18n();
  const key = level === "beginner" ? "level_beginner" : level === "advanced" ? "level_advanced" : "level_intermediate";
  return <span>{t(key)}</span>;
}

export function ProgramCard({ product }: { product: Product }) {
  const { t, lang } = useI18n();
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  const addToCart = () => {
    add(product.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group bg-white rounded-3xl border border-line overflow-hidden flex flex-col"
    >
      <Link href={`/programs/${product.slug}`} className="block overflow-hidden aspect-[16/10] bg-brand-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>
      <div className="p-5 md:p-6 flex flex-col grow">
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-forest-soft text-forest px-2.5 py-1"><LevelLabel level={product.level} /></span>
          <span className="rounded-full bg-cream border border-line px-2.5 py-1 text-muted">
            {t("days_per_week_n").replace("{n}", String(product.daysPerWeek))}
          </span>
        </div>
        <h3 className="font-display font-extrabold text-lg mt-3">{product.title}</h3>
        <p className="text-sm text-muted mt-2 line-clamp-2 leading-relaxed">{product.description}</p>

        <div className="flex items-end justify-between gap-3 mt-5 pt-4 border-t border-line">
          <div>
            {product.compareAtPrice && (
              <p className="text-xs text-muted line-through">{money(product.compareAtPrice)}</p>
            )}
            <p className="font-display font-extrabold text-2xl text-brand" dir="ltr">
              {money(product.price)}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={addToCart} className="btn-primary !py-2.5 !px-5 !text-xs">
              {added ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <>
                  {t("cta_add_cart")} <Arrow className="h-3.5 w-3.5" />
                </>
              )}
            </button>
            <Link
              href={`/programs/${product.slug}`}
              className="btn-secondary !py-2.5 !px-4 !text-xs"
              aria-label={`${t("cta_view_details")} — ${product.title}`}
            >
              {t("cta_view_details")}
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ---------------- 03 — programs ---------------- */

const FEATURED = ["full-body-3-days-high-frequency-split", "upper-lower-4-days", "anterior-x-posterior"];

export function ProgramsSection() {
  const { t } = useI18n();
  const featured = FEATURED.map((slug) => CATALOG.find((p) => p.slug === slug)).filter(Boolean) as Product[];
  const Arrow = UseArrow();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeader
            kicker="programs2_section_name"
            title="programs2_headline"
            copy="programs2_copy"
          />
          <Link href="/programs" className="btn-secondary !py-3">
            {t("programs2_cta_all")} <Arrow className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          {featured.map((p) => (
            <ProgramCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 04 — why fitforge ---------------- */

const WHY = [
  { k: 1, bg: "bg-brand-soft", span: "md:col-span-2" },
  { k: 2, bg: "bg-white", span: "" },
  { k: 3, bg: "bg-lime-soft", span: "" },
  { k: 4, bg: "bg-white", span: "" },
  { k: 5, bg: "bg-lime-soft", span: "md:col-span-2" },
  { k: 6, bg: "bg-brand-soft", span: "md:col-span-1" },
];

export function WhySection() {
  const { t } = useI18n();
  return (
    <section className="py-20 md:py-28 bg-white border-y border-line">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <SectionHeader kicker="why_title" title="why_headline" />
        <div className="grid gap-4 md:grid-cols-3 mt-12">
          {WHY.map((w) => (
            <div
              key={w.k}
              className={`${w.bg} ${w.span} rounded-3xl border border-line p-6 md:p-8 relative overflow-hidden`}
            >
              <span className="absolute -top-3 end-4 font-display font-extrabold text-6xl text-ink/10 select-none" aria-hidden="true">
                0{w.k}
              </span>
              <h3 className="font-display font-extrabold text-lg md:text-xl text-ink">{t(`why_${w.k}_title`)}</h3>
              <p className="text-sm md:text-[15px] text-muted mt-2 leading-relaxed max-w-[36ch]">{t(`why_${w.k}_copy`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 05 — results ---------------- */

export function ResultsSection() {
  const { t } = useI18n();
  const transformations = useAdminStore((s) => s.transformations).filter((tr) => tr.visible);
  const Arrow = UseArrow();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <SectionHeader kicker="section_transformations" title="results_headline" copy="results_copy" />
        {transformations.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 mt-12">
            {transformations.slice(0, 2).map((tr) => (
              <div key={tr.id} className="card-surface p-6 md:p-8">
                <p className="eyebrow">{t("timeline_weeks_journey").replace("{weeks}", String(tr.weeks))}</p>
                <p className="font-display font-extrabold text-xl mt-2">{tr.clientLabel}</p>
                <p className="text-sm text-muted mt-2">{tr.summary}</p>
                <ul className="mt-5 space-y-2.5">
                  {tr.stages.map((st) => (
                    <li key={st.week} className="flex items-start gap-3 text-sm">
                      <span className="h-6 w-6 rounded-full bg-lime-soft text-forest flex items-center justify-center text-[10px] font-extrabold shrink-0">
                        {st.week}
                      </span>
                      <span>
                        <b className="font-bold">{st.title}</b>
                        <span className="text-muted"> — {st.metric}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-surface p-12 text-center mt-12">
            <Dumbbell className="h-8 w-8 text-brand mx-auto" />
            <p className="body-lg mt-4">{t("results_copy")}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 mt-10">
          <Link href="/transformations" className="btn-secondary !py-3">
            {t("results_cta")} <Arrow className="h-4 w-4" />
          </Link>
          <p className="text-xs text-muted">{t("results_note")}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 06 — how it works ---------------- */

export function HowItWorksHome() {
  const { t } = useI18n();
  const steps = [
    { k: 1, icon: Banknote },
    { k: 2, icon: Wallet },
    { k: 3, icon: BadgeCheck },
    { k: 4, icon: Dumbbell },
  ];
  return (
    <section className="py-20 md:py-28 bg-white border-y border-line overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <SectionHeader kicker="hiw_eyebrow" title="hiw2_headline" />
        <ol className="grid gap-6 md:grid-cols-4 mt-12 relative">
          {steps.map((s, i) => (
            <li key={s.k} className="relative">
              {i > 0 && (
                <span className="hidden md:block absolute top-7 -start-full w-full h-px bg-[repeating-linear-gradient(90deg,#e9e7df_0_10px)] -translate-x-1/2" aria-hidden="true" />
              )}
              <span className="h-[54px] w-[54px] rounded-2xl bg-brand-soft text-brand flex items-center justify-center relative">
                <s.icon className="h-6 w-6" />
                <span className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-ink text-white text-[11px] font-extrabold flex items-center justify-center">
                  {s.k}
                </span>
              </span>
              <h3 className="font-display font-extrabold text-lg mt-4">{t(`hiw2_step${s.k}`)}</h3>
              <p className="text-sm text-muted mt-1.5 leading-relaxed">{t(`hiw2_step${s.k}_copy`)}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2 mt-10 text-xs font-bold text-ink/70">
          {BUSINESS.payments.map((p) => (
            <span key={p} className="chip !cursor-default">
              <CreditCard className="h-3.5 w-3.5 text-brand" /> {p}
            </span>
          ))}
          <span className="chip !cursor-default">
            <Clock3 className="h-3.5 w-3.5 text-brand" /> {t("cart_delivery_value")}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 07 — coaching (secondary, premium) ---------------- */

export function CoachingSection() {
  const { t } = useI18n();
  const Arrow = UseArrow();
  const features = [
    "coaching2_feat_personalized",
    "coaching2_feat_nutrition",
    "coaching2_feat_followup",
    "coaching2_feat_adjustments",
    "coaching2_feat_explanations",
  ];
  return (
    <section className="py-20 md:py-28 bg-forest text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 grid lg:grid-cols-5 gap-10 items-center">
        <div className="lg:col-span-3">
          <p className="font-display font-bold text-lime text-sm">{t("footer_coaching")}</p>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl lg:text-[2.6rem] leading-tight mt-2">
            {t("coaching2_q")}
          </h2>
          <p className="text-white/70 leading-relaxed mt-4 max-w-[52ch]">{t("coaching2_copy")}</p>

          <ul className="grid sm:grid-cols-2 gap-3 mt-8">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm font-bold text-white/90">
                <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px] text-lime shrink-0" />
                {t(f)}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 mt-8">
            {COACHING_PACKAGES.map((p) => (
              <span key={p.id} className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-sm">
                <b className="font-display font-extrabold text-lime">{p.name}</b>
                <span className="text-white/70" dir="ltr"> — ${p.price}/mo</span>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-9">
            <Link href="/coaching" className="btn-primary !bg-lime !text-ink hover:!bg-white">
              {t("coaching2_cta")} <Arrow className="h-4 w-4" />
            </Link>
            <p className="text-xs text-white/60 max-w-[40ch]">{t("coaching2_diff")}</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl aspect-[4/5]">
            <CoachPortrait className="w-full h-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 08 — about coach ---------------- */

export function CoachSection() {
  const { t, lang } = useI18n();
  const Arrow = UseArrow();
  const socials = [
    { href: BUSINESS.socials.instagram, label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
    { href: BUSINESS.socials.tiktok, label: "TikTok", icon: <span className="text-sm font-black">♪</span> },
    { href: BUSINESS.socials.youtube, label: "YouTube", icon: <Youtube className="h-4 w-4" /> },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-4 order-2 lg:order-1">
          <div className="relative rounded-[2.5rem] overflow-hidden shadow-xl aspect-[4/5] max-w-md">
            <CoachPortrait className="w-full h-full" />
            <span className="absolute bottom-4 start-4 bg-white/95 rounded-full px-4 py-2 text-xs font-extrabold text-ink shadow">
              {t("float_label_coach")}</span>
          </div>
          <div className="flex gap-3 mt-5">
            <a href={BUSINESS.socials.instagram} target="_blank" rel="noopener noreferrer" className="chip">
              <Instagram className="h-3.5 w-3.5 text-brand" /> {BUSINESS.stats.instagramFollowers}
            </a>
            <a href={BUSINESS.socials.tiktok} target="_blank" rel="noopener noreferrer" className="chip">
              ♪ {BUSINESS.stats.tiktokFollowers}
            </a>
          </div>
        </div>

        <div className="lg:col-span-8 order-1 lg:order-2">
          <p className="eyebrow">{t("coach_section_q")}</p>
          <h2 className="heading-lg text-3xl md:text-4xl mt-2">
            {lang === "ar" ? BUSINESS.coachArabic : BUSINESS.coach}
          </h2>
          <p className="body-lg mt-5 max-w-[60ch]">{t("coach_section_copy")}</p>
          <div className="rounded-3xl bg-white border border-line p-6 md:p-8 mt-8 max-w-2xl">
            <p className="text-sm md:text-[15px] text-muted leading-relaxed">
              <Quote className="h-4 w-4 text-brand inline-block mb-1" />
              {lang === "ar"
                ? "الفلسفة دي مش خطة تمرين بس — دي طريقة تفكر بيها: برنامج واضح، وتنفيذ صح، واستمرارية بلا تخمين."
                : "This philosophy is not just a workout plan — it's a way of thinking: a clear program, correct execution, and consistency without guesswork."}
            </p>
          </div>
          <Link href="/about" className="btn-primary mt-8">
            {t("hero_cta_coach")} <Arrow className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 09 — video hub (real YouTube content) ---------------- */

const YOUTUBE_VIDEOS = [
  { id: "5n4uHXIFIFk", title: "جنون العظمه | انا ال غيرت مجتمع الچيم للابد !!!" },
  { id: "Xk_TaLVfBwY", title: "اديني ٢٠ دقيقه وهغير حياتك للابد" },
  { id: "CgP5fXLg5q4", title: "شرحت تمارين الضهر ل مبتدأ ! | ١٥ يوم ع المسرح" },
  { id: "qSeM4epwlyI", title: "١٩ يوم ع البطوله | يوم كامل ف كواليس التجهيز" },
  { id: "NvTW9CSP8yI", title: "اقل من ٢٠ يوم ع البطوله ! | التعب بدأ يزيد والنهايه قربت" },
  { id: "2s9C4RWBOJc", title: "اسأله تعرفنا علي بعض اكتر | Q&A مع شادي طارق" },
];

export function VideoHubSection() {
  const { t } = useI18n();
  const Arrow = UseArrow();
  return (
    <section className="py-20 md:py-28 bg-white border-y border-line">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeader kicker="footer_videos" title="videos_section_q" copy="videos_copy" />
          <a href={BUSINESS.socials.youtube} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-3">
            {t("videos_cta")} <Arrow className="h-4 w-4" />
          </a>
        </div>
        {/* real YouTube videos — the player loads on click, never on page load */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-12">
          {YOUTUBE_VIDEOS.map((v) => (
            <a
              key={v.id}
              href={`https://www.youtube.com/watch?v=${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-3xl overflow-hidden border border-line aspect-video bg-ink"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                alt={v.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-12 w-12 rounded-full bg-white/95 text-ink flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              </span>
              <span className="absolute bottom-3 inset-x-3 text-white text-xs font-bold leading-snug line-clamp-2">
                {v.title}
              </span>
              <span className="absolute top-3 end-3 bg-white/95 rounded-full px-3 py-1 text-[10px] font-extrabold flex items-center gap-1.5">
                <Youtube className="h-3.5 w-3.5" /> {t("video_platform_yt")}
              </span>
            </a>
          ))}
          {/* Instagram placeholder — curated reels land here */}
          <a
            href={BUSINESS.socials.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-3xl overflow-hidden border border-line aspect-video bg-gradient-to-br from-[#d94ea0] to-[#f47b35]"
          >
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-12 w-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                <Instagram className="h-5 w-5 text-[#d94ea0]" />
              </span>
            </span>
            <span className="absolute bottom-3 start-3 bg-white/95 rounded-full px-3 py-1.5 text-[11px] font-extrabold">
              {t("video_platform_ig")} — Instagram Reels
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 10 — testimonials ---------------- */

export function TestimonialsHome() {
  const { t } = useI18n();
  const testimonials = useAdminStore((s) => s.testimonials).filter((x) => x.visible);
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <SectionHeader kicker="testimonials2_q" title="testimonials2_title" />
        {testimonials.length > 0 ? (
          <div className="flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory mt-12 pb-2">
            {testimonials.map((tm) => (
              <figure
                key={tm.id}
                className="snap-start shrink-0 w-[300px] md:w-[380px] bg-white rounded-3xl border border-line p-7 flex flex-col"
              >
                <div className="flex gap-1 text-brand" aria-label={`${tm.rating}/5`}>
                  {Array.from({ length: tm.rating }).map((_, i) => (
                    <span key={i} aria-hidden="true">★</span>
                  ))}
                </div>
                <blockquote className="text-sm md:text-[15px] leading-relaxed text-ink/80 mt-4 grow">
                  “{tm.quote}”
                </blockquote>
                <figcaption className="mt-5 pt-4 border-t border-line text-sm">
                  <b className="font-display font-extrabold">{tm.clientName}</b>
                  <span className="block text-xs text-muted mt-0.5">{tm.program}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------- 11 — FAQ ---------------- */

const FAQ_KEYS = Array.from({ length: 7 }, (_, i) => i + 1);

export function FaqHome() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(1);
  return (
    <section className="py-20 md:py-28 bg-white border-y border-line">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <SectionHeader kicker="faq_eyebrow" title="faq_title" align="center" />
        <div className="mt-10 divide-y divide-line border border-line rounded-3xl overflow-hidden">
          {FAQ_KEYS.map((n) => {
            const isOpen = open === n;
            return (
              <div key={n} className="bg-white">
                <button
                  onClick={() => setOpen(isOpen ? null : n)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-start px-6 py-5 hover:bg-cream/60 transition-colors"
                >
                  <span className="font-display font-bold text-[15px] md:text-base">{t(`faq_${n}_q`)}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-brand transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-sm md:text-[15px] leading-relaxed text-muted">{t(`faq_${n}_a`)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 12 — final CTA ---------------- */

export function FinalCtaHome() {
  const { t } = useI18n();
  const Arrow = UseArrow();
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand text-white px-7 md:px-14 py-14 md:py-20">
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -top-16 -end-10 h-64 w-64 rounded-full bg-lime" />
            <div className="absolute bottom-0 start-1/3 h-40 w-40 rounded-full bg-white/30" />
          </div>
          <div className="relative grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
              <h2 className="font-display font-extrabold text-3xl md:text-5xl leading-tight text-balance">
                {t("final_q")}
              </h2>
              <p className="text-white/85 mt-4 md:text-lg max-w-[52ch]">{t("final_copy2")}</p>
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 bg-white text-ink font-display font-extrabold text-sm md:text-base px-8 py-4 rounded-full mt-8 hover:bg-cream transition-colors"
              >
                {t("final_cta2")} <Arrow className="h-4 w-4" />
              </Link>
            </div>
            <div className="lg:col-span-4 hidden md:block">
              <div className="rounded-[2rem] overflow-hidden aspect-[3/4] rotate-3 shadow-2xl max-w-[280px] mx-auto">
                <CoachPortrait className="w-full h-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
