# Phase 3 — Client Portals, RBAC & CRM Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the client portal system (onboarding, follow-up chat/check-ins, renewal) over Supabase Auth with database-enforced client isolation and role-based coach dashboard.

**Architecture:** Supabase Auth (email OTP, Resend-ready, no sending domain in demo) with `profiles` keyed to `auth.users.id`; RLS on every table with client isolation via `profiles.client_id` and coach/assistant inheritance via `coach_clients`. Portal pages live under `(site)` (Arabic RTL), coach views live in the existing `/admin` (LTR). Entitlements (decision #3 lifecycle) gate messages/check-ins at API + RLS layers. Demo mode (`isDemoMode()`) bypasses Supabase everywhere.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Zustand, Supabase (Auth, RLS, Storage), n8n GA webhooks (BC-02/03/06/07, signed).

**Spec:** `docs/superpowers/specs/2026-11-02-client-portals-rbac-design.md` (read before any task)

## Global Constraints

- **No test framework exists.** Every task's "verification" = `npx tsc --noEmit` AND the task's own check (SQL query, Playwright probe, or build). NEVER run `npm run build` while dev server is on port 3000 (kill first: `Get-NetTCPConnection -LocalPort 3000 … | Stop-Process`).
- Every user-facing string goes through `src/lib/i18n.tsx` dictionary (Arabic-first; admin stays LTR via existing `dir="ltr"`).
- Currency EGP via `formatMoney()` from `src/lib/utils.ts`.
- Demo data rows keep `demo: true`.
- Service-role key only inside `src/lib/supabase/supabase-service.ts` (server-only, `import "server-only"`); portal routes must use the user's JWT.
- Never modify Telegram literals/chat IDs; BC-99 errors table is read-only from app code.
- Supabase project ref `mqbyjshkocnkxfqoypyj`; migrations applied via the Supabase MCP `execute_sql`, and each SQL batch is also committed under `supabase/migrations/`.
- `X-BC-Environment` stays `"demo"` until live mode exists (out of scope).

## Review Focus

1. **Cross-client leakage via API** — client calling another client's `checkin_submissions`/`chat_messages` id must 404/empty, never 200. → Pinned by Task 6 probe with two demo accounts.
2. **Entitlement expiry bypass** — structuring a request after `end_date`/refund must fail at API layer too. → Task 8 probe with expired subscription row.
3. **Demo mode touching Supabase** — with envs unset, no portal/admin route may call Auth/PostgREST (must render demo data or redirect). → Task 4 + final Playwright run with envs cleared.
4. **RLS blocks n8n** — service-key operations (BC-02 lead insert, workbook RPCs) must still work after RLS ON. → Task 2 includes signed probe re-run.
5. **Photos privacy** — uploaded object must not be reachable without session; signed URL only for owner/coach. → Task 8 curl-without-token probe on bucket path.

---

## File Structure (responsibility map)

```
src/lib/supabase/
  supabase-service.ts   ← service-role client (server-only) for admin aggregates + workers
  supabase-auth.ts      ← anon client factory for portal pages (uses cookies session)
  portal-context.ts     ← getPortalContext(): { profile, client, entitlements, gates }
  entitlements.ts       ← pure functions: computeEntitlements(sub, today) → gates matrix
supabase/migrations/
  001_rbac.sql          ← profiles, coach_clients, checkin_reviews, helpers, policies
  002_storage.sql       ← private buckets + storage policies
  003_columns.sql       ← chat_messages.source, minor ALTERs
src/app/(site)/login/page.tsx        ← REAL Supabase OTP sign-in (replaces stub)
src/app/(site)/auth/callback/route.ts← auth code/OTP exchange
src/app/(site)/portal/
  layout.tsx  ← portal shell (RTL, Arabic, nav, subscription banner)
  page.tsx    ← hub (greeting + gated cards)
  onboarding/page.tsx       ← BC-03 native form
  follow-up/page.tsx        ← chat tunnel + open check-ins
  checkins/[id]/page.tsx    ← check-in form + photo upload
  progress/page.tsx         ← history + coach feedback (read-only when expired)
  renewal/page.tsx          ← subscription + own payment history + renew CTA
src/app/api/portal/
  messages/route.ts      ← GET/POST chat (gated by entitlements)
  messages/send/route.ts ← POST
  checkins/route.ts      ← GET list (own)
  checkins/submit/route.ts ← POST submission (gated) + Storage upload
  onboarding/route.ts    ← GET state / POST submit
  renewal/route.ts       ← GET own subscription+orders / POST renew (BC-07)
  me/route.ts            ← profile + entitlements cache
src/app/admin/
  layout.tsx             ← role-aware nav (Coach sees coaching sections only)
  clients/page.tsx       ← real client list + segments (All/Active/Inactive/Expired)
  clients/[id]/page.tsx  ← full profile drawer page
  conversations/page.tsx ← unified chat view + reply
  subscriptions/page.tsx ← lifecycle table; manual override ADMIN ONLY
  tasks/page.tsx         ← FOLLOW-UP mgmt: weekly/monthly/pending reviews + approve
  notifications/page.tsx ← notifications center (DB-backed)
Supabase Auth emails templates  ← configured in Supabase Auth settings (Resend hooks)
```

---

### Task 1: Dependencies + Supabase client scaffolding

**Files:**
- Modify: `package.json` (add `@supabase/supabase-js`, `@supabase/ssr`)
- Create: `src/lib/supabase/supabase-service.ts`, `src/lib/supabase/supabase-auth.ts`, `src/lib/supabase/portal-context.ts`, `src/lib/supabase/entitlements.ts`
- Modify: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; service role pulled from Supabase dashboard)

