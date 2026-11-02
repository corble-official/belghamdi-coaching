# Phase 3 — Client Portals, RBAC & CRM Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the client portal system (onboarding, follow-up chat/check-ins, renewal) over Supabase Auth with database-enforced client isolation and role-based coach dashboard.

**Architecture:** Supabase Auth (email OTP, Resend-ready, no sending domain in demo) with `profiles` keyed to `auth.users.id`; RLS on every table with client isolation via `profiles.client_id` and coach/assistant inheritance via `coach_clients` + `coach_assistants`. Portal pages live under `(site)` (Arabic RTL), coach views live in the existing `/admin` (LTR). Entitlements (decision #3 lifecycle) gate messages/check-ins at API + RLS layers via a single source of truth, `computeEntitlements()`. Demo mode (`isDemoMode()`) is a strict sandbox: zero Supabase/PostgREST/Storage/network-auth calls, simulated session, simulated data.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Zustand, Supabase (Auth, RLS, Storage), n8n GA webhooks (BC-02/03/06/07, signed).

**Spec:** `docs/superpowers/specs/2026-11-02-client-portals-rbac-design.md` (read before any task)

## Global Constraints

- **No test framework exists.** Every task's "verification" = `npx tsc --noEmit` AND the task's own check (SQL query, Playwright probe, or build). NEVER run `npm run build` while dev server is on port 3000 (kill first: `Get-NetTCPConnection -LocalPort 3000 … | Stop-Process`).
- Every user-facing string goes through `src/lib/i18n.tsx` dictionary (Arabic-first; admin stays LTR via existing `dir="ltr"`).
- Currency EGP via `formatMoney()` from `src/lib/utils.ts`.
- Demo data rows keep `demo: true`.
- **Service-role vs user-JWT table (binding):**

  | Operation | Client |
  |---|---|
  | Client reads own profile / onboarding / messages / check-ins / payments | **User JWT** |
  | Client submits onboarding / messages / check-ins / photos | **User JWT** (Storage RLS) |
  | Coach reads/reviews assigned clients' data | **User JWT** (coach RLS policies) |
  | Admin aggregates + admin mutations | Service role **after** server-side role check (`isAdminRequest()`) |
  | Shopify webhook provisioning (order events) | Service role |
  | n8n trusted integrations (BC-02…BC-99) | Service role |
  | Signed photo URL generation | Service role **after** ownership/role validation |

  The service-role key lives only inside `src/lib/supabase/supabase-service.ts` (server-only, `import "server-only"`). No portal-facing route may import it.
- Never modify Telegram literals/chat IDs. **`automation_errors` is read-only from app code** — resolutions go to the new `automation_error_resolutions` table.
- **Renewal never activates entitlements.** A renewal click = renewal *request* (BC-07 reminders/communications). Only a **verified Shopify payment event** extends/restores a subscription.
- Supabase project ref `mqbyjshkocnkxfqoypyj`; migrations applied via the Supabase MCP `execute_sql`, and each SQL batch is also committed under `supabase/migrations/`.
- `X-BC-Environment` stays `"demo"` until live mode exists (out of scope).

## Step 0 — Pre-work inspection (MANDATORY before Task 1)

Before writing any code or SQL, inventory what exists and record reconciliation notes in the plan file (append a "Reconciliation log" section at the bottom). Purpose: **preserve existing functionality; never recreate or duplicate.**

- [ ] 0.1 Supabase: dump full schema of public tables (`clients`, `client_subscriptions`, `leads`, `onboarding_requests`, `onboarding_submissions`, `checkin_requests`, `checkin_submissions`, `follow_up_tasks`, `chat_conversations`, `chat_messages`, `communication_logs`, `sales_notifications`, `automation_errors`) — columns, types, constraints, existing RLS state (10 tables flagged RLS-disabled), existing policies, existing RPCs (e.g. `upsert_lead()`), triggers.
- [ ] 0.2 n8n: read BC-03 (`aPt7y8swl0aq3Mka`), BC-06 (`4w7DX62b6wCOpPiI`), BC-07 (`hE3RuIkr82XHZqmA`), BC-99 (`dkzI3KyB8ygSWGus`) node-by-node; note exactly which tables/columns each writes, which Telegram nodes/literals fire, so portal changes stay additive. **Do not unpublish or modify any production workflow without explicit user authorization.**
- [ ] 0.3 App: confirm current(`/api/orders/verify`, `/api/renew`, `/api/leads`, `/api/tasks/complete`) payloads + `src/lib/integrations/contracts.ts` event names; the new provisioning task reuses these, it does not fork them.
- [ ] 0.4 Reconcile: for each planned new table in Tasks 2/2.5/10, verify it does not already exist under another name (e.g. does `checkin_reviews`, `subscription_events`, `profiles`, `notifications`, `automation_error_resolutions`, `coach_assistants` exist in any form?) — merge instead of duplicate.
- [ ] 0.5 Commit reconciliation log (`docs: phase 3 reconciliation log`) before Task 1 begins.

## Review Focus

1. **Cross-client leakage via API** — client calling another client's `checkin_submissions`/`chat_messages` id must 404/empty, never 200. → Task 6 probe with two sessions.
2. **Entitlement expiry bypass** — request after `end_date`/refund must fail at API layer too, not just UI. → Task 8 probe with expired subscription row.
3. **Demo mode touching Supabase** — with envs unset, no portal/admin route may call Auth/PostgREST/Storage/network auth (simulated session + data only). → Tasks 3/4 + final Playwright run with envs cleared.
4. **RLS blocks n8n** — service-key operations (BC-02 lead insert, BC-03/06/07 webhook paths) must still work after RLS ON. → Task 2 signed probe re-run.
5. **Self-escalation** — authenticated client cannot change own `role`, `client_id`, or `capabilities` via any UPDATE. → Task 2 probe.
6. **Renewal ≠ activation** — `/api/portal/renewal` POST must NOT touch `client_subscriptions.status`/entitlements; only records request + fires BC-07 comms. → Task 9 probe.
7. **Photos privacy + paths** — object paths (not UUIDs) stored in `photos`; no object reachable without session; signed URL only for owner/coach, ownership validated, file type/size validated. → Task 8 probes.

---

## File Structure (responsibility map)

```
src/lib/supabase/
  supabase-service.ts   ← service-role client (server-only); admin aggregates + provisioning + signed URLs
  supabase-auth.ts      ← anon/server client factory for portal (user-JWT via cookie session)
  portal-context.ts     ← getPortalContext(): { profile, client, entitlements, gates } — uses USER JWT everywhere
  entitlements.ts       ← computeEntitlements(): single source of truth for UI + API + dashboard
  lifecycle.ts          ← resolveLifecycle(subEvent): frozen decision #3 lifecycle, consumed by computeEntitlements
supabase/migrations/
  001_rbac.sql          ← profiles, coach_clients, coach_assistants, checkin_reviews, subscription_events,
                          helpers (is_admin/is_coach_of/owns_client/has_followup_client_access),
                          policies incl. profiles self-escalation guard
  002_storage.sql       ← private buckets + owner-prefix storage policies
  003_columns.sql       ← chat tables source column, notifications, automation_error_resolutions, minor ALTERs
  004_provisioning.sql  ← shopify_customers link columns/indexes, invitation tracking
src/lib/provisioning/
  provision-client.ts   ← order event → find-or-create client → auth identity → profile → invite (idempotent)
  invite.ts             ← invitation state machine + Resend/Supabase invite send + retry tracking
src/app/(site)/login/page.tsx        ← REAL Supabase OTP sign-in (replaces stub)
src/app/(site)/auth/callback/route.ts← auth code/OTP exchange
src/app/(site)/portal/
  layout.tsx / page.tsx          ← shell + hub (greeting, subscription banner, gated cards)
  onboarding/page.tsx            ← BC-03 native form
  follow-up/page.tsx             ← chat tunnel + open check-ins
  checkins/[id]/page.tsx         ← check-in form + photo upload
  progress/page.tsx              ← history + coach feedback (read-only when expired)
  renewal/page.tsx               ← subscription + own payment history + renew REQUEST CTA
src/app/api/portal/
  me/route.ts                    ← profile + entitlements (user JWT)
  onboarding/route.ts            ← GET state / POST submit (user JWT)
  messages/route.ts, messages/send/route.ts (user JWT)
  checkins/route.ts, checkins/submit/route.ts (user JWT; Storage upload via owner-prefixed policy)
  renewal/route.ts               ← GET own sub+orders / POST renewal REQUEST → BC-07 only (user JWT)
src/app/api/webhooks/
  bc03-order/route.ts            ← enhanced existing verified-event path → provisioning/service role
src/app/admin/
  layout.tsx                     ← role-aware nav (legacy `bc_admin` login ⇒ admin role)
  clients/page.tsx, clients/[id]/page.tsx, subscriptions/page.tsx, conversations/page.tsx,
  tasks/page.tsx, notifications/page.tsx
  automation/errors/page.tsx     ← BC-99 read-only view + resolution (separate table)
src/app/api/admin/               ← clients(+[id]), conversations, tasks/review, subscriptions override (admin only, role-checked, then service role)
Supabase Auth emails            ← Resend hook configured at CUTOVER ONLY (no domain in demo)
```

---

### Task 1: Foundation — dependencies, Supabase clients, entitlements single source of truth

**Files:**
- Modify: `package.json` (add `@supabase/supabase-js`, `@supabase/ssr`)
- Create: `src/lib/supabase/supabase-service.ts`, `src/lib/supabase/supabase-auth.ts`, `src/lib/supabase/entitlements.ts`, `src/lib/supabase/lifecycle.ts`, `src/lib/supabase/portal-context.ts`
- Modify: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

**Interfaces (Produces):**
- `createPortalClient()` — cookie-session-aware client acting as the **user JWT** (used by ALL portal routes).
- `createServiceClient()` — server-only service client (admin/provisioning/signed URLs only).
- `computeEntitlements(sub: SubscriptionState | null, today): Entitlements` — the 6-feature matrix. **The only entitlement logic in the app**: consumed by portal UI, portal APIs, admin dashboard, and mirrored in RLS via the `has_followup_client_access()` helper implementing the identical lifecycle (test parity explicitly).
- `resolveLifecycle(subEvent)` — frozen decision #3 events: `active` → full; `cancelled_unexpired` → full until period end; `expired` → read-only history; `refunded_full` → immediate revoke; `disputed` → suspended; `renewed` → restored.
- **`subscription_events`** append-only audit history is the event source; current status derived — status column is a convenience cache, never the sole truth. Columns: `id uuid PK`, `client_id`, **`event_id` (Shopify event/webhook id, UNIQUE — duplicate-event protection)**, `event_type` (ordered set: `payment_verified|activated|cancelled|expired|refunded|dispute_opened|dispute_resolved|extended|renewed|manual_admin`), `source` (shopify|webhook|admin|system), `occurred_at` (business-effective time), `processed_at`, `payload_reference` (order/payment reference), `idempotency_key` (UNIQUE: `event_id + event_type`), `created_at`. Processing is **transactional** (event insert + derived state change in one transaction); ordering by `occurred_at`, and a late/conflicting event (e.g. refunded arriving after a renewal of the same period) never re-activates: `resolveLifecycle()` evaluates against the latest `occurred_at` events and refund/dispute always wins for the affected period. Shopify retries hit `ON CONFLICT (idempotency_key) DO NOTHING` and return the original outcome.
- `getPortalContext()` — user-JWT path; strict demo path (`isDemoMode()`): **zero** Auth/PostgREST/Storage/network calls, simulated session + client + entitlements, all flagged `demo: true`.

- [ ] Step 1: `npm i @supabase/supabase-js @supabase/ssr`
- [ ] Step 2: implement modules; entitlements pure + exported; demo branch never imports network clients at runtime
- [ ] Step 3: `npx tsc --noEmit` → 0
- [ ] Step 4: commit `feat: supabase client scaffolding + entitlements/lifecycle core`

### Task 2: RBAC migration SQL (RLS policies, helpers, assistant inheritance, self-escalation guard)

**Files:** Create `supabase/migrations/001_rbac.sql`, `002_storage.sql`, `003_columns.sql`; apply via Supabase MCP.

**SQL contract (exact):**
- `profiles(id uuid PK refs auth.users ON DELETE CASCADE, role text NOT NULL CHECK IN ('admin','coach','coach_assistant','client'), email, full_name, client_id uuid UNIQUE REFERENCES clients(id) ON DELETE SET NULL, capabilities jsonb DEFAULT '{}', created_at, updated_at)`.
- `coach_clients(id uuid PK, profile_id → profiles, client_id → clients, granted_by, created_at, UNIQUE(profile_id, client_id))` — single truth for assignments.
- **`coach_assistants(id uuid PK, coach_profile_id → profiles, assistant_profile_id → profiles, granted_by uuid, status text NOT NULL DEFAULT 'active' CHECK IN ('active','revoked'), granted_at, revoked_at timestamptz NULL, created_at, UNIQUE(coach_profile_id, assistant_profile_id))`** — assistant inherits the coach's `coach_clients` assignments **only while `status='active'`** (revocation is immediate: a revoked row blocks all inherited access; "re-granted later" = new row or status flip with new audit). Assistants **cannot create, modify, or revoke `coach_clients`/`coach_assistants` rows** (only admin/coach per policies); an assistant can never access another coach's clients (inheritance is via their own rows only).
- Helpers: `is_admin()`, `owns_client(uuid)`, **`is_coach_of(uuid)` (coach-role only)**, **`can_access_client(uuid)` (single entry point for coach/assistant read access — evaluates coach assignments + active assistant inheritance; used by ALL data-table policies)**, `has_followup_client_access(uuid)` — `SECURITY DEFINER STABLE SET search_path = public, pg_temp`.
- `checkin_reviews(id uuid PK, submission_id → checkin_submissions UNIQUE, reviewer_profile_id → profiles, status CHECK IN ('pending','approved','needs_work'), feedback, created_at, updated_at)`.
- Helpers `is_admin()`, `owns_client(uuid)`, `is_coach_of(uuid)`, `has_followup_client_access(uuid)` — `SECURITY DEFINER STABLE SET search_path = public, pg_temp`.
- **Self-escalation guard policy on `profiles`:** a `client`-role session may UPDATE only display-ish fields (`full_name`); `WITH CHECK` blocks any change to `role`, `client_id`, `capabilities` (probe: authenticated client UPDATE role → `admin` must fail).
- Policies per role/table family per spec §RLS; RLS enabled LAST (order: `coach_clients`, clients-family, checkins/chat/logs). **Enable RLS on all 10 currently-disabled advisory tables with policies ready — do not auto-enable without policies.**
- Private buckets `checkin-photos` + `onboarding-photos`; object paths `{client_id}/{request_id}/`; owner-prefix policies; coach/service read via helper.

- [ ] Step 1: write 001/002/003; reconcile with Step-0 log; commit (`feat: rbac + assistant inheritance migrations`)
- [ ] Step 1b: **Rollback strategy (mandatory before apply):** export existing policies (`pg_policies`), grants tables, and a schema+data backup (pg_dump of public schema / Supabase backup) into `supabase/migrations/rollback-pre-phase3/`; write paired rollback SQL (`DOWN-001/002/003`) that drops exactly what each migration creates — never assume reverting restores prior permissions; re-apply pre-existing grants/policies explicitly in the rollback scripts. Verify the DB dump exists before `execute_sql` runs.
- [ ] Step 2: apply; verify `rowsecurity = true` on ALL public tables
- [ ] Step 3: **self-escalation probe**: client session UPDATE `profiles.role='admin'` → denied
- [ ] Step 4: n8n probe: signed BC-02 lead insert + BC-03/06/07 service-key writes still succeed
- [ ] Step 5: isolation probe: anon key `select * from clients` → empty/error

### Task 2.5: Account Provisioning & Invitations (BC-03 order events → identity)

The heart of "Purchase ≠ Identity ≠ Entitlements." Runs ONLY from the verified Shopify order-event webhook path (service role).

**Files:**
- Create `src/lib/provisioning/provision-client.ts`, `src/lib/provisioning/invite.ts`, `supabase/migrations/004_provisioning.sql`
- Modify: existing verified-order webhook route (`/api/webhooks/bc03-order` or current equivalent from Step-0 log) to hand off to provisioning — additive, does not change BC-03's other outputs (Telegram literal untouched).

**Interfaces (Produces):**
- `provisionFromOrder(Bc03OrderEvent): Promise<ProvisionResult>` — idempotent + **race-safe** pipeline:
  1. **Identity separation (one identity, many orders/subscriptions):** Shopify *customer* → `clients` row (one identity, keyed `shopify_customer_id` UNIQUE); Shopify *order* → its own record keyed by Shopify order/event id (UNIQUE); *auth identity* → one `auth.users` + `profiles` row per client; *subscription* → one active row per product period with full history in `subscription_events`. A customer with multiple orders/renewals keeps exactly one client identity.
  2. **Find-or-create client** keyed on Shopify `customer.id` — DB-level **upsert** (`ON CONFLICT (shopify_customer_id) DO NOTHING … SELECT`), not read-then-insert.
  3. **Event dedupe:** the order/event row upserted by UNIQUE event id (`ON CONFLICT DO NOTHING`; already-processed event returns the original outcome immediately).
  4. **Email gate (decision #1):** email missing ⇒ NO auth identity; create/maintain pending client record + `notifications` row for coach to collect email; return `pending_email`.
  5. **Auth identity:** Supabase Admin API `createUser` (signups disabled publicly) keyed by email; dedupe by email lookup first. **Partial-failure recovery:** if Auth creation succeeds but profile/binding insert fails, the next delivery of the same event (or a repair pass over clients with `auth_user_id` set but no profile) repairs state — every step is re-runnable from recorded ids; auth user dedupe by email prevents duplicate users.
  6. **Profile:** insert `profiles(role='client', client_id=…)`; ON CONFLICT no-op.
  7. **Entitlements:** subscription rows extended/created **only here** (verified event) + `subscription_events` append, within the same transaction as the event-record upsert (see Task 1 lifecycle contract).
  8. **Invitation:** send invite (Supabase Auth `inviteUserByEmail` / OTA link). Retry policy: 3 attempts, backoff; each attempt logged in invite-tracking tables (state machine: `pending → sent → accepted → failed`). Renewal of an already-onboarded client reuses account, skips onboarding, restores entitlements.
- **No n8n workflow modifications.** BC-03's Supabase writes are reconciled with this pipeline (Step-0 findings decide whether provisioning lives in the webhook route before n8n's own writes, with BC-03's notification behavior preserved verbatim).
- `createProvisioningCredentials()` — service key used HERE only + admin routes; never portal routes.

- [ ] Step 1: 004 migration (link columns + indexes); reconcile with existing `clients` columns
- [ ] Step 2: implement `provisionFromOrder` + invite machine
- [ ] Step 3: probes with synthetic verified events: new client; repeat event (idempotence — one client); renewal of existing (no new identity); missing-email (pending + notification, no auth user)
- [ ] Step 4: `npx tsc --noEmit` → 0; commit `feat: account provisioning + invitations`

### Task 3: Auth login + portal guard (strict demo behavior)

**Files:** Modify `src/app/(site)/login/page.tsx`; Create `auth/callback/route.ts`, `/api/auth/signout/route.ts`; Modify `src/middleware.ts`.

- [ ] Step 1: OTP sign-in → callback → `/portal`; signups disabled in Supabase Auth settings (provisioning-only identity)
- [ ] Step 2: **Demo contract:** no OTP send attempt, no Auth network call; simulated session cookie (clearly namespaced, e.g. `bc_demo_session=1`) grants demo client; middleware passes `/portal/*` in demo
- [ ] Step 3: Playwright: live-mode middleware redirect `/portal`→`/login`; demo mode `/portal` renders demo client
- [ ] Step 4: `npx tsc --noEmit` → 0; commit `feat: client auth (OTP) + demo-simulated session`

### Task 4: Portal shell + hub + entitlement banner

**Files:** Create `src/app/(site)/portal/layout.tsx`, `page.tsx`; i18n `portal_*`.

- [ ] Step 1: shell (RTL Arabic, banner variant from `computeEntitlements()`: active / expired(read-only) / pending-onboarding / revoked / disputed-suspended); gated cards
- [ ] Step 2: demo path: simulated client "عميل تجريبي", full entitlements, `demo: true` banner — zero network
- [ ] Step 3: Playwright screenshot; `npx tsc --noEmit` → 0; commit `feat: portal shell + hub`

### Task 5: Onboarding portal (BC-03 native form, user JWT)

**Files:** Create `src/app/(site)/portal/onboarding/page.tsx`, `src/app/api/portal/onboarding/route.ts`.

**Interfaces:** `POST /api/portal/onboarding` uses **the user JWT client** (NOT service role — RLS policy permits client INSERT into own `onboarding_submissions`). Fields mirror the existing n8n form (photos excluded from onboarding — check-ins only per decision #6). Submit writes row + advances `onboarding_requests.status`; coach notification stays BC-03's job — the route does NOT call `deliver()` and does not touch Telegram.

- [ ] Step 1: page (i18n labels) → API → own row (JWT; RLS backstop)
- [ ] Step 2: gating via `getPortalContext()`
- [ ] Step 3: JWT probe: submit as client → row owned; tampered `client_id` in body → rejected/404
- [ ] Step 4: `npx tsc --noEmit` → 0; demo-mode Playwright submit; commit `feat: native onboarding portal (JWT)`

### Task 6: Follow-up chat tunnel (BC-06 conversation, JWT + isolation probe)

**Files:** Create `src/app/api/portal/messages/route.ts`, `messages/send/route.ts`, `src/app/(site)/portal/follow-up/page.tsx`.

**Interfaces:** REUSE the EXISTING `chat_conversations`/`chat_messages` tables (no new conversation system). Initially **one persistent conversation per client-coach relationship**. `GET ?conversation_id=` → own conversation only (**user JWT**; RLS second guard); `POST /send` → `chat_messages(role='client', source='web')`; creates/voices the conversation if none. Telegram-sourced messages unified read-only in thread; coach replies via Telegram continue working, coach replies through the website (Task 7) write `role='coach', source='web'` into the SAME conversation. **Sender authorization enforced by RLS:** a client-session INSERT has `WITH CHECK (role='client')` with `role` ignored/taken server-side — a client caller cannot write a `role='coach'` row (probe included). Existing conversations/messages are reconciled with Step-0 findings (one conversation per client created/linked if missing).

- [ ] Step 1: API + chat UI (poll 8s); blocked UI when `entitlements.coach_chat === false`, expired ⇒ history read-only
- [ ] Step 2: **Isolation probe:** second session GET/POST other client's conversation → 403/404, zero rows
- [ ] Step 3: `npx tsc --noEmit` → 0; commit `feat: portal coach chat (client side)`

### Task 7: Admin CRM linking + role-aware dashboard (Coach `coach_assistants` aware)

**Files:** Modify `src/app/admin/layout.tsx`; Create `clients/page.tsx`, `clients/[id]/page.tsx`, `subscriptions/page.tsx`, `conversations/page.tsx`, `tasks/page.tsx` + APIs `admin/clients(+[id])`, `admin/tasks/review`, `admin/subscriptions/override`.

**Interfaces (Produces):**
- `GET /api/admin/clients` — role-checked (admin/coach from session profile) **then** service-role aggregate; coach sees only `coach_clients`-assigned clients (+ assistants via inheritance).
- Client profile drawer: onboarding, goals, subscription + `subscription_events` timeline, weekly/monthly history, measurements, **photos via signed URLs (service role, ownership-validated)**, conversations, `checkin_reviews` feedback, payment history (client + coach + admin visible; demo rows flagged), activity.
- Subscriptions: **manual override ADMIN ONLY** (coach view-only + can draft a "request override" notification to admin). Override writes `subscription_events` + updates cache row for the four allowed verbs (activate/suspend/extend/revoke).
- Follow-up mgmt: pending `checkin_requests` by cadence; review → `checkin_reviews` (JWT as coach route, or role-checked admin route — whichever Step-0 confirms; agent documents choice).

- [ ] Step 1: pages + routes per Interfaces; coach probe on `/admin/subscriptions` → read-only
- [ ] Step 2: admin-only override enforced server-side (not just hidden button): coach POST → 403
- [ ] Step 3: `npx tsc --noEmit` → 0; commit `feat: admin CRM linking + roles (admin-only overrides)`

### Task 8: Check-ins + progress history + photos (client side, private Storage, object paths)

**Files:** Create `src/app/api/portal/checkins/route.ts`, `checkins/submit/route.ts`, `src/app/(site)/portal/checkins/[id]/page.tsx`, `progress/page.tsx`.

**Interfaces:** `GET ?cadence=…&status=…` own requests only (JWT); POST submit (full `checkin_submissions` schema fields) → own row (JWT). **`photos` field stores Space Storage object PATHS (`checkin-photos/{client_id}/{request_id}/progress-front.jpg`), not UUIDs.** Uploads go through the authed Storage client with RLS owner-prefix policy; path validated against session's `client_id`. Submission does NOT trigger BC-07 — BC-06/BC-03 own their comms; coach sees pending review in Task 7 UI.

- [ ] Step 1: list/detail/submit APIs + pages; expired/revoked ⇒ read-only mode enforced by `getPortalContext()` AND API guard (not UI only)
- [ ] Step 2: probes: authed upload → 200 + path under own prefix; cross-client path → RLS/policy failure; signed URL for owner/coach (service, validated); public URL → fails; type/size validation rejects junk
- [ ] Step 2b: **Storage access lifecycle (binding):**

  | Event | Photo behavior |
  |---|---|
  | Subscription expires | **Preserve** (never auto-delete); coach retains access; client keeps read-only view of own history |
  | Coach assignment removed | Old coach loses access immediately (policy re-evaluates via `can_access_client()`) |
  | Client account disabled | Client session gets no access; admin/coach per authorization |
  | Account deletion request | Follow retention/deletion policy: purge on confirmed deletion (admin action), documented in resolution/audit |
  | Admin access | Retained per authorization (role-checked service path) |

  Implement as Storage/RLS policy semantics + documented deletion runbook (deletion is admin-initiated only; no automatic expiry cleanup).
- [ ] Step 3: expiry probe: past `end_date` sub → submit 403, history still readable
- [ ] Step 4: `npx tsc --noEmit` → 0; commit `feat: check-in submission + progress + private storage (object paths)`

### Task 9: Renewal hub — REQUEST ONLY (BC-07 comms; no activation)

**Files:** Create `src/app/api/portal/renewal/route.ts`, `src/app/(site)/portal/renewal/page.tsx`.

**Interfaces:** GET → own subscription + `subscription_events` + own order history. POST renew → **creates a renewal REQUEST record + fires BC-07 renewal-communication event** via existing signed deliver path; responds with "renewal requested — complete payment via Shopify" (deep link if catalog provides one). Status/entitlements change ONLY on the verified Shopify payment event via Task 2.5 — probe: POST renew does not alter `client_subscriptions.status`/`subscription_events` entitlement state. Expired view keeps read-only history + renewal CTA per decision #3 ("renewal restores").

- [ ] Step 1: page + API (JWT)
- [ ] Step 2: **no-activation probe:** POST renew → status/date unchanged
- [ ] Step 3: demo mode: request recorded in demo outbox (no network), `demo: true`
- [ ] Step 4: Playwright + `npx tsc --noEmit` → 0; commit `feat: portal renewal hub (request-only, BC-07)`

### Task 10: Notifications center + BC-99 view (errors read-only + resolutions table)

**Files:** Create `admin/notifications/page.tsx`, `admin/automation/errors/page.tsx`; migration (in 003) for **`notifications`** table (new, separate from `sales_notifications`) and **`automation_error_resolutions`** (`error_id, resolved_by, resolution_note, created_at`).

**Model:**

| Table | Purpose | App write access |
|---|---|---|
| `notifications` | in-app notification center (coach/admin + provisioning events) | app writes; UI reads |
| `sales_notifications` | existing sales notifications | unchanged (existing writers) |
| `automation_errors` | BC-99 originals | **READ-ONLY from app code** |
| `automation_error_resolutions` | admin acknowledge/resolve records | app writes; UI reads actions |

- [ ] Step 1: tables + RLS policies; deduped `automation_errors` view w/ occurrence counts; "Resolve" writes a resolution row (never touches `automation_errors`)
- [ ] Step 2: read-only probe: UPDATE `automation_errors` from app → denied
- [ ] Step 3: `npx tsc --noEmit` → 0; commit `feat: notifications center + BC-99 view + resolutions`

### Task 11: Acceptance verification

- [ ] Step 1: full build, dev server killed: `npm run build` → 0
- [ ] Step 2: Playwright end-to-end journey (live + demo): login → `/portal` → onboarding → chat → check-in+upload → progress → renewal request → admin views. Screenshots to `.playwright-cli/`.
- [ ] Step 3: re-run ALL security probes (cross-client, expiry, self-escalation, photos, renewal no-activation, BC-99 read-only) + n8n signed probes (BC-02/03/06/07 untouched behavior)
- [ ] Step 4: commit `chore: phase 3 acceptance gates`

---

## Execution rules (per client instruction, binding)

1. Tasks executed **sequentially**; each task verified (`npx tsc --noEmit` + its probes) and **committed before the next begins**.
2. Existing functionality preserved (Step-0 reconciliation is the checklist) — the website becomes the interface for existing processes; never recreate or duplicate.
3. Telegram literals/chat IDs untouched; BC-99 table read-only; no production n8n workflow unpublished/modified without explicit user authorization (BC-03 portal-link refinement in Task 11 is draft-then-confirm).
4. Verify everything against actual DB/schema state, never assumptions.

## Self-review notes (updated)

- Spec §Entitlement matrix → Tasks 1 (single-source `computeEntitlements` incl. `resolveLifecycle`), 4, 6, 8, mirrored in RLS helper (test parity). ✓
- Spec §Customer journey → Task 2.5 (provisioning: find-or-create, dedupe, email gate, invite machine, retries, status tracking), 3 (login), 5 (onboarding), 9 (renewal restores via verified event only). ✓
- Service-role vs JWT: Task 5 now JWT (fixed); binding table in Global Constraints; route-by-route mapping in File Structure. ✓
- `coach_assistants` + inheritance + client self-escalation guard → Task 2 (+ probes). ✓
- BC-99 read-only + separate `automation_error_resolutions` → Task 10 (+ probe). ✓
- Renewal request-only, never activates → Task 9 (+ probe); activation only via verified event in Task 2.5. ✓
- `subscription_events` audit history as truth source → Task 1 (core), surfaced Task 7/9. ✓
- Photos: object paths stored; ownership/type/size validation → Task 8. ✓
- Strict demo sandbox (no Auth/PostgREST/Storage/network; simulated session) → Tasks 1/3/4/9 + final probe. ✓
- Step 0 pre-work inspection + reconciliation log precedes all implementation. ✓
- Assistant schema but no UI (#7) → Task 2 only. ✓

---

## Step 0 — Reconciliation log (executed 2026-11-02, before Task 1)

### Live schema verified (Supabase `mqbyjshkocnkxfqoypyj`)

**Tables (public):** `automation_errors`, `chat_conversations`, `chat_messages`, `checkin_requests`, `checkin_submissions`, `client_subscriptions`, `clients`, `communication_logs`, `follow_up_tasks`, `integration_events`, `knowledge_base_items`, `leads`, `onboarding_requests`, `onboarding_submissions`, `sales_notifications`, `telegram_webhook_update_claims`.
**Planned new tables (`profiles`, `coach_clients`, `coach_assistants`, `checkin_reviews`, `subscription_events`, `notifications`, `automation_error_resolutions`) do NOT exist in any form** — no name collisions. `integration_events` DOES exist and is already the event ledger (see below).

**RLS state:** `rowsecurity=true` with **ZERO policies** for `chat_conversations`, `chat_messages`, `leads`, `sales_notifications`, `knowledge_base_items`, `telegram_webhook_update_claims` (effectively service-role-only — correct for current telegram-sourced flows). `rowsecurity=false` for: `automation_errors`, `checkin_requests`, `checkin_submissions`, `client_subscriptions`, `clients`, `communication_logs`, `follow_up_tasks`, `integration_events`, `onboarding_requests`, `onboarding_submissions` (the 10 advisory tables).

### Existing RPCs that MUST be preserved (not recreated)

- **`process_order_event(jsonb)` — SECURITY DEFINER.** Already implements: integration_events dedupe (`UNIQUE(event_type, provider, order_ref)`, `on conflict do nothing`), find-or-create client (telegram_user_id → email → phone fallback chain), renewal-vs-new subscription logic (`client_subscriptions` upsert on `(client_id, package_id, start_date)`), onboarding request creation with 5-day token, client status transitions. **provisionFromOrder (Task 2.5) is a THIN WRAPPER over this RPC**, not a fork: call it via service role, then layer auth-identity/profile/invite on its result.
- **`process_renewal_event(jsonb)` — SECURITY DEFINER.** Subscription_code lookup, cancel/downgrade vs extend (`greatest(end_date, current_date) + dur`). Refund/dispute lifecycle does NOT exist yet → new logic (Task 1 lifecycle + migration extension) handles it; **do not duplicate event recording** (`integration_events` stays ledger).
- Telegram-sourced form RPCs: `get_onboarding_form`, `submit_onboarding`, `get_checkin_form`, `submit_checkin`, `schedule_checkin_requests`, `get_renewal_candidates`, `log_automation_error`, `upsert_lead`, `save_conversation_turn`, `claim_telegram_webhook_update`, `get_coach_tasks`, `get_daily_report` — all used by n8n; leave untouched.

### Critical security finding (must fix in Task 2 migration)

**Every DEFINER RPC is EXECUTE-granted to `PUBLIC`/`anon`/`authenticated`** — including `process_order_event`, `process_renewal_event`, `submit_checkin`, `submit_onboarding`, `get_checkin_form`. PostgREST on the anon key could therefore forge order events / activations, making the HMAC layer decorative. **Task 2 MUST `REVOKE EXECUTE ... FROM anon, authenticated`** on n8n-write RPCs (keep `service_role`, `postgres`); portal-owned reads/writes go through RLS policies + new JWT-scoped paths, not these RPCs.

### Data-model reconciliations

1. `integration_events(id, event_type, provider, order_ref UNIQUE triple, payload, status, processed_at, processed_by, error)` = existing **dedupe/ledger layer**. `subscription_events` (new, Task 1/2.5) = entitlement-lifecycle audit referencing ledger events; idempotency via `ON CONFLICT (idempotency_key)` as planned; the ledger UNIQUE triple stays the first-line dedupe for order/renewal events.
2. `onboarding_requests(event_id → integration_events, channel('telegram'), token, token_expires_at 5d)` exists with token format `encode(gen_random_bytes(24),'hex')`. Portal onboarding (Task 5) reuses these rows: set `channel='web'` for portal-created paths, status machine `sent → completed/completed_late` unchanged.
3. `chat_conversations(conversation_id text PK, source('telegram'), chat_id bigint NOT NULL, ...)` — **chat_id is NOT NULL with no client FK**. Web conversations: `conversation_id='web-{client_id}'`, `source='web'`, `chat_id=0` sentinel (no FK constraint on the column; verified). Rows reconciled per Step-0: one persistent web conversation per client, created/linked on first portal message.
4. `checkin_submissions.photos` is already **jsonb** → stores object-path arrays per plan (no schema change needed for that field).
5. `automation_errors` already has `status('open')` + `resolved_at` columns written by BC-99 workflow — unaffected; app-code reads only, resolutions go to the new `automation_error_resolutions` table per client rule.
6. `clients.status` is enum `bc_client_status` (observed: `needs_onboarding`, `onboarding`, `active`); `clients.telegram_user_id` is nullable (email-only clients allowed). `client_subscriptions.created_from_event` already links subscription → ledger event.
7. `client_subscriptions` has `UNIQUE(client_id, package_id, start_date)` — relied on by `process_order_event`; provisioning upsert complements, does not fight, it.
8. `follow_up_tasks(source_type, source_id, ...)` + `sales_notifications` unchanged; `notifications` (new, Task 10) is additive and distinct.

### n8n workflow reconciliation (additive only)

- BC-03 (`aPt7y8swl0aq3Mka`) verifies orders + notifies, calling `process_order_event` (ledger shows `processed_by='n8n-bc03'`) — its writes are EXACTLY what Task 2.5 wraps. BC-06 (`4w7DX62b6wCOpPiI`) check-in scheduling/submission; BC-07 (`hE3RuIkr82XHZqmA`) renewal comms → `process_renewal_event`; BC-99 (`dkzI3KyB8ygSWGus`) errors → `automation_errors` via `log_automation_error`. No workflow modification required by reconciliation; the Phase 2 HMAC guards (`bc03-order-event`, `bc07-renewal-event` via `src/lib/integrations/contracts.ts`) stay the entry points.
- Existing app routes confirmed: `/api/orders/verify` (BC-03 dispatch), `/api/renew` (BC-07), `/api/leads` (BC-02), `/api/tasks/complete` — Task 2.5 extends the verified-order path additively.

### Binding adjustments inherited by tasks

- Task 2 SQL adds: REVOKEs (security finding), all-policies RLS enablement for the 10 disabled tables + policy review of the 6 already-enabled-but-policyless tables (they stay as-is unless portal needs JWT SELECT granularity — chat/leads stay service/telegram-only for now; portal chat INSERT/SELECT handled by Task 6 policies on the same tables), plus planned new tables.
- Task 2.5 refactor target: wrapper over `process_order_event` + `layers/auth/provisioning` (auth user create by email, profile insert, invite, subscription_events append, notifications for missing-email gate).
- Task 6 uses `chat_conversations`/`chat_messages` as verified in-place (sentinel chat_id + `with check (role='client')` policy).
- Task 8 photos → `checkin_submissions.photos jsonb` object paths (verified compatible).
- Task 9 renewal: `process_renewal_event` still ONLY invoked from the verified payment webhook path; portal POST stays request-only.
