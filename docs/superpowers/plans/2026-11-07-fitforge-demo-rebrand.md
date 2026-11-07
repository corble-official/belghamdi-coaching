# FitForge Demo Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every trace of the real client (Belghamdi / بالغامدي) in the site and demo data with the fictional "FitForge Coaching" brand and AI-generated assets, so the project can be published as a demo.

**Architecture:** Single-source rebrand — `src/lib/catalog.ts` `BUSINESS`/`CATALOG` feeds most user-facing strings; i18n strings live in `src/lib/i18n.tsx`; admin demo data is centralized in `src/lib/demo/admin-store.ts` with a few page-local defaults. Auth salt/password strings are duplicated across 4 files by design and must be changed in lockstep. Images are static files under `public/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind. No tests exist — verification is `grep` for residual brand strings + `npm run build` (the project's only gate, per AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-11-07-fitforge-demo-rebrand-design.md`

## Global Constraints

- Brand: `FitForge Coaching` / Arabic `فيت فورج كوتشينج`; coach: `Coach Adam` / `الكابتن آدم`
- Fictional contacts: email `coach@fitforgecoaching.com`, website `https://fitforgecoaching.com`, WhatsApp `+20 100 000 0000` / link `https://wa.me/201000000000`
- Auth strings (identical in all 4 auth files): password fallback `fitforge-demo`, token salt `::fitforge-admin::v1`
- Product images: local `/images/programs/<slug>.jpg` — no external CDN URLs
- Palette for generated images: copper `#F47B35` accents on dark charcoal, premium editorial fitness style, no text baked into images
- Out of scope (leave untouched): `src/lib/integrations/shopify.ts`, `src/lib/checkins.ts` + `CheckinForm.tsx` comments (factual repo-path references), all docs/n8n/plans
- EN/AR parity: every replaced string must be fixed in both languages where both exist

## Review Focus

- Residual brand strings in **Arabic** (`بالغامدي`) — grep for Latin-only patterns misses them; expect zero matches for both scripts when done.
- Residual real URLs (`belghamdicoaching.com`) in src/ — would keep hotlinking his images/metadata even after copy changes.
- Auth mirror invariant — `middleware.ts`, `api/admin/auth/route.ts`, `supabase/admin-context.ts`, `integrations/server-auth.ts` must all use `fitforge-demo` + `::fitforge-admin::v1` or admin login breaks.
- Image path integrity — every `image`/`logo` path referenced in `catalog.ts`/`admin-store.ts` must exist under `public/`.
- Test: each task's final grep step pins its own scope; Task 10 runs the exhaustive sweep + build.

---

### Task 1: Brand identity in `catalog.ts` (BUSINESS + products + copy)

**Files:**
- Modify: `src/lib/catalog.ts`

**Interfaces:**
- Produces: `BUSINESS` consumed by Nav/Footer/Sections/WhatsApp/contact/about; `CATALOG[].image` local paths; `CATALOG[].sourceUrl` = `"#"`.

- [ ] **Step 1: Replace `BUSINESS` values**

```ts
brand: "FitForge Coaching",
brandLegal: "FitForge-Coaching",
coach: "Coach Adam",
coachArabic: "الكابتن آدم",
location: "Cairo, Egypt",              // unchanged
website: "https://fitforgecoaching.com",
email: "coach@fitforgecoaching.com",
whatsapp: "+20 100 000 0000",
whatsappLink: "https://wa.me/201000000000",
logo: "/logo.png",
stats: { clientsServed: "12,000+", clientsOnSplits: "9,000+", instagramFollowers: "48K", tiktokFollowers: "120K" },
payments: unchanged,
socials: { instagram: "#", tiktok: "#", youtube: "#", threads: "#" },
```

- [ ] **Step 2: Replace product images + sourceUrl**
  - Delete `const CDN = "https://belghamdicoaching.com/cdn/shop/files";`
  - Per product: `image: "/images/programs/<slug>.jpg"`, `sourceUrl: "#"` for all 6 slugs (`anterior-x-posterior`, `arnold-x-u-l`, `muscle-mommies-4-5-days-splits`, `full-body-3-days-high-frequency-split`, `push-pull-leg-x-upper-lower`, `upper-lower-4-days`).

- [ ] **Step 3: Replace copy, EN + AR**
  - L38 comment → `/* Demo catalog — fictional FitForge brand. Structure mirrors a real Shopify coaching store. */`
  - L115 "signature Belghamdi system" → "signature FitForge system"; L124 "Signature Belghamdi system" → "Signature FitForge system"; L165 "signature Belghamdi women's split" → "signature FitForge women's split"
  - L249 `نظام بالغامدي` → `نظام فيت فورج`; L261 `تقسيمة بالغامدي المميزة` → `تقسيمة فيت فورج المميزة`; L315 `نظام بالغامدي المميز` → `نظام فيت فورج المميز`

