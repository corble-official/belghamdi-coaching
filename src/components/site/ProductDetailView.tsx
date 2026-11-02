"use client";

import { AddToCartButton } from "@/components/site/AddToCartButton";
import {
  INJURY_NOTE,
  INJURY_NOTE_AR,
  includedLines,
  benefitsFor,
  productTitle,
  productDescription,
  productAudience,
  productFrequency,
  levelName,
  type Product,
  type ProductCategory,
} from "@/lib/catalog";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";

const CATEGORY_AR: Record<ProductCategory, string> = {
  "Training Splits": "تقسيمات تدريب",
  "Full Body": "فول بودي",
  "Upper / Lower": "أبر لور",
  PPL: "بوش بول ليج",
  "Specialized Programs": "برامج خاصة",
  "Women's Training": "نسائي",
};

export function ProductDetailView({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { t, lang } = useI18n();
  const title = productTitle(product, lang);
  const categoryLabel = lang === "ar" ? CATEGORY_AR[product.category] : product.category;
  const Arrow = lang === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div className="pt-32 pb-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-14 items-start">
          <div>
            <a
              href="/programs"
              className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand transition-colors mb-10"
            >
              <Arrow className="h-4 w-4" /> {t("cta_all_programs")}
            </a>

            <div className="relative rounded-3xl border border-line bg-white aspect-[4/3] flex items-center justify-center overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-9xl text-line/60">
                  {title
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              )}
              <span className="absolute top-5 start-5 text-[10px] font-display font-bold tracking-wide text-brand bg-white/90 px-3 py-1.5 rounded-full">
                {categoryLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[1, 2, 3].map((n) => (
                <a
                  key={n}
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-[4/3] rounded-xl border border-line bg-white flex items-center justify-center text-xs text-muted font-display font-bold hover:text-brand hover:border-brand transition-colors"
                >
                  {t("product_view_n").replace("{n}", String(n))}
                </a>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-3">{categoryLabel}</p>
            <h1 className="heading-xl text-4xl md:text-5xl">{title}</h1>

            <div className="flex items-baseline gap-3 mt-6">
              <span className="font-display font-bold text-4xl text-ink">
                {formatMoney(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-xl text-muted/60 line-through">
                  {formatMoney(product.compareAtPrice)}
                </span>
              )}
            </div>

            <p className="text-muted leading-relaxed mt-6">{productDescription(product, lang)}</p>

            <div className="mt-6 p-4 border border-brand/40 bg-brand-soft rounded-xl">
              <p className="text-xs text-brand-deep font-display font-bold mb-2">
                {t("product_important_note")}
              </p>
              <p className="text-sm text-muted">{lang === "ar" ? INJURY_NOTE_AR : INJURY_NOTE}</p>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-4">
              <div className="border border-line p-4 rounded-xl bg-white">
                <dt className="text-xs font-display font-bold text-muted">
                  {t("product_frequency")}
                </dt>
                <dd className="font-display font-bold text-ink mt-1">{productFrequency(product, lang)}</dd>
              </div>
              <div className="border border-line p-4 rounded-xl bg-white">
                <dt className="text-xs font-display font-bold text-muted">
                  {t("product_level")}
                </dt>
                <dd className="font-display font-bold text-ink mt-1">{levelName(product.level, lang)}</dd>
              </div>
            </dl>

            <p className="text-xs text-muted mt-4">
              {t("product_for").replace("{audience}", productAudience(product, lang))}
            </p>

            <div className="mt-10">
              <AddToCartButton productId={product.id} price={product.price} />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-14 mt-24">
          <div>
            <h2 className="heading-lg text-2xl mb-6">{t("product_whats_included")}</h2>
            <ul className="space-y-3">
              {includedLines(lang).map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink">
                  <Check className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="heading-lg text-2xl mb-6">{t("product_benefits_title")}</h2>
            <ul className="space-y-3">
              {benefitsFor(product, lang).map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink">
                  <Check className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 p-6 border border-line bg-white rounded-2xl">
              <p className="text-xs font-display font-bold text-muted mb-3">
                {t("product_video_library")}
              </p>
              <div className="flex gap-3">
                {[1, 2, 3, 4].map((v) => (
                  <div
                    key={v}
                    className="w-20 h-14 bg-cream border border-line rounded-lg flex items-center justify-center text-muted text-xs"
                  >
                    <Play className="h-4 w-4 text-brand" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-28">
            <h2 className="heading-lg text-2xl mb-8">{t("product_related_title")}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {related.map((r) => (
                <a
                  key={r.id}
                  href={`/programs/${r.slug}`}
                  className="card-surface p-6 hover:border-brand transition-colors group"
                >
                  <p className="eyebrow mb-2">
                    {lang === "ar" ? CATEGORY_AR[r.category] : r.category}
                  </p>
                  <p className="font-display font-bold text-lg text-ink group-hover:text-brand transition-colors">
                    {productTitle(r, lang)}
                  </p>
                  <p className="text-sm text-muted mt-2">{productFrequency(r, lang)}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
