"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Product, ProductCategory } from "@/lib/catalog";
import { productTitle, productDescription } from "@/lib/catalog";
import { formatMoney } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const CATEGORY_AR: Record<ProductCategory, string> = {
  "Training Splits": "تقسيمات تدريب",
  "Full Body": "فول بودي",
  "Upper / Lower": "أبر لور",
  PPL: "بوش بول ليج",
  "Specialized Programs": "برامج خاصة",
  "Women's Training": "نسائي",
};

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { t, lang } = useI18n();
  const title = productTitle(product, lang);
  const categoryLabel = lang === "ar" ? CATEGORY_AR[product.category] : product.category;
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group card-surface relative overflow-hidden"
    >
      <Link href={`/programs/${product.slug}`} className="block">
        <div className="relative h-44 overflow-hidden border-b border-line bg-surface">
          {product.image ? (
            <img
              src={product.image}
              alt={title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-7xl text-line group-hover:text-brand/40 transition-colors duration-500">
                {title
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            </div>
          )}
          <span className="absolute top-4 start-4 text-[10px] font-display font-bold tracking-wide text-brand bg-white/90 px-3 py-1.5 rounded-full">
            {categoryLabel}
          </span>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-bold text-lg text-ink leading-snug group-hover:text-brand transition-colors">
              {title}
            </h3>
            <ArrowUpRight className="h-4 w-4 text-muted/50 group-hover:text-brand transition-colors mt-1 shrink-0 rtl:-scale-x-100" />
          </div>
          <p className="text-sm text-muted mt-2 line-clamp-2">{productDescription(product, lang)}</p>
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-xl text-ink">
                {formatMoney(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted/60 line-through">
                  {formatMoney(product.compareAtPrice)}
                </span>
              )}
            </div>
            <span className="text-xs font-display font-bold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
              {t("cta_view_details")}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
