# FitForge Demo Rebrand — Short Design

**Date:** 2026-11-07
**Status:** Approved pending partner sign-off

## Intent

Publish the platform as a generic demo. Remove every trace of the real client
(Belghamdi Coaching / Bassam El Ghamdi / بالغامدي) from the site and demo data,
and replace his images with original AI-generated assets.

## Decisions made by the partner

- **Brand:** FitForge Coaching (Arabic: فيت فورج كوتشينج), fictional coach **"Coach Adam" / "الكابتن آدم"**
- **Images:** AI-generated (logo, coach portrait + cover, 6 program covers) in the site's existing palette — copper `#F47B35` on dark premium backgrounds
- **Scope:** site code + demo data only. Docs (README, DEMO.md, AGENTS.md, prompt.md, CLIENT_DATA.md), n8n exports, plans, and specs stay as historical reference.

## Approaches considered

1. **AI-generated assets (chosen)** — consistent branded look, ready to publish; cost: generation time.
2. Neutral gradient/SVG placeholders — lightest, but the demo looks unfinished.
3. Partner-provided photos — best control, but blocks progress until files arrive.

## Changes

1. **`src/lib/catalog.ts`** (single source of truth per CLIENT_DATA.md)
   - `BUSINESS`: brand `FitForge Coaching`, brandLegal `FitForge-Coaching`, coach `Coach Adam` / `الكابتن آدم`, website `https://fitforgecoaching.com` (fictional placeholder), email `coach@fitforgecoaching.com`, WhatsApp `+20 100 000 0000` (fictional), logo `/logo.png` (local), socials → `#` placeholders, stats → fictional (e.g. 12,000+ clients / 48K IG / 120K TikTok). Payments and Cairo location unchanged.
   - Product `image` → local `/images/programs/<slug>.jpg`; `sourceUrl` → `#` (it feeds the "view" tiles in `ProductDetailView.tsx`).
   - Copy: "Belghamdi"/"بالغامدي" → "FitForge"/"فيت فورج" (EN + AR product copy).
2. **`src/lib/i18n.tsx`** — "Why Belghamdi?" → "Why FitForge?" / "ليه فيت فورج؟", coach bio + quote attribution → Coach Adam, portal titles → FitForge.
3. **`src/app/layout.tsx`** — metadata title/siteName → FitForge (EN/AR), `metadataBase`/canonical/OG URLs → `https://fitforgecoaching.com` (placeholder; swap at deploy).
4. **`Nav.tsx` / `Footer.tsx`** — logo alt/text → FitForge Coaching.
5. **`Hero.tsx`** — alt "Captain Belghamdi" → "Coach Adam".
6. **`about/page.tsx`** — quote attribution → Coach Adam.
7. **`src/lib/demo/admin-store.ts` + `admin/subscriptions/page.tsx`** — "Coach Belghamdi" → "Coach Adam", business name/email → FitForge, transformation before/after images → local program covers.
8. **`src/lib/supabase/portal-context.ts`, `portal-onboarding.ts`** — `demo@belghamdicoaching.com` → `demo@fitforgecoaching.com`.
9. **Auth (mirrored per AGENTS.md):** password fallback `belghamdi-demo` → `fitforge-demo` and token salt `belghamdi-admin::v1` → `fitforge-admin::v1` in `middleware.ts`, `supabase/admin-context.ts`, `integrations/server-auth.ts`, `api/admin/auth/route.ts`, and `.env.example`. Old sessions invalidate — acceptable for a demo.
10. **`n8n-client.ts`** — User-Agent → `FitForgeCoaching-Webhook/1.0`.
11. **`src/lib/integrations/shopify.ts` + `checkins.ts` comment** — untouched: live-mode integration pointing at the real store is intentionally out of demo scope and inactive in demo mode.
12. **Generated assets (9):** `public/logo.png` (FF monogram, works at 40px on dark), `public/images/coach-avatar.jpg` (fictional coach portrait), `public/images/coach-cover.jpg` (file replaced; currently unused in code), 6 program covers in `public/images/programs/` — consistent copper-on-dark fitness style, no real person's likeness.
13. **Verify:** `npm run build` (the project's only gate — no tests exist).

## Non-goals / anti-goals

- No real client data may remain site-visible: names, photos, logo, socials, stats, contact info, Shopify CDN URLs.
- No docs/n8n scrubbing (historical reference).
- No functional changes — rebrand + assets only.

## Left to builder

- Exact fictional stat numbers and image prompt details.
- Arabic phrasing that keeps the existing dialect/tone.