**Interfaces (Produces):**
- `createPortalClient(): SupabaseClient` — session/cookie-aware anon client
- `createServiceClient(): SupabaseClient` — server-only service client
- `computeEntitlements(sub: SubscriptionState | null, today: Date): Entitlements` — returns the 6-feature matrix per decisions table; lifecycle logic (expiry until date, full-refund immediate revoke, cancel-until-period-end, dispute suspend, renewal restore) in one pure function named `resolveLifecycle(subEvent)`.
- `getPortalContext(): Promise<PortalContext>` — `{ role, profile, client, entitlements, demo: boolean }`; demo path returns a fixed demo client + full entitlements, never touches network when `isDemoMode()`.

- [ ] Step 1: `npm i @supabase/supabase-js @supabase/ssr`
- [ ] Step 2: implement the four modules per Interfaces; entitlements function pure + exported
- [ ] Step 3: `npx tsc --noEmit` → 0
- [ ] Step 4: commit `feat: supabase client scaffolding + entitlements core`

### Task 2: RBAC migration SQL (RLS policies, helpers, new tables)

**Files:**
- Create: `supabase/migrations/001_rbac.sql`, `002_storage.sql`, `003_columns.sql`
- Supabase MCP `execute_sql` applies them.

**SQL contract (exact):**
- `profiles(id uuid PK refs auth.users ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('admin','coach','coach_assistant','client')), email text, full_name text, client_id uuid UNIQUE REFERENCES clients(id) ON DELETE SET NULL, capabilities jsonb DEFAULT '{}', created_at, updated_at)`.
- `coach_clients(id uuid PK, profile_id uuid REFERENCES profiles, client_id uuid REFERENCES clients, granted_by uuid, created_at, UNIQUE(profile_id, client_id))`.
- `checkin_reviews(id uuid PK, submission_id uuid REFERENCES checkin_submissions UNIQUE, reviewer_profile_id uuid REFERENCES profiles, status text CHECK IN ('pending','approved','needs_work'), feedback text, created_at, updated_at)`.
- `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'telegram'` (+ conversations likewise).
- Helpers: `is_admin() boolean`, `owns_client(uuid)`, `is_coach_of(uuid)`, `has_followup_client_access(uuid)` — all `SECURITY DEFINER STABLE SET search_path = public, pg_temp`.
- Policies per role/table family per spec §RLS, applied for SELECT/INSERT/UPDATE appropriately. RLS enabled LAST, table-by-table, in this order: `coach_clients` FIRST, then clients-family, then checkins/chat/logs.
- Private Storage buckets `checkin-photos` + `onboarding-photos` w/ owner-prefix object path policies + coach/service read.

- [ ] Step 1: write 001/002/003 SQL files; commit them (`feat: rbac migrations`)
- [ ] Step 2: apply via execute_sql; verify: `select tablename, rowsecurity from pg_tables where schemaname='public'` → all true
- [ ] Step 3: verify n8n still works: re-run signed BC-02 probe (lead insert row visible via service role)
- [ ] Step 4: verify isolation probe: anon key `select * from clients` → empty/error

### Task 3: Auth invite + login flow

**Files:**
- Modify: `src/app/(site)/login/page.tsx` (replace OTP stub — real `signInWithOtp({ email })`)
- Create: `src/app/(site)/auth/callback/route.ts` (exchange), `src/app/api/auth/signout/route.ts`
- Modify: `src/middleware.ts` — redirect `/portal/*` to `/login` when no session; demo-pass allowed when `isDemoMode()`

