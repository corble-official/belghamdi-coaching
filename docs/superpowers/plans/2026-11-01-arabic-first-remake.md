# Arabic-First Strict-Brief Remake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remake the public site strictly per `prompt.md` + spec: Arabic-first RTL, restrained graphite/bone/copper tokens, conversion-first IA, 3D demoted to a contained desktop-only explorer, admin kept English/LTR.

**Architecture:** Same Next.js 14 App Router codebase. Tokens and fonts change at the root; homepage sections are rebuilt around two conversion paths; the fixed scroll canvas (`SiteScrollCanvas` rig) is replaced by a bounded canvas owned inside `AnatomyExplorer`; all URLs, data flow (`src/lib/catalog.ts`), demo/live modes, and admin functionality stay as-is.

**Tech Stack:** next/font Google (Noto Kufi Arabic, IBM Plex Sans Arabic), Tailwind logical utilities, client-side i18n toggle (unchanged mechanism), R3F (contained use only).

**Spec:** `docs/superpowers/specs/2026-11-01-arabic-first-remake-design.md` (read both; spec wins on behavior, plan wins on file detail).

## Global Constraints

- No tests exist; **verification = `npx tsc --noEmit` (fast) and `npm run build` (the real gate)**. Visual verification via the Playwright harness pattern: prod build + `next start -p 3109`, screenshots at 375px and 1440px (`--use-angle=swiftshader --enable-unsafe-swiftshader`).
- All business data flows through `src/lib/catalog.ts`; never hardcode products/prices/contact info in components. Silver/Gold coaching prices remain **demo placeholders, labeled demo**.
- All user-facing strings via i18n DICT (`src/lib/i18n.tsx`); new keys must include both `en` and `ar`. Arabic copy: natural Egyptian-market Arabic, no machine-translation tone; verified facts only (no invented promises, ratings, delivery times).
- Currency EGP; never hardcode money strings — always `formatMoney`.
- Demo rows keep `demo: true`; demo content visibly labeled.
- No n8n, no real payments, no new routes, no breaking accent gradients/glow as decoration.
- `prefers-reduced-motion`: reveal/motion wrappers already collapse via globals.css — never remove that block; new motion must not fight it.
- Untracked-by-design files stay untracked: `imagess/`, `.agents/skills/`, `n8n/`, `plans/brief-gap-closure.md`.

## Review Focus

(documented once here; each pinned by the step named in its task)

1. **Arabic money format leaks EN** — a public money call site doesn't pass `lang`, Arabic users see `LE`. → grep check in Task 5 + screenshot in Task 8.
2. **Letter-spacing/uppercase applied to Arabic strings** — breaks Arabic letter joining and reads wrong. → RTL override step in Task 2 drives it; screenshot check in Task 8.
3. **Physical-direction utilities break under RTL** — site sections render mirrored-wrong. → grep check in Task 3; mobile+desktop screenshots in Task 8.
4. **Admin inherits RTL from the root** — admin console mirrored. → dir-scoping step in Task 3; admin route check in Task 7.
5. **WebGL runs on mobile/reduced-motion users** — brief forbids. → capability gate in Task 5; 375px screenshot proves fallback in Task 8.

---

### Task 1: Language + money foundations

**Files:**
- Modify: `src/app/layout.tsx` (fonts + static attrs)
- Modify: `src/lib/i18n.tsx:479` (default lang)
- Modify: `src/lib/utils.ts:23` (formatMoney signature)

