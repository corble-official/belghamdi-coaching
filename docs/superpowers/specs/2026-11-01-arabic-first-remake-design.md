# Belghamdi Coaching — Arabic-First Remake Design

Date: 2026-11-01
Source brief: `prompt.md` (authoritative, overrides earlier concepts)
Status: awaiting client approval

## Intent and why

`prompt.md` redefines the project: a conversion-first, mobile-first business platform for the Egyptian fitness market with two distinct customer journeys (ready-made training programs / personalized coaching). The current site was built from an earlier concept: cinematic English homepage with a prominent scroll-choreographed 3D anatomy figure, constant glow effects, and a big-display editorial look. The brief explicitly rejects the 3D-forward, glow-heavy approach (§5, §3 "Avoid"), and the client has confirmed: remake strictly per the brief, and **Arabic is the first language** (new constraint, not in the brief's emphasis).

The remake restructures the public website around the brief's IA and visual language, demotes 3D to a contained optional explorer, and makes Arabic/RTL the designed-first experience. Business/admin/commerce architecture (catalog data, demo/live modes, admin CRM, checkout handoff) is already brief-aligned and is preserved, not rebuilt.

## Goals

- First-time visitor understands the two offers in seconds, in Arabic first.
- Program price, contents, and purchase CTA reachable with minimal scroll/steps on mobile.
- Coaching path builds verified trust and drives contact/apply.
- Distinctive restrained identity: deep graphite / bone / copper, Arabic-first editorial typography.
- Strong performance on mid-range phones and slow networks (brief §4 acceptance).
- Zero invented business claims; demo content always labeled.

## Non-goals

- No n8n automation, no real payments, no new commerce gateway (all delegated to Shopify when live).
- No admin CRM redesign (already built; only visual-token updates along with the site).
- No new feature pages (program finder stays out unless shown useful later — brief makes it optional; the existing selector page stays as it serves discovery).

## Anti-goals (failure states)

- Looking like a generic gym template, a default Shopify theme, or a 3D showcase.
- Glow/neon overload, scroll hijacking, constant GPU rendering.
- Invented prices, testimonials, ratings, coach imagery, or client identities.

## Constraints

1. Stack unchanged: Next.js 14 App Router, TypeScript, Tailwind, Zustand, R3F (contained use only), Supabase/Shopify integrations unchanged.
2. All real business/product data flows through `src/lib/catalog.ts` (`CLIENT_DATA.md` rules); Silver/Gold coaching prices remain demo placeholders labeled demo.
3. EN/AR comes from the existing language context (`src/lib/i18n.tsx`); mechanism kept, defaults reversed to Arabic.
4. Currency fixed EGP via `formatMoney()`; no recurring-billing assumptions.
5. `CLIENT_DATA.md`, AGENTS.md conventions, and demo-mode flagging (`demo: true`) must be preserved.

## Approaches considered (per §5 — 3D)

1. **Strict brief default:** remove all 3D/GLB use; replace with 2D anatomy illustrations and photography. Cleanest perf story, but discards the client's heavily polished 3D asset (many rounds of interactive tuning in recent sessions).
2. **Contained explorer (chosen):** keep the optimized GLB as a small, optional, desktop-only, detached-from-scroll interactive explorer inside the anatomy education section; static/list fallback everywhere else. Justifies 3D with a real "understand your body / pick a muscle group" purpose per brief §5 "lightweight optional interactive muscle explorer", in line with the existing `AnatomyExplorer` component.
3. **Keep current 3D-forward homepage.** Rejected — direct conflict with brief §5 and the client's instruction.

Trade-off accepted in (2): a small JS/WebGL cost on desktop users who reach the explorer section, mitigated by dynamic import, off-screen pause, `prefers-reduced-motion`, and a static fallback; mobile never initializes WebGL and gets the fallback representation.

## Decided (client calls)

- Follow the brief strictly; Arabic-first; remake public site per IA §6.
- 3D kept only as the contained explorer (Approach 2) — client previously invested in and approved this asset; brief permits it in this contained form.
- No real photography exists in the current repo: hero and results use verified text/data composition and clearly labeled demo placeholders instead of fabricating coach/client imagery (brief §6B/§G rules). Photography slots are marked for the client to supply later.

## Design system

### Color (brief §3 pinned direction; restrained usage)

- `graphite` `#141311` — page background (warm near-black, flatter than current)
- `surface` `#1C1A17` — tonal cards/surfaces (no heavy borders; separation by tone)
- `line` `#2A2723` — hairlines only where structure needs them
- `bone` `#EAE6DD` — primary text
- `muted` `#9A948A` — secondary text
- `copper` `#C77F53` — single accent: prices, active states, one CTA family; flat color, **no glow, no gradients on accents**

Removes: the current ember/amber glow layer, gradient.btns, emissive-pulse styling, and the fixed canvas rim lighting. Copper is the only accent; ember palette tokens get renamed/consolidated to the set above.

### Typography (Arabic-first identity)

- **Display:** Noto Kufi Arabic (700/800) — geometric kufi reads "scientific/confident"; used for headlines, nav brand, prices.
- **Body:** IBM Plex Sans Arabic (400/500/600) — highest-readability Arabic UI face; used for body, controls, forms.
- Latin fallback in the same two roles: keep the current display/mono Latin faces for `lang=en` so EN pages stay composed, but hierarchy mirrors the Arabic system.
- Arabic-first details: `dir="rtl"` as default document direction (`lang="ar"`), logical CSS properties (`ms-/me-`/`text-start`) instead of left/right, line-height tuned for Arabic (display ~1.2, body ~1.75), no letter-spacing on Arabic (only on Latin caps labels), Western digits with `ج.م` from `formatMoney`.
- Body measure < 80 chars; prices and package data get a clear tabular hierarchy.

### Layout concept

Mobile-first composition, RTL mirrored for LTR. Right-aligned (start-aligned) hero and content hierarchy. One bold element per page region; quiet surroundings.

```
Header (sticky, logo + mixed EN/AR brand + 3 nav links + lang toggle + cart + primary CTA)
HERO (start-aligned): Arabic display headline stating the offer plainly
  [برامج تدريب جاهزة واحدة + إشراف شخصي متابَع أسبوعيًا]
  sub-line with verified facts + two CTAs side by side (Explore Programs / Start Coaching)
CHOICE STRIP: two distinct panels — programs vs coaching — labeled for a first-time visitor
PROGRAMS PREVIEW: real catalog grid (6 products, name/level/price/مشمولات + CTA)
COACHING PREVIEW: service explanation + Silver/Gold (demo-labeled) with real-difference comparison
COACH/METHOD: verified bio facts + approach (planning, review, adjustment, consistency)
RESULTS: verified/demo-labeled transformations grid (placeholder-labeled in demo)
HOW IT WORKS: two short journey columns (program vs coaching)
TESTIMONY: approved/demo-labeled only
FAQ + FINAL CTA (two CTAs) + FOOTER (verified contacts/socials/policies)
```

The anatomy explorer becomes a **contained slot inside the coach/method or results area on desktop ≥1024px**, replaced on mobile/reduced-motion/webgl-fail by its static 2D list equivalent. It never appears before the main offers.

## Site structure changes

- `src/app/(site)` sections remade in the above order (existing page routes and URLs preserved: programs, coaching, cart, checkout, faq, contact, selector — no dead nav items).
- **Removed:** fixed `SiteScrollCanvas` mount, hero 3D figure, scroll choreography (`SiteScrollCanvas.tsx` scroll rig), constant muscle-glow styling, hero-figure anchor.
- **Kept and contained:** `MusclesFigure` GLB + `AnatomyExplorer` — becomes the only WebGL surface, desktop-only enrollment (media query + capability check), dynamic-gated activation on scroll proximity, paused when off-screen/hidden; selection still turns the figure (damped), no idle spin, no glow dependence; `prefers-reduced-motion` → static.
- Admin dashboard: token-only refresh (copper accent, no glow), zero functional change.
- SEO/metadata: Arabic-first titles/descriptions/canonicals; EN mirrors on `/en` composition.

## What remains to the builder (explicitly open)

- Exact Arabic copywriting per section (verified facts only; demo labels where placeholders) — draft in implementation, flagged for client review.
- Which existing components are rebuilt vs restyled, decided at plan time by inspecting each one's current cost.
- Fallback 2D explorer design (list-cards vs illustration), settled while building that section.
- Testimonial/transformations demo content (labeled, non-real).
- performance measurement before/after (Lighthouse) — verify, don't claim.

## Acceptance (per brief §18)

- Mobile 375px: no overflow, thumb CTAs, prices visible without interaction, explorer fallback intact.
- Desktop: offer clarity before any 3D; 3D never blocks scroll or content.
- `npm run build` green; all routes tested; no dead buttons; demo data labeled; no console errors.
