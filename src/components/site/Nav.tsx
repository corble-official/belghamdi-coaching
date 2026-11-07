"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ShoppingBag, Globe } from "lucide-react";
import { useCart, cartCount } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";

const LINKS = [
  { href: "/", key: "nav_home" },
  { href: "/programs", key: "footer_programs" },
  { href: "/coaching", key: "footer_coaching" },
  { href: "/transformations", key: "nav_results" },
  { href: "/about", key: "nav_whoami" },
  { href: "/contact", key: "footer_contact" },
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-cinematic ${
        scrolled || open
          ? "bg-cream/90 backdrop-blur-md border-b border-line shadow-[0_1px_0_rgba(32,35,31,0.02)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 h-16 md:h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img
            src="/logo.png"
            alt="FitForge Coaching"
            width={36}
            height={36}
            className="h-9 w-9 object-contain invert opacity-80"
          />
          <span className="font-latin font-extrabold tracking-tight text-sm md:text-base text-ink uppercase" dir="ltr">
            FitForge Coaching
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-bold text-ink/70 hover:text-brand transition-colors duration-200"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-brand transition-colors"
            aria-label="Switch language"
          >
            <Globe className="h-4 w-4" />
            {lang === "ar" ? "EN" : "عربي"}
          </button>
          <Link href="/cart" className="relative text-ink/70 hover:text-brand transition-colors" aria-label={t("nav_cart")}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span
                className="absolute -top-2 bg-brand text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                style={{ insetInlineEnd: "-0.5rem" }}
              >
                {count}
              </span>
            )}
          </Link>
          <Link href="/programs" className="btn-primary !py-2 !px-5 !text-xs">
            {t("nav_start_now")}
          </Link>
        </div>

        <div className="flex lg:hidden items-center gap-4">
          <Link href="/cart" className="relative text-ink" aria-label={t("nav_cart")}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span
                className="absolute -top-2 bg-brand text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center"
                style={{ insetInlineEnd: "-0.5rem" }}
              >
                {count}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} className="text-ink" aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-cream/95 backdrop-blur-md border-t border-line overflow-hidden"
          >
            <div className="px-6 py-6 flex flex-col gap-4">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-base font-bold text-ink/80 hover:text-brand"
                >
                  {t(l.key)}
                </Link>
              ))}
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="flex items-center gap-2 text-sm font-bold text-muted w-max"
              >
                <Globe className="h-4 w-4" /> {lang === "ar" ? "English" : "عربي"}
              </button>
              <Link href="/programs" onClick={() => setOpen(false)} className="btn-primary w-full">
                {t("nav_start_now")}
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