**Interfaces:**
- Produces: `formatMoney(amount: number, currency = "EGP", lang: "en" | "ar" = "en"): string` — Arabic renders `ج.م 1,500` (western digits, `ج.م` prefix, en-US grouping); English keeps `LE 1,500`. `Noto_Kufi_Arabic` CSS var `--font-display-ar`, `IBM_Plex_Sans_Arabic` var `--font-body-ar`; `<html lang="ar" dir="rtl">` static.
- Consumes: existing i18n `Lang` type; provider keeps `bc_lang` override behavior (page-order note: 3's admin scoping comes in Task 3).

- [ ] **Step 1:** In `layout.tsx` replace the font block: keep `Space_Grotesk`/`Inter`/`Instrument_Serif` exactly as-is, add `Noto_Kufi_Arabic` (no fixed weight — variable; `subsets: ["arabic"]`) as `--font-display-ar` and `IBM_Plex_Sans_Arabic` (no fixed weight, `subsets: ["arabic"]`) as `--font-body-ar`, both `display: "swap"`. Attach both variables to `<body>`. Change `<html lang="ar" dir="rtl">`. Update `metadata` to Arabic-first: `title: "بلهامدي كوتشينج — برامج تدريب وإشراف شخصي"`, `description: "برامج تدريب جاهزة وإشراف شخصي متابَع أسبوعيًا. تدريب مبني على العلم، تقدّم يقاس."`.
- [ ] **Step 2:** In `i18n.tsx` change `useState<Lang>("en")` → `useState<Lang>("ar")` (line 479). Do not touch the `bc_lang` read or the `documentElement lang/dir` effect (it still lets English users flip to `ltr`).
- [ ] **Step 3:** In `utils.ts` implement the `lang` param exactly per Produces above (first branch handles EGP both langs; other currencies ignore `lang`). Commit message: `feat: arabic-first default language, arabic fonts, locale-aware money`.
- [ ] **Step 4:** Verify: `npx tsc --noEmit` passes (type errors here = call sites unaffected since `lang` is optional, so PASS means safe).

### Task 2: Token system (flat, no glow) + Arabic typography rules

**Files:**
- Modify: `tailwind.config.ts` (color values only)
- Modify: `src/app/globals.css` (components layer + Arabic overrides)

**Interfaces:**
- Produces: tokens `graphite #141311`, `obsidian #1C1A17`, `bone #EAE6DD`, `wgray #9A948A`, `copper #C77F53` (keep token names; `amber` removed from btn-primary usage). CSS classes without gradients: `.btn-primary` = flat `bg-copper text-graphite`, hover `hover:bg-bone`, no translate/glow; `.btn-secondary` unchanged shape, `hover:border-copper`; eyebrow/headings keep names.
- Produces: `html[lang="ar"]` overrides — `.font-display`/`.heading-xl`/`.heading-lg` use `var(--font-display-ar)`; body uses `var(--font-body-ar)`; `.eyebrow`/`.btn-primary`/`.btn-secondary`/`.label-dark`/`.table-head`/`.heading-*` reset `letter-spacing: 0; text-transform: none` (Arabic joins must stay intact; these classes currently use `tracking-[...]`/`uppercase`).
- Produces: body line-height 1.75 in `html[lang="ar"]`; display line-height 1.2.

- [ ] **Step 1:** Edit `tailwind.config.ts` colors to the five hex values above (add `line: "#2A2723"`; leave `amber` token defined for other usages but remove it from `.btn-primary`).
- [ ] **Step 2:** Rewrite `.btn-primary` in globals.css (grammar above), add the `html[lang="ar"]` override block at the end of the components layer. Keep scrollbar/selection rules, keep `prefers-reduced-motion` block, keep `.noise-overlay` (rename thumb hover color `#e8793f` → `#C77F53`).
- [ ] **Step 3:** Verify: `npm run build` green, then screenshot home + one admin page via the harness — expect flat copper buttons, Arabic display font rendering with joined letters. Commit: `feat: flat copper-on-graphite tokens, arabic typography rules`.

### Task 3: Logical-direction audit + admin LTR scoping

**Files:**
- Modify: site components with physical utilities (grep decides the list)
- Modify: `src/app/admin/layout.tsx` (wrapper `dir="ltr"`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `/admin` subtree renders LTR regardless of site language; public site uses logical utilities only.

- [ ] **Step 1:** In `admin/layout.tsx` outer `<div className="min-h-screen bg-graphite flex">` add `dir="ltr"` (attribute, not class). Inside, replace the two physical sidebar translations with logical equivalents (`-translate-x-full` → `-translate-x-0`/state-driven is fine — leave translate as-is because the drawer is LTR-scoped now).
- [ ] **Step 2:** Run this audit and fix every site-side hit to its logical utility (`text-start`/`text-end`, `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, `text-start` for `text-left`):
```
grep -rEn "text-left|text-right|ml-auto|mr-auto|pl-[0-9]|pr-[0-9]|left-0|right-0" src/components/site "src/app/(site)" src/components/ui
```
Fix rule: use the direction meaning the design wants (e.g. `text-left` in a start-aligned hero → `text-start`); do NOT touch admin-side files. Also sweep inline `tracking-[0.3em]`/`uppercase` usages wrapping Arabic-capable `t()` strings in site components and wrap them with the same `html[lang="ar"]` reset pattern in globals.css if they don't use the fixed classes.
- [ ] **Step 3:** Verify: `npm run build` green + harness screenshot of home at 1440px with lang=en toggled: LTR identical layout mirrored correctly (no `arrowDirection` visual check needed at this task). Commit: `refactor: logical direction utilities on public site, admin scoped LTR`.

### Task 4: Homepage rebuild (conversion-first IA)

**Files:**
- Modify: `src/app/(site)/page.tsx`, `src/components/site/Hero.tsx`, `src/components/site/HomeSections.tsx`
- Create: `src/components/site/PathChoice.tsx`

**Interfaces:**
- Produces: section order: Hero → PathChoice → Programs → Coaching → Coach/Method → HowItWorks → Testimonials → Results(transformations) → AnatomyExplorer → FinalCTA. `PathChoice` = no props, two internal panels linking `/programs` + `/coaching`. Hero = typographic, no `Hero3D`, no `#hero-figure` anchor, no scroll-linked transforms; load-in motion only.
- Consumes: `CATALOG`, `useAdminStore` transformations (unchanged), existing i18n keys.
- Produces: new DICT keys (both en+ar): `path_prog_title`, `path_prog_copy`, `path_prog_cta`, `path_coach_title`, `path_coach_copy`, `path_coach_cta`, `coach_title`, `coach_copy`, `coach_ptr_1`, `coach_ptr_2`, `coach_ptr_3`, `cta_meet_coach`; coach section reuse-updated from `about_*` keys (grep `about_` in i18n.tsx, use its accurate facts; do not invent).

- [ ] **Step 1:** Rewrite `Hero.tsx`: kicker (existing `hero_kicker`), new headline key pair `hero_title_ar_first`/see below — use a benefit-stating line, `hero_value_sub`, two CTAs (existing `cta_explore` → `/programs`, `cta_transform` → `/coaching`), facts row of 3 verified items (`formatMoney(field)` from catalog cheapest program + `BUSINESS.whatsapp` label + included-items count). Remove scroll transforms + Hero3D import; keep `#hero-figure`? REMOVE slot div entirely (the figure no longer binds to hero after Task 5). Add the three new keys to DICT.
- [ ] **Step 2:** Create `PathChoice.tsx` with the two panels (tone-distinct: programs panel = copper CTA, coaching panel = bone outline CTA), keys from Produces. Mount directly under Hero in `page.tsx`.
- [ ] **Step 3:** In `page.tsx` keep `ScrollCanvasMount` mounted unchanged (the explorer's figure still needs it until Task 5 pairs with the bounded canvas — deleting it now would silently remove 3D); reorder sections to the Produces order and move the `AnatomyExplorer` section below Results; swap `Philosophy` for a `CoachMethod` block (inside `HomeSections.tsx`, new export) built on `about_*` facts + the new keys.
- [ ] **Step 4:** Verify: build green; harness screenshot home 1440px + 375px — two offers visible first screen mobile, price shown in programs grid without interaction, no 3D in hero. Commit: `feat: conversion-first homepage, choice strip, coach section, typographic hero`.

### Task 5: Contained desktop-only explorer canvas

**Files:**
- Create: `src/components/three/ExplorerCanvas.tsx`
- Modify: `src/components/three/AnatomyExplorer.tsx` (gate + canvas wiring), `src/components/three/MusclesFigure.tsx` (remove `glowFade` coupling if trivial — otherwise hold at 1)
- Delete: `src/components/three/SiteScrollCanvas.tsx`, `src/components/three/ScrollCanvasMount.tsx`, `src/components/three/Hero3D.tsx`

**Interfaces:**
- Consumes: `useMuscleExplorer` (`active/hover`), `MUSCLE_GROUPS` (from `AnatomyFigure.tsx`), `driveMuscleGlow`, `GROUP_YAW`, `BODY_BANDS`, the `public/models/human-muscles.glb` via `useOptimizedGLB` (`glbLoader.ts`).
- Produces: `ExplorerCanvas` — a bounded `<Canvas>` absolutely filling `#muscle-explorer`, camera `{ fov: 30, position: [0, 1.05, 4.8] }`, `AIM = new THREE.Vector3(0.15, 0.95, 0)`; rotation: damp toward `GROUP_YAW[activeRef.current ?? "chest"]` k=3 (same semantics as current MusclesFigure turn); selected-group emissive via existing `driveMuscleGlow` (selection highlight only, constant `glowFade = 1`); `frameloop` gated off by IntersectionObserver when off-screen, and by `document.visibilityState`; no listeners on scroll.
- Produces: mount gate `window.matchMedia("(min-width: 1024px)").matches && webglSupported() && !matchMedia("(prefers-reduced-motion: reduce)").matches` — mobile/reduced-motion gets `HeroFallback` + the existing muscle-group list (information preserved).

- [ ] **Step 1:** Write `ExplorerCanvas.tsx` per Produces (reuse rotation/glow logic from current `MusclesFigure.tsx`/`SiteScrollCanvas.tsx` — no idle spin, no scroll coupling). Keep `AnatomyFigure` list/store contract untouched.
- [ ] **Step 2:** Rewire `AnatomyExplorer.tsx`: replace `HeroFallback` import source `./Hero3D` → `./HeroFallback`; render `ExplorerCanvas` inside the `#muscle-explorer` box under the gate; keep `id="muscle-explorer"` box and list buttons exactly (they drive PROGRAM_FOCUS wiring).
- [ ] **Step 3:** Delete the three named files; grep for orphan imports (`ScrollCanvasMount|SiteScrollCanvas|Hero3D`) and fix any.
- [ ] **Step 4:** Verify: build green; harness scans — desktop 1440px: figure turns on click inside a bounded box, no figure anywhere else on any page (screenshot programs/coaching/admin at scrolled positions: ZERO figure); 375px: fallback box, ZERO canvas elements (`document.querySelectorAll("canvas").length === 0` on home). Commit: `feat: bounded desktop-only explorer canvas, delete scroll rig`.

### Task 6: Commerce pages restyle (programs, product detail, cart, checkout, coaching)

**Files:**
- Modify: `src/components/site/ProductCard.tsx`, `src/components/site/ProductDetailView.tsx`, `src/components/site/AddToCartButton.tsx`
- Modify: `src/app/(site)/programs/page.tsx`, product detail route, `cart/page.tsx`, `checkout/page.tsx`, `coaching/page.tsx`, `selector/page.tsx`

**Interfaces:**
- Consumes: `formatMoney(amount, currency, lang)` — every public money call site now passes `lang` from `useI18n()`; `CATALOG`/`COACHING_PACKAGES` untouched data-wise.
- Produces: demo labels: coaching Silver/Gold cards show a small `demo`-badge line (`coaching_demo_badge` key) near prices in demo mode only (`isDemoMode()`); token-consistent surfaces (no gradients); RTL-correct tables (`table-head` reset from Task 2 covers).

- [ ] **Step 1:** Sweep the five route groups + shared components listed above: (a) pass `lang` to every `formatMoney` call, (b) replace physical utilities flagged by the Task 3 grep pattern in these files, (c) restyle card/table shells to token classes only (no visual invention inside data).
- [ ] **Step 2:** Add the demo badge to coaching package cards and the Silver/Gold comparison block (both homepage-coaching section and `/coaching` page) gated by `isDemoMode()`.
- [ ] **Step 3:** Verify: build green + grep check `rg`-equivalent: `grep -rn "formatMoney(" src/app "src/components/site" src/lib/cart.ts | grep -v "lang" | grep -v "utils.ts"` → zero hits calling without `lang` in public surfaces (admin call sites keep default `en` → `LE`, allowed). Harness screenshots at 375px: programs list, product page, cart, checkout — no overflow, prices show `ج.م` in Arabic mode. Commit: `feat: commerce pages restyled, arabic money labels, demo badges`.

### Task 7: Trust/aux pages restyle (about, transformations, faq, contact, login) + SEO metadata

**Files:**
- Modify: `src/app/(site)/about/page.tsx`, `transformations/page.tsx`, `faq/page.tsx`, `contact/page.tsx`, `login/page.tsx`
- Modify: `src/app/layout.tsx` metadata already Arabic-first from Task 1 — leave.

**Interfaces:**
- Consumes: token classes, `BUSINESS` (socials/WhatsApp/email), testimonial demo data via `useAdminStore` (unchanged contracts).
- Produces: no new routes; no dead nav items — nav LINKS list already matches these routes; contact page form flows unchanged.

- [ ] **Step 1:** Restyle the five pages to token system + logical utilities (same rules as Task 6 Step 1a/1b), no content changes beyond verified facts already present; demo-labeled testimonials keep their labels.
- [ ] **Step 2:** Verify: build green; toggle EN spot-check one page (about) — LTR renders correctly with Space Grotesk/Inter; admin `/admin` overview screenshot stays LTR-English with copper accents. Commit: `feat: trust pages restyled, admin token pass confirmed LTR`.

### Task 8: Final QA sweep (the brief's acceptance checks)

**Files:** none created; fixes only where sweep finds issues.

- [ ] **Step 1:** Screenshot matrix from the harness: home 1440/375, programs 1440/375, product, coaching 1440/375, about, faq, contact, cart, checkout, confirm — plus home explorer desktop pair (default + clicked Quads). Verify: both offers readable on mobile first screen; prices visible (`ج.م` in Arabic); explorer absent on mobile (`document.querySelectorAll("canvas").length === 0`); no console/server log errors.
- [ ] **Step 2:** Fix any findings (styled as one-line fixes); re-run build.
- [ ] **Step 3:** Commit fixes if any: `fix: QA sweep findings for arabic-first remake` (or skip commit if clean, noting so in the task report).

## Self-review record

- Coverage check: spec §Design system → T1+T2; §Site structure changes (removals/contained 3D) → T4+T5; §IA/homepage order → T4; §commerce pages → T6; §trust pages + admin → T7; §acceptance/mobile → T8; SEO → T1 metadata + T8; §builder-check resolutions → T3 (admin LTR), T6 (money/demolabels), T7 (aux pages fate). No gaps found.
- Step scan: every step names exact files/symbols/values or one grep command; no TBD lines.
- Type consistency: `formatMoney(amount, currency, lang)` used identically in T1 Produces and T6; `ExplorerCanvas` consumes exactly the symbols T5 lists.
- Review Focus: five items mapped (see bracketed owners above).
- Proportion: plan only encodes decisions; no component bodies beyond signatures/values.
