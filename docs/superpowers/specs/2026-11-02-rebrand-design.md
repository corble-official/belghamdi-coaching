# Belghamdi Coaching — Rebrand Implementation Plan

## Audit findings
- Next 14.2 App Router, Tw 3.4, framer-motion, zustand; dark theme tokens in tailwind.config.ts (graphite/obsidian/copper...) + dark component classes in globals.css.
- i18n: client context, EN default, saved to localStorage `bc_lang`, sets html lang/dir. Root layout hardcodes lang="en" dir="ltr".
- 3D: `SiteScrollCanvas` mounted site-wide on homepage + `AnatomyExplorer` section; `MusclesFigure` GLB. Spec: remove from homepage flow, keep anatomy reachable as an optional /explore page.
- Real commerce: 6 products (catalog.ts, real Shopify slugs/prices EGP), cart (zustand), checkout with Vodafone Cash/Instapay/Visa flows, coaching packages (demo placeholders), transformations (demo store, flagged demo:true), FAQ/contact/login pages, admin CRM (must not break).
- Assets: only /logo.png. No coach photo in repo → use elegant placeholder component + single config point (COACH_IMAGE) to drop in later.
- Coach stats verified from live site: 20,000+ clients, 65.5K IG, 232K TikTok (BUSINESS in catalog.ts).

## Approach
1. **Design system**: new palette as tokens per spec; remap legacy tokens (graphite→cream bg, obsidian→white card, bone→ink text, copper→brand orange, wgray-dim→light border) so the entire site flips to light without touching admin; rewrite component classes (btn, eyebrow, cards, inputs) light; fonts Alexandria (display, AR+LT) + Tajawal (body, AR) + Manrope (latin).
2. **Arabic-first**: default lang "ar", html lang="ar" dir="rtl" default with suppressHydrationWarning, Arabic-first metadata (title/description/OG), keep switching preserving page (already works).
3. **Homepage** rebuilt per spec: Hero (editorial, cutout portrait placeholder w/ oversized type overlap, parallax, floating labels), TrustStrip, Programs (real catalog, filters via /programs), Why Belghamdi (asymmetric grid), Transformations (demo data + own page), HowItWorks (4 steps, payment methods), Coaching (secondary, premium styling, demo placeholder noted), Coach section (placeholder photo, real socials), Video hub (real channel links + thumbnail placeholders, lightbox-less), Testimonials, FAQ (existing Q&A), FinalCTA, Footer (rich), WhatsApp float.
4. **3D preserved but isolated**: new /explore page hosting AnatomyExplorer; not linked prominently.
5. **No fabricated data**: only BUSINESS stats + catalog facts; demo rows keep demo flags; placeholder labeled "جاهز للاضافة" where asset missing.

## Out of scope (unchanged)
- Shopify/checkout logic, admin CRM, middleware auth, Supabase integrations, EN/AR dictionary API shape.
