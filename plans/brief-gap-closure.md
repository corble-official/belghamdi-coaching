# Plan: Brief-Gap Closure — belghamdicoaching

Spec authority: `prompt.md` (client design brief) + `CLIENT_DATA.md` (demo/live scoping).
Source of gaps: full brief-vs-implementation audit (2026-11-01).

## Global Constraints (bind every task; copy verbatim into reviewer prompts)

1. Demo-vs-real: Silver/Gold coaching prices (LE 89 / LE 149) are demo placeholders — keep them; never invent "real" prices. Any new demo data carries `demo: true` in `src/lib/demo/admin-store.ts`.
2. All product data, prices, contact info live ONLY in `src/lib/catalog.ts` (`BUSINESS`, `CATALOG`, `INJURY_NOTE`, `INCLUDED_ITEMS`). No hardcoded emails/phones/socials/prices in components. Currency is EGP; render prices through `formatMoney()` from `src/lib/utils.ts`.
3. NEW user-facing strings must be added to the `src/lib/i18n.tsx` dictionary with BOTH English and Arabic values and consumed via `useI18n()`. Do not hardcode a single locale in new code. (Pre-existing hardcoded-English copy is being swept by later dedicated i18n tasks — do not rewrite untouched copy in your task.)
3b. RTL: the app flips `dir=rtl` for Arabic (see `src/lib/i18n.tsx`). New markup must not break RTL (avoid introducing new hard `left-/right-` anchored styling).
4. Verification: there are NO tests. Run `npx tsc --noEmit` (must pass clean) after your work, and `npm run build` when told to (full-build tasks only). Do NOT run `npm run lint` (interactive prompt; NOT in devDependencies).
5. Commits: conventional style (`fix: ...`, `feat: ...`), commit after `npx tsc --noEmit` passes. Never push (no remote exists).
6. Stack: Next.js 14 App Router, React 18, TS strict, Tailwind with palette tokens from `tailwind.config.ts` (graphite, obsidian, bone, wgray, copper, surface), framer-motion, lucide-react, zustand. Path alias `@/*` → `src/*`.
7. Code style: no code comments; concise; follow existing patterns in each file you touch.

---

## Task 1: Data-wiring batch (same-shape micro fixes)

1.1 `src/app/(site)/page.tsx` featured-programs filter currently uses stale demo slugs (`ppl-hypertrophy-6`, `muscle-mommies-full-transformation`, `upper-lower-power`) that match nothing in `CATALOG`, rendering an empty grid. Replace with three REAL slugs that exist in `src/lib/catalog.ts`: `anterior-x-posterior`, `push-pull-leg-x-upper-lower`, `upper-lower-4-days`. Verify each chosen slug literally appears in `CATALOG` before substituting.
1.2 Add `email` to `BUSINESS` in `src/lib/catalog.ts` with the value `coach@belghamdicoaching.com` (currently hardcoded in `src/app/(site)/contact/page.tsx:42`), and change the contact page to consume `BUSINESS.email`.
1.3 Replace raw `"LE {price}"` string interpolation with `formatMoney(...)` in `src/app/(site)/checkout/page.tsx` (lines ~124, 139, 144) and `src/app/(site)/programs/[slug]/page.tsx` (lines ~95, 99). Keep identical display output ("LE 380" style) — read `formatMoney` in `src/lib/utils.ts` first to match its output format exactly.

## Task 2: Footer newsletter functional + homepage coaching table

2.1 Footer newsletter form (`src/components/site/Footer.tsx:109-140`) is local-state only — the brief forbids non-functional buttons. Make it work in demo: validate email, store the address in `localStorage` key `bc_newsletter` (append, dedupe), show an inline confirmation ("You're on the list" style) and log an event if an event logger exists (check `src/lib/integrations/events.ts` for an exported logger — if `logEvent` exists, call it with an appropriate named event; do not invent new infrastructure). All new strings via i18n (EN + AR).
2.2 Homepage Online Coaching section (`src/app/(site)/page.tsx:56-87`) lacks the brief's "clear comparison table". Add a compact Silver vs Gold comparison table (4-5 rows drawn from the real `/coaching` comparison in `src/app/(site)/coaching/page.tsx:82-104` — do not invent new selling points), with a link to `/coaching`. Keep the existing demo price handling (home page currently shows cadence, not prices — preserve that choice). All new strings via i18n (EN + AR).

## Task 3: Admin dashboard "New customers" chart

Brief mandates 5 dashboard charts; `src/app/admin/page.tsx:105-131` has 4. Add a "New customers" chart matching the existing chart component/style used there (see `src/components/admin/Charts.tsx`). Feed it from the existing demo-store data (derive from clients/leads as siblings of the other charts do). Demo data stays `demo: true`.

## Task 4: Admin content page — functional tab editors

`src/app/admin/content/page.tsx` declares 4 sections (Homepage, Programs, Coaching, FAQ) but only 2 tabs work. Make each dead tab a minimal functional demo editor: per tab, a small editable list persisted in `src/lib/demo/admin-store.ts` (extend the store; keep `demo: true` discipline), with save feedback consistent with the page's existing UI (`src/components/admin/ui.tsx`). Scope: each tab edits a handful of text fields + a visibility toggle AT MOST — this is demo plumbing for live-mode later, not a CMS. Do not wire demo edits into the public site.

## Task 5: i18n phase 1 — homepage + shared sections

Extend `src/lib/i18n.tsx` dictionary and wire `useI18n()` so that: homepage `src/app/(site)/page.tsx` section eyebrows/headings, `src/components/site/HomeSections.tsx` (Philosophy, How It Works, Testimonials, FinalCTA), and `src/components/site/TransformationTimeline.tsx` render fully in Arabic when the toggle is on. Follow the EN/AR patterns already used in Nav/Footer/Hero. Reveal animations and layout must not change; keep markup structure.

## Task 6: i18n phase 2 — programs, product detail, selector

Same treatment for `src/app/(site)/programs/page.tsx`, `src/app/(site)/programs/[slug]/page.tsx`, `src/app/(site)/selector/page.tsx`. Selector question texts come from `src/lib/selector-rules.ts` — translate display strings via i18n keys inside the page (do not duplicate the rules file; keying pattern: map each question id to an i18n key). Product detail must NOT change which data fields render from CATALOG.

## Task 7: i18n phase 3 — coaching, faq, contact, login, checkout/cart

Same treatment for `src/app/(site)/coaching/page.tsx` (incl. comparison table + coaching FAQ), `src/app/(site)/faq/page.tsx`, `src/app/(site)/contact/page.tsx`, `src/app/(site)/login/page.tsx`, `src/app/(site)/checkout/page.tsx`, `src/app/(site)/cart/page.tsx`. FAQ/coaching FAQ question strings get i18n keys with faithful Arabic translations (Egyptian-appropriate, professional tone). Form labels/placeholders/buttons included.

---

Execution notes: no OPEN i18n phase 4 (admin panel stays English — the brief's bilingual requirement targets the public site). Out-of-scope-by-data (do NOT build): recurring billing, real payments, n8n automation, live Supabase/Shopify connection, real testimonial photos.
