"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock3, ImageIcon, Maximize2 } from "lucide-react";
import type { Transformation } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";

function TransformationCard({ tr, index }: { tr: Transformation; index: number }) {
  const [open, setOpen] = useState(true);
  const { t, lang } = useI18n();
  const weeksLabel = t("timeline_weeks_journey").replace("{weeks}", String(tr.weeks));
  const hasCompare = Boolean(tr.beforeImage && tr.afterImage);

  return (
    <Reveal delay={index * 0.1} className="card-surface">
      <div className="p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            {tr.demo && (
              <span className="inline-block mb-3 text-[10px] font-display font-bold text-muted border border-line px-2 py-1 rounded-full">
                {t("demo_content_note")}
              </span>
            )}
            <h3 className="font-display font-bold text-2xl text-ink">{tr.clientLabel}</h3>
            <p className="flex items-center gap-2 text-sm text-muted mt-1">
              <Clock3 className="h-4 w-4 text-brand" /> {weeksLabel}
            </p>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="text-xs font-display font-bold text-brand hover:text-brand-deep transition-colors"
          >
            {open ? t("timeline_collapse") : t("timeline_expand")}
          </button>
        </div>

        <p className="text-muted text-sm mb-8 max-w-xl">{tr.summary}</p>

        {/* before / after comparison */}
        {hasCompare && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-10 max-w-xl">
            {[
              { src: tr.beforeImage, label: t("results_before") },
              { src: tr.afterImage, label: t("results_after") },
            ].map((im) => (
              <figure key={im.label} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={im.src}
                  alt={`${tr.clientLabel} — ${im.label}`}
                  loading="lazy"
                  className="w-full aspect-square object-cover rounded-2xl border border-line"
                />
                <figcaption
                  className={`absolute bottom-2 text-[11px] font-extrabold px-3 py-1 rounded-full shadow ${
                    im.label === t("results_before") ? "bg-white/90 text-ink start-2" : "bg-brand text-white start-2"
                  }`}
                >
                  {im.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {open && (
          <ol className="relative border-s border-line ms-3 space-y-10">
            {tr.stages.map((stage, si) => (
              <motion.li
                key={si}
                initial={{ opacity: 0, x: lang === "ar" ? 16 : -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: si * 0.08 }}
                className="relative ps-8"
              >
                <span className="absolute -start-[7px] top-1 w-3.5 h-3.5 rounded-full bg-brand border-4 border-white" />
                <p className="text-xs font-display font-bold text-brand">
                  {t("timeline_week_label").replace("{week}", String(stage.week))}
                </p>
                <p className="font-display font-bold text-lg text-ink mt-1">{stage.title}</p>
                <p className="text-sm text-muted mt-1 leading-relaxed max-w-md">{stage.detail}</p>
                <p className="mt-2 font-latin font-bold text-lg text-brand-deep">{stage.metric}</p>
                {stage.image && (
                  <img
                    src={stage.image}
                    alt={`${stage.title} — ${stage.metric}`}
                    loading="lazy"
                    className="mt-3 w-32 h-32 object-cover rounded-xl border border-line md:w-40 md:h-40"
                  />
                )}
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </Reveal>
  );
}

export function TransformationTimeline({ items }: { items: Transformation[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      {items.map((tr, i) => (
        <TransformationCard key={tr.id} tr={tr} index={i} />
      ))}
      {items.length === 0 && (
        <div className="card-surface p-12 text-center">
          <ImageIcon className="h-8 w-8 text-brand mx-auto" />
          <p className="text-muted mt-4 text-sm">{t("results_empty")}</p>
        </div>
      )}
    </div>
  );
}
