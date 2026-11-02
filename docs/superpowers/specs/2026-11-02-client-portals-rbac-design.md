# Design — Client Portals, Roles & Client Data Isolation
**Project:** Belghamdi Coaching Phase 3 (post Phase 2 n8n integration, complete & verified)
**Date:** 2026-11-02
**Status:** Approved by client (decision sheet below)

---

## Intent and why

Extend the existing Phase 2 integration (website ⇄ n8n workflows BC-02/03/06/07, all live and
HMAC-guarded; dashboard Automation Center shows health/outbox/retry) into a full client-facing
portal system and RBAC-protected coach dashboard. The guiding business rule:

> **Subscription-Driven Access & Client Data Isolation** (verbatim from the client, mandatory)

All client-facing workflow portals respect active subscriptions and entitlements. Weekly
check-ins, monthly reviews, coach chat and follow-up features exist only for clients with an
active Follow-up subscription. Client accounts are strictly isolated — a client can never read
or modify another client's data, even via direct API calls. Subscription expiry restricts
*new* access but never deletes history; renewal restores the same profile.

## Goals

1. Phase 3a — **Roles + RLS**: profiles/roles; per-client RLS enforced in Postgres.
2. Phase 3b — **CRM linking**: admin dashboard reads real Supabase rows (leads/clients/
   subscriptions/tasks) instead of demo rows; demo rows remain available/flagged.
3. Phase 3c — **Client portals**: one portal per workflow:
   - BC-03 → Onboarding portal (native site page; replaces n8n-hosted form HTML)
   - BC-06 → Follow-up portal: coach chat tunnel + weekly/monthly check-ins + entitlement gating
   - BC-07 → Renewal hub (subscription status; renewal triggers BC-07 same as today)
   - BC-99 → error/monitoring view inside dashboard
4. Phase 3d — **Notifications center**: dashboard notification list backed by Supabase
   (`sales_notifications` exists), replacing raw Telegram for production alerts (Telegram kept
   as testing channel; never modify bot literals).

## Non-goals

