import { notFound } from "next/navigation";
import { CATALOG, getProduct } from "@/lib/catalog";
import { ProductDetailView } from "@/components/site/ProductDetailView";
import type { Metadata } from "next";

export function generateStaticParams() {
  return CATALOG.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.title} — FitForge Coaching`,
    description: product.description,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const related = CATALOG.filter(
    (p) => p.slug !== product.slug && p.category === product.category
  ).slice(0, 3);

  return <ProductDetailView product={product} related={related} />;
}