- [ ] **Step 4: Verify**

Run: `grep -n "elghamdi\|بالغامدي" src/lib/catalog.ts`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog.ts
git commit -m "rebrand: FitForge brand identity in catalog (BUSINESS, products, copy)"
```

### Task 2: i18n strings

**Files:**
- Modify: `src/lib/i18n.tsx`

- [ ] **Step 1: Replace the 6 brand-string locations**
  - L528 `why_title` → `{ en: "Why FitForge?", ar: "ليه فيت فورج؟" }`
  - L579-580 coach bio → `I'm Coach Adam — ...` / `أنا الكابتن آدم، من سنين بشغّل ...` (rest of sentence unchanged)
  - L621-622 → `FitForge Coaching exists to bring ...` / `فيت فورج كوتشينج موجود عشان ...`
  - L643 `about_quote_by` → `{ en: "— Coach Adam", ar: "— الكابتن آدم" }`
  - L662-663 portal title → `{ en: "FitForge Coaching — client portal", ar: "فيت فورج — بوابة العملاء" }`

- [ ] **Step 2: Verify**

Run: `grep -n "elghamdi\|بالغامدي" src/lib/i18n.tsx`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "rebrand: FitForge strings in i18n (EN+AR)"
```

### Task 3: Metadata (root layout + program pages)

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/(site)/programs/[slug]/page.tsx`

- [ ] **Step 1: layout.tsx** — `metadataBase`/`canonical`/`languages`/OG `url` → `https://fitforgecoaching.com`; title (L27 + L35) → `فيت فورج كوتشينج — برامج تدريبية بخطوات واضحة`; `siteName` → `FitForge Coaching`. OG `images: [{ url: "/logo.png" }]` stays.
- [ ] **Step 2: programs/[slug]/page.tsx L19** → `` `${product.title} — FitForge Coaching` ``
- [ ] **Step 3: Verify** — `grep -n "elghamdi" src/app/layout.tsx "src/app/(site)/programs/[slug]/page.tsx"` → no matches.
- [ ] **Step 4: Commit** — `git commit -m "rebrand: FitForge site metadata"`

### Task 4: Site components (Nav, Footer, Hero, Sections)

**Files:**
- Modify: `src/components/site/Nav.tsx`, `src/components/site/Footer.tsx`, `src/components/site/home/Hero.tsx`, `src/components/site/home/Sections.tsx`

- [ ] **Step 1:** Nav L45 alt + L51 text → `FitForge Coaching`; Footer L34 text → `FitForge Coaching`; Hero L64 alt → `Coach Adam`; Sections L200 comment → `/* ---------------- 04 — why fitforge ---------------- */`
- [ ] **Step 2: Verify** — `grep -rn "elghamdi" src/components/` → no matches.
- [ ] **Step 3: Commit** — `git commit -m "rebrand: FitForge in site chrome components"`

### Task 5: Admin demo data + admin chrome

**Files:**
- Modify: `src/lib/demo/admin-store.ts`, `src/app/admin/leads/page.tsx`, `src/app/admin/clients/page.tsx`, `src/app/admin/subscriptions/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`