- No real payments anywhere in our stack; purchase/payment verification stays Shopify-owned.
- Do not rebuild or restructure the existing 8 n8n workflows; only endpoint behavior adjustments
  where the flow changes (BC-03's form/web route becomes the site portal feeding the same tables).
- No new Telegram integrations; existing bot literals and chat IDs stay untouched.
- No redesign of the admin dashboard visual language.

## Customer journey (decided)

```text
CUSTOMER → SELECT PRODUCT
  Training Program (6, one-time): Checkout → Verify payment → Deliver program. No account.
  Silver/Gold (Follow-up):        Checkout → Verify payment (Shopify confirmation REQUIRED —
                                  never activate from a redirect)
                                  → Create/reuse client profile + auth account (never duplicate
                                    on renewal) → Send invitation → Client login →
                                  BC-03 onboarding portal → Coach notify → Follow-up portal
  Follow-up Renewal:              Existing account → BC-07 → restore access, no new profile
```

Architecture separation (decided): **Purchase ≠ Identity ≠ Entitlements.**

Onboarding state machine: `pending → submitted → reviewed`. Incomplete onboarding keeps the
account and subscription records but onboarding stays `pending`.

## Entitlement matrix (decided, verbatim client table)

| Feature              | Follow-up Active | Follow-up Inactive          |
| -------------------- | ---------------- | --------------------------- |
| Coach chat           | Available        | Unavailable                 |
| Weekly check-ins     | Available        | Unavailable                 |
| Monthly reviews      | Available        | Unavailable                 |
| Progress submissions | Available        | Unavailable                 |
| Check-in history     | Available        | Read-only historical access |
| Coach feedback       | Available        | Historical feedback only    |

## Roles (decided)

| Role            | Client profiles      | Client data | Administration      |
| --------------- | -------------------- | ----------- | ------------------- |
| Admin           | All clients          | Full        | Full control        |
| Coach           | All assigned clients | Full        | Coaching management |
| Coach Assistant | Assigned coach's clients | Full    | Coaching assistance |
| Client          | Own profile only     | Own data    | None                |

Assistant permissions stored as a JSON capabilities column so payment/subscription/admin
restrictions can be added later without schema changes.

## Database changes (Supabase, public schema)

Existing (already in prod): `clients`, `client_subscriptions`, `leads`, `onboarding_requests`,
`onboarding_submissions`, `checkin_requests`, `checkin_submissions`, `follow_up_tasks`,
`chat_conversations`, `chat_messages`, `communication_logs`, `sales_notifications`,
`automation_errors`.

New:
- `profiles` — one per auth identity. Columns: `id uuid PK = auth.users.id`,
  `role text CHECK IN ('admin','coach','coach_assistant','client')`, `email`, `full_name`,
  `client_id uuid NULL → clients.id` (for role='client'), `coach_id uuid NULL`,
  `capabilities jsonb` (assistants), `created_at`, `updated_at`.
- `coach_clients` — coach/assistant↔client assignments (`profile_id`, `client_id`).
- `checkin_reviews` — coach feedback + approval per `checkin_submissions.id`
  (`reviewer_profile_id`, `status`, `feedback`, created/updated).
- Multimedia helpers on existing tables: `checkin_requests.cadence` is implied by `period_label`
  (weekly/monthly labels); chat tables gain `source text` ('telegram'|'web'); client identity
  for portal chat joins `profiles.client_id` (UNIQUE NOT NULL) — `profiles` is the single
  authority for the identity↔client mapping; no mirrored column on `clients`.

### RLS (mandatory, at the database level)

1. Enable RLS on ALL tables (10 currently disabled — advisory flagged).
2. Policies:
   - client: SELECT/INSERT own rows only (own client_id via `profiles.client_id`), on
     checkin/submission/chat tables; SELECT own profile; no cross-client access by any means.
   - coach/assistant: SELECT+manage rows of clients assigned via `coach_clients`
     (assistant inherits coach's assignments; capability column can narrow binds).
   - admin: full.
   - Service role (n8n REST inserts) unaffected — n8n uses service key, bypasses RLS.
3. Helper functions (`is_admin()`, `is_coach_of(uuid)`, `owns_client(uuid)`) marked
   `security definer`, `STABLE`, `search_path = public, pg_temp` (hardened with
   `SET search_path`).

## Application surfaces (Next.js 14 App Router)

### Public site
- `/login-client` style route under `(site)` Arabic-first RTL: Supabase Auth sign-in
  (email OTP primary), portal entry point.
- `/portal` (client portal shell, LTR-consistent tokens, Arabic content):
  - `/portal` hub — greeting, subscription status banner (Active / Expired / Onboarding pending),
    entitlement-gated cards.
  - `/portal/onboarding` — native BC-03 form → same `onboarding_requests/submissions` data path.
  - `/portal/follow-up` — chat tunnel with coach (new messages via API, message history both
    sources), check-in scheduler (weekly/monthly list from `checkin_requests`).
  - `/portal/checkins/[request_id]` — check-in form (weight, measurements JSON, training days
    made, workout/nutrition %, energy, sleep, difficulties, filters, feedback, photos).
  - `/portal/progress` — history: measurements chart-lite, past submissions + coach feedback
    (read-only when expired).
  - `/portal/renewal` — BC-07 hub: subscription status ordered from `client_subscriptions`;
    renewal button hits existing `/api/renew` (BC-07).
- Entitlement gating enforced in middleware + API routes + RLS triples (defense in depth).
- Training program pages untouched.

### Coach dashboard (admin)
New/refined sections mirroring the client's specified tree:
- Overview (totals: clients, active subs, pending check-ins, unread messages)
- Clients (All / Active / Inactive / Expired) — real Supabase rows, profile drawer with:
  personal info, onboarding data, goals, subscription, weekly history, monthly reports,
  measurements history, progress photos, conversations, coach feedback, payment history
  (Shopify when live; demo placeholders flagged `demo: true`), activity history.
- Follow-up Management (Weekly / Monthly / Pending reviews) — approve/feedback via
  `checkin_reviews`.
- Conversations — unified `chat_messages` (telegram+web) per client; reply as coach.
- Subscriptions — status management incl. manual override (admin/coach).
- Notifications — `sales_notifications`-backed feed + future target for BC workflow alerts.
- Automation center (existing) + BC-99 errors view (`automation_errors` deduped list).

### API routes (all server-side, auth-checked, RLS-enforcing)
- `/api/portal/*` (profile, messages, checkins list/detail/submit, onboarding status/submit,
  renewal)
- `/api/admin/clients/*`, `/api/admin/conversations`, `/api/admin/checkin-review`
- Existing `/api/automation/*`, leads, tasks, renew stay.

## n8n endpoint behavior changes (minimal, additive only)

- BC-03: notification to coach includes portal URL instead of Telegram form link for **new**
  clients created after cutover; the legacy Telegram 5-day-link path remains for old
  `onboarding_requests` (guard by `source` column).
- BC-06: upsert/complete results unchanged; coach chat replies may be written via
  `chat_messages` (source web) so the portal shows them; Telegram stays for coaching DMs.
- BC-07: unchanged behavior; portal renewal route hits the same signed `/webhook/bc07-renewal-event`.
- BC-99: unchanged; dashboard reads `automation_errors`.

## Constraints

- TypeScript strict; verify with `npx tsc --noEmit` + `npm run build` (+ Playwright smoke for
  portal flows). No test suite exists.
- Arabic-first RTL for public/portal; admin dashboard LTR (existing convention).
- i18n via `src/lib/i18n.tsx` dictionary — every portal string goes through it.
- Demo mode: all Supabase/Shopify envs absent → demo data (`demo: true`) everywhere; the same
  portal pages must render gracefully in demo (demo client, fake entitlements) without hitting
  Supabase Auth.
- OneDrive path quirks: watch for file-lock EPERM during builds (kill dev server first).
- Currency EGP via `formatMoney()`.

## Approaches considered (decision record)

1. **Chosen: Supabase Auth (`profiles` == auth.users) + email OTP invite, plus secure-token
   portal-link fallback for invitations** — real isolation via RLS keyed on auth id; persistent
   identity, satisfies renewal-no-new-profile. Token links alone (rejected as primary): expiring
   links, no hard per-client RLS binding; chat history ownership ambiguous.
2. **Chosen: entitlement gating at 3 layers** (middleware + API routes + RLS/view-level) vs UI
   only — client explicitly demanded DB-level enforcement.
3. **Chosen: keep Telegram as coach-channel** (chat mirrored into unified thread) vs replacing
   coach comms entirely — respects the "never modify Telegram" rule and eases transition.
4. Rejected: building portals as more n8n-served HTML (current onboarding page) — spec demands
   native site + tight i18n + RLS session context; n8n pages can't enforce roles.

## Left to the builder

- Exact styling of portal pages consistent with existing `Reveal`/btn tokens.
- Chat polling/SSE choice (simple polling first).
- Measurement chart approach (no chart lib unless trivially justified).
- Error-state and empty-state copy (via i18n dictionary).
- Migration ordering & rollback (SQL script(s) committed; activate RLS last with policies
  ready so n8n service-role path is verified before/after).
- Demo-mode simulation of auth (fake session cookie) — keep every demo path flagged.

## Frozen decisions (client-approved 2026-11-02)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Auth identity | Email REQUIRED for Silver/Gold checkout (Shopify billing email). Missing email → pending client/order record + coach notified to collect it; no incomplete auth identity. Phone/WhatsApp = contact channels, never account identity. |
| 2 | Email delivery | Resend on `belghamdicoaching.com` (SPF/DKIM/DMARC), Supabase Auth integration; email OTP primary, password optional. SMS/WhatsApp secondary notification channel. **No domain configured in demo** — demo never sends mail. |
| 3 | Refund/cancel | Normal expiry → access until expiry date. Cancellation → until paid period ends. Full refund → revoke immediately. Partial refund → admin review. Dispute/chargeback → suspend pending review. Successful renewal → restore access. Never delete historical data. |
| 4 | Manual unlock | **Admin only** (activate/suspend/extend/revoke). Coach = view-only + may request override. Assistant cannot modify entitlements. Coaching permissions never bypass payment verification. |
| 5 | Payment history | Client sees own orders/amounts/dates/status/products/renewals. Coach sees own clients'. Admin global. No gateway credentials ever. Shopify remains source of truth. |
| 6 | Progress photos | Real **private Supabase Storage** bucket, authenticated uploads, strict client ownership, coach/assistant access, temporary signed URLs, optional with client consent, no public URLs. Paste-URL removed from v1. |
| 7 | Coach Assistant | DB schema + RLS inheritance built **now**; interface ships later (Admin/Coach/Client only in Phase 3). |

**Constraints preserved:** Shopify is the source of truth for customer/order/payment data — Supabase
holds identities, coaching data and entitlements synced from verified Shopify events. No automated
recurring billing or real payment processing in scope; architecture supports subscription records
and renewal workflows without pretending integrations exist.

## Builder-check resolutions (minor calls, made)

- `@supabase/supabase-js` + `@supabase/ssr` added as dependencies (package.json currently lacks them).
- Single login page: the existing stub `src/app/(site)/login/page.tsx` is replaced with real
  Auth OTP sign-in; no separate `/login-client` route.
- Middleware does only unauthenticated-redirect; entitlement checks live in server components,
  API routes, and RLS (Edge middleware cannot validate Supabase JWTs cheaply).
- Assignments live **only** in `coach_clients` (single truth source for `is_coach_of()`); no
  `profiles.coach_id`.
- "Progress submissions" = `checkin_submissions` row (no new table).
- `profiles.client_id` is UNIQUE NOT NULL; `profiles` is the authority (no `clients.profiles_id`).
- Migration order: create tables/helpers → policies with RLS OFF→ON last, service-role n8n path
  verified before and after.
- Signups disabled in Supabase Auth settings (provisioning only via verified payment / admin).
-Redirect-based activation is never trusted; the verified event (`bc03-order-event`) is the only
  activation trigger — awaiting pages may only poll for verified status.
- `X-BC-Environment` stays `"demo"` until live mode exists (out of scope).

## Explicit security mitigations

- RLS on every table; portal API routes call PostgREST with the client's JWT (not service role)
  except admin aggregate lists (service role behind `isAdminRequest()`).
- Invited-then-expired token links cannot list other clients.
- Progress photos via private Supabase Storage only (per decision #6) — no public URLs, no
  paste-URL; temporary signed URLs for viewing.