- [ ] Step 1: implement login → callback → portal redirect roundtrip
- [ ] Step 2: Supabase Auth settings — disable public signups entirely; note SMTP/Resend hook TODO for production (demo = OTP disabled gracefully with "verification required" demo card)
- [ ] Step 3: `npx tsc --noEmit` → 0
- [ ] Step 4: Playwright: `/login` renders; fake-OTP path shows error (no SMTP in demo); middleware redirect `/portal` → `/login` for 401 session
- [ ] Step 5: commit `feat: client auth (OTP) + portal guard`

### Task 4: Portal shell + hub + entitlement banner

**Files:** Create `src/app/(site)/portal/layout.tsx`, `page.tsx`; i18n keys `portal_*`

- [ ] Step 1: shell (RTL Arabic, greeting, banner variant: active/expired/pending-onboarding by `getPortalContext()`), hub cards → gated routes
- [ ] Step 2: demo path: `isDemoMode()` renders demo client (name "عميل تجريبي", full entitlements, banner `demo: true`)
- [ ] Step 3: build + Playwright screenshot of `/portal` demo
- [ ] Step 4: commit `feat: portal shell + hub`

### Task 5: Onboarding portal (BC-03 native)

**Files:** Create `src/app/(site)/portal/onboarding/page.tsx`, `src/app/api/portal/onboarding/route.ts`; Modify `contracts.ts` (add `Bc03OnboardingPortalEvent` type + reuse deliver)