- [ ] **Step 1: admin-store.ts** — replaceAll `Coach Belghamdi` → `Coach Adam` (11×); L188 `businessName` → `FitForge Coaching`; L189 `contactEmail` → `coach@fitforgecoaching.com`; L111/L116 body copy → `Coach Adam`; transformation images L68-69, L72, L74 → `/images/programs/muscle-mommies-4-5-days-splits.jpg` + `/images/programs/full-body-3-days-high-frequency-split.jpg`; L83-84 → `/images/programs/upper-lower-4-days.jpg` + `/images/programs/push-pull-leg-x-upper-lower.jpg` (milestone `image` fields reuse the same two local files as their transformation's pair).
- [ ] **Step 2: pages** — `assignedCoach: "Coach Adam"` in leads L24, clients L37, subscriptions L68; admin `layout.tsx` L205 → `FitForge Admin`; `login/page.tsx` L37 → `FitForge Admin`, L70 → `... (default: fitforge-demo)`.
- [ ] **Step 3: Verify** — `grep -rn "elghamdi\|بالغامدي\|belghamdicoaching.com" src/lib/demo/ src/app/admin/` → no matches.
- [ ] **Step 4: Commit** — `git commit -m "rebrand: FitForge demo admin data + chrome"`

### Task 6: Portal demo emails

**Files:**
- Modify: `src/lib/supabase/portal-context.ts` (L48, L54), `src/lib/supabase/portal-onboarding.ts` (L82)

- [ ] **Step 1:** `demo@belghamdicoaching.com` → `demo@fitforgecoaching.com` (replaceAll per file).
- [ ] **Step 2: Verify** — `grep -rn "belghamdicoaching" src/lib/supabase/` → no matches.
- [ ] **Step 3: Commit** — `git commit -m "rebrand: FitForge portal demo emails"`

### Task 7: Auth salt + password fallback (4 files, lockstep)

**Files:**
- Modify: `src/middleware.ts`, `src/app/api/admin/auth/route.ts`, `src/lib/supabase/admin-context.ts`, `src/lib/integrations/server-auth.ts`, `.env.example`

**Interfaces:**
- Produces: identical token scheme `sha256("<password>::fitforge-admin::v1")` in all four files. NOTE: invalidates existing admin sessions — accepted in spec.

- [ ] **Step 1:** In all 4 auth files: `belghamdi-demo` → `fitforge-demo`, `::belghamdi-admin::v1` → `::fitforge-admin::v1`. Update the mirror comment in `server-auth.ts` L17. `.env.example` L13 → `ADMIN_PASSWORD=fitforge-demo`.
- [ ] **Step 2: Verify** — `grep -rn "belghamdi" src/middleware.ts src/app/api/admin/auth/route.ts src/lib/supabase/admin-context.ts src/lib/integrations/server-auth.ts .env.example` → no matches; then `grep -rn "fitforge-admin::v1" src/` → exactly 4 files.
- [ ] **Step 3: Commit** — `git commit -m "rebrand: fitforge-demo auth fallback + token salt (mirrored x4)"`

### Task 8: n8n client User-Agent

**Files:**
- Modify: `src/lib/integrations/n8n-client.ts`

- [ ] **Step 1:** L86 → `"Mozilla/5.0 FitForgeCoaching-Webhook/1.0"`.
- [ ] **Step 2: Verify** — `grep -n "Belghamdi" src/lib/integrations/n8n-client.ts` → no matches.
- [ ] **Step 3: Commit** — `git commit -m "rebrand: FitForge webhook user-agent"`

### Task 9: Generate 9 images (AI, copper-on-dark style)

**Files:**
- Create/overwrite: `public/logo.png`, `public/images/coach-avatar.jpg`, `public/images/coach-cover.jpg`, `public/images/programs/{anterior-x-posterior,arnold-x-u-l,muscle-mommies-4-5-days-splits,full-body-3-days-high-frequency-split,push-pull-leg-x-upper-lower,upper-lower-4-days}.jpg`

- [ ] **Step 1: Logo** — minimalist "FF" monogram fused with a dumbbell, flat vector, copper `#F47B35` on dark charcoal, legible at 40px, no other text → `public/logo.png`.
- [ ] **Step 2: Coach portrait** — fictional athletic male coach, 30s, confident, black tee, arms crossed, dark gym, copper rim light, editorial photography → `public/images/coach-avatar.jpg` (portrait orientation).
- [ ] **Step 3: Coach cover** — same fictional coach, wide 16:9 coaching a client in a dark premium gym, copper accent lighting → `public/images/coach-cover.jpg`.
- [ ] **Step 4: Six program covers** — shared style block (dark charcoal gym, copper `#F47B35` accent lighting, cinematic editorial, no text/logos), distinct subject per program: anterior-x-posterior = symmetric front-facing athlete; arnold-x-u-l = classic golden-era bodybuilding pose; muscle-mommies-…-splits = full-body athlete mid-session; full-body-3-days… = woman training with dumbbells; push-pull-leg-x-upper-lower = dynamic multi-angle lifting composite; upper-lower-4-days = barbell lower-body focus.
- [ ] **Step 5: Verify** — `glob public/images/programs/*.jpg` → 6 files; `Test-Path public/logo.png, public/images/coach-avatar.jpg, public/images/coach-cover.jpg` → all True.
- [ ] **Step 6: Commit** — `git commit -m "assets: FitForge generated logo, coach, and program covers"`

### Task 10: Final sweep + build gate

- [ ] **Step 1: Exhaustive grep** — `grep -rn "elghamdi\|بالغامدي\|belghamdicoaching" src/` → only allowed remainder: `src/lib/checkins.ts` + `src/app/(site)/portal/checkins/[id]/CheckinForm.tsx` comments (n8n repo-path references) and `src/lib/integrations/shopify.ts` (live-mode integration, out of scope). Anything else = fix before continuing.
- [ ] **Step 2: Build** — `npm run build` → completes with no type errors.
- [ ] **Step 3: Commit anything pending / report summary to partner.**