**Interfaces (Produces):** `POST /api/portal/onboarding` → writes `onboarding_submissions` via service client (fields mirroring n8n form: full_name, phone, email, fitness_goal, training_days, location, experience, notes, photos NOT in v1 — photos only in check-ins per decision #6), then calls `deliver("bc03_order", ...)`? NO — separation: onboarding submit only records + sets request status; the **coach notification is BC-03's job** — portal route writes `onboarding_requests.solution` marker `source='web'`.
- [ ] Step 1: page mirrors current n8n form fields (Arabic labels via i18n); submit → API → onboarding_submissions row
- [ ] Step 2: gating: `getPortalContext().client.onboarding_pending` before showing form
- [ ] Step 3: `npx tsc --noEmit` → 0; Playwright submit demo → success card
- [ ] Step 4: commit `feat: native onboarding portal`

### Task 6: Follow-up chat tunnel (BC-06 conversation, RLS-isolated)

**Files:** Create `src/app/api/portal/messages/route.ts`, `messages/send/route.ts`, `src/app/(site)/portal/follow-up/page.tsx`
**Interfaces (Produces):** `GET /api/portal/messages?conversation_id=` → own conversation only (client JWT; RLS a second guard); `POST /api/portal/messages/send` (body: `conversation_id?`, `content`) → inserts `chat_messages` (`role='client'`, `source='web'`); creates conversation if none.
- [ ] Step 1: API + chat UI (poll every 8s); blocked UI when `entitlements.coach_chat === false`
- [ ] Step 2: **Isolation probe** (Task's own verification): insert a second client via service client; POST with clientId=newId session attempts GET of first client `messages?conversation_id=X` → expect 403/404 & no rows.
- [ ] Step 3: `npx tsc --noEmit` → 0; commit `feat: portal coach chat (client side)`

### Task 7: Admin CRM linking + role-aware dashboard

**Files:**
- Modify: `src/app/admin/layout.tsx` (role-aware nav: Admin sees all; Coach hides Notifications-management/subscriptions-management; role read from session profile; legacy `bc_admin` password login maps to role `admin`)
- Create: `src/app/admin/clients/page.tsx`, `clients/[id]/page.tsx`, `subscriptions/page.tsx`, `conversations/page.tsx`, `tasks/page.tsx`, `notifications/page.tsx`, and API `src/app/api/admin/clients/route.ts` (+ `[id]`), `tasks/review/route.ts`

**Interfaces (Produces):**
- `GET /api/admin/clients` — service-role backed but route-guarded by admin/coach role; supports `?segment=all|active|inactive|expired`
- Client profile page surfaces: personal, onboarding, goals, subscription, weekly columns (from `checkin_submissions` where request cadence weekly), monthly, measurements list, photos (signed URLs via service client), conversations, coach feedback (via `checkin_reviews`), payment history (Shopify when live / demo rows flagged), activity (from `integration_events`).
- Subscriptions: manual override buttons rendered only when profile.role === 'admin'; effect = INSERT `subscription_events` row + update `client_subscriptions.status` per decision #3 allowed verbs (activate/suspend/extend/revoke).
- Follow-up mgmt: list pending `checkin_requests` by cadence; approve/feedback → `checkin_reviews`.

- [ ] Step 1: build the five pages + routes per Interfaces block
- [ ] Step 2: role gating probe: coach-session hitting `/admin/subscriptions` → read-only
- [ ] Step 3: `npx tsc --noEmit` → 0; commit `feat: admin CRM linking + roles`

### Task 8: Check-ins + progress history + photos (client side)

**Files:**
- Create: `src/app/api/portal/checkins/route.ts`, `checkins/submit/route.ts`, `src/app/(site)/portal/checkins/[id]/page.tsx`, `progress/page.tsx`
- Storage: service client issues signed upload URLs scoped `checkin-photos/{client_id}/{request_id}/…` (owner prefix), client POSTs via upload endpoint to stream to bucket.

**Interfaces (Produces):** `GET /api/portal/checkins?cadence=weekly|monthly&status=pending` → own requests only; POST submit (all fields from `checkin_submissions` schema, `training_days_made`, `workout_pct`, `nutrition_pct`, `energy`, `sleep`, `difficulties`, `feedback`, `photos` uuid list) → creates submission row + triggers BC-07? — NO: BC-06 handles completions if triggered later; here coach sees pending review in Task 7 UI.
- [ ] Step 1: list + detail + submit APIs + pages; expired entitlement → full read-only history mode (spec matrix) enforced by `getPortalContext()` AND API guard
- [ ] Step 2: photo probe: upload with session → 200 + object path `checkin-photos/{client_id}`; same path GET without session via public URL → 404
- [ ] Step 3: expiry probe: temporarily set demo client sub end_date to past → submit endpoint returns 403 (Task's own check)
- [ ] Step 4: `npx tsc --noEmit` → 0; commit `feat: check-in submission + progress history + storage`

### Task 9: Renewal hub (BC-07)

**Files:** Create `src/app/api/portal/renewal/route.ts`, `src/app/(site)/portal/renewal/page.tsx`
- [ ] Step 1: page shows current subscription (`client_subscriptions` latest), payment orders (own), renew button POSTs to `/api/portal/renewal` → calls `deliver("bc07_renewal", ...)` (existing route reuse) and reflects renewal state response
- [ ] Step 2: demo mode: renewal button posts to a demo outbox sim (no network); banner `demo: true`
- [ ] Step 3: Playwright renewal flow → demo success card; `npx tsc --noEmit` → 0; commit `feat: portal renewal hub (BC-07)`

### Task 10: Notifications center + BC-99 view

**Files:** Create `src/app/admin/notifications/page.tsx`, `admin/automation/errors/page.tsx` (route under existing Automation Center)
- [ ] Step 1: read `sales_notifications` (real), `automation_errors` deduped by `dedupe_key` w/ occurrence count + resolve action (marks resolved);
- [ ] Step 2: play style consistent with existing `Reveal`
- [ ] Step 3: build + screenshot; commit `feat: notifications center + bc-99 view`

### Task 11: Phase 3 acceptance verification + n8n portal-link refinement

**Files:**
- Modify: n8n BC-03 node `Prepare Onboarding Invite` (draft only — see note) — keep behavior; add second link variant for `source='web'` clients (portal URL). Apply via update_workflow then publish after validating.

- [ ] Step 1: full build with port-3000 killed: `npm run build` → 0
- [ ] Step 2: Playwright journey: login (fake OTP hands demo) → `/portal` → onboarding submit → follow-up chat send → check-in upload → progress → renewal demo → admin views. Screenshots in `.playwright-cli/`.
- [ ] Step 3: Cross-client + expiry + n8n probes re-run clean (from tasks 2/6/8).
- [ ] Step 4: commit `chore: phase 3 acceptance gates`

---

## Self-review notes

- Spec §Entitlement matrix → Tasks 4, 6, 8 (gates + read-only history). ✓
- Spec §Customer journey → Task 3 (invite/login), Task 5 (onboarding), Task 9 (renewal restore). ✓ Activate-from-payment only via verified `bc03-order-event` — unchanged from pre-existing 8.3; portal routes cannot activate.
- Spec §Roles/RLS → Tasks 2, 3, 7. ✓
- Spec §coach dashboard tree → Tasks 7, 10. ✓
- Spec §notifications center → Task 10. ✓
- Payment history visibility (#5) → Task 7 clients+subscriptions & Task 9 portal. ✓
- Storage/private photos (#6) → Task 8. ✓
- Assistant schema but no UI (#7) → Task 2 only. ✓
