# BC Website × n8n Integration — Phase 1 Discovery Report

Date: 2026-11-02 · Status mode: **everything runs in demo mode today; live mode will use Shopify for store + payments.** No production code or workflows were modified.

---

## 1. Current architecture (as-built)

### Website (Next.js 14 App Router)
- One codebase, two surfaces: `(site)` public + `admin` CRM behind `bc_admin` httpOnly cookie (src/middleware.ts, src/app/api/admin/auth/route.ts — the ONLY API route that exists).
- Arabic-first/RTL, language context in src/lib/i18n.tsx, business data in src/lib/catalog.ts.
- **Everything is client-side demo**: cart/checkout (src/app/(site)/checkout/page.tsx), contact form, admin store (src/lib/demo/admin-store.ts) all run in browser state/localStorage. Checkout creates a fake `od-...` order with `paymentStatus: "paid"` and calls `logEvent("order.paid", ...)`.
- Integration layer exists only as a **demo event bus**: src/lib/integrations/{events,dispatcher,webhooks,email,shopify}.ts. `eventBus.dispatch()` writes to `localStorage`; `validateWebhookSignature()` is a stub (`return Boolean(...)`); shopify.ts only implements Storefront product fetch (never actually called since env is empty).
- `@supabase/supabase-js` is **NOT installed**. `process.env` usage is limited to admin password, Supabase URL, Shopify domain/tokens, email key. No server-side Supabase client anywhere.
- Customer login `/login` is a static "not connected yet" page — **no customer auth exists**.
- `isDemoMode()` (src/lib/mode.ts): true unless `NEXT_PUBLIC_SUPABASE_URL` AND `SHOPIFY_STORE_DOMAIN` are both set.

### n8n (self-hosted, n8n.corble.net) — 8 workflows confirmed, NO BC-02 exists
All active; every workflow uses the **Supabase pre-defined credential (service key held only inside n8n)** and errorWorkflow = BC-99 (`dkzI3KyB8ygSWGus`).

| Workflow | ID | Triggers | Verified behavior |
|---|---|---|---|
| BC-01 AI Sales Assistant v2 | 7yHrk6Z2lLlBH0KT | Telegram Trigger (private text only) | Telegram → claim update (dup protection via `telegram_webhook_update_claims`) → conversation context from `get_conversation_context` → Groq AI agent w/ knowledge base + deterministic price guard → `upsert_lead` → sales notification grp -1003694741353 (qualified/handoff only). **No HTTP lead intake — Telegram Trigger only.** |
| BC-03 Client Onboarding | aPt7y8swl0aq3Mka | Webhook `bc03-order-event` POST + daily sweep 18:30 | Parse body (order_ref, event_type, provider, package_id, duration_days, customer_name, telegram_user_id/chat_id, email, phone, kind, subscription_code) → `process_order_event` RPC (idempotent; returns `duplicate`) → if `telegram_chat_id` present send onboarding link `https://n8n.corble.net/webhook/form/onboarding?t=<token>` else respond `onboarding: invite_stored_no_telegram`. Sweep: `get_onboarding_reminders`/`get_onboarding_escalations` → reminders (24/48h) & 72h escalation to Coach Ops grp. Also serves GET `form/onboarding?t=` (built-in HTML page) and POST `form/onboarding-submit` (token + data + photos → `submit_onboarding` RPC). |
| BC-04 Weekly Check-in | V5t4kDZWqG73AUAl | Daily 09:00 | `schedule_checkin_requests`/`get_*` RPCs → Telegram invites/`form/checkin?t=` → `submit_checkin` → coach task + Coach Ops notify. |
| BC-05 Missed Check-in | vYiINZgPNoDA0ZWp | Schedule | `get_missed_checkins`/`age_checkin_escalations` → reminders → escalation task. |
| BC-06 Coach Tasks | 4w7DX62b6wCOpPiI | Webhook `bc06-task-event` POST | Switch on body.action: `upsert` → `upsert_follow_up_task` RPC (notify Coach Ops grp) ; `complete` → `complete_follow_up_task` RPC (body.task_id, notes, completed_by) → respond JSON. No auth on webhook. |
| BC-07 Renewals | hE3RuIkr82XHZqmA | Daily 10:30 sweep + Webhook `bc07-renewal-event` POST | Sweep: `get_renewal_candidates` (stages 7d/3d/1d/expire) → Telegram reminders / expiry coach task. Webhook: body → `process_renewal_event` RPC (idempotent via integration_events) → Coach Ops notify. |
| BC-08 Daily Report | 1yKFeGI4C47ONxLd | Daily 09:00 | `get_daily_report` RPC → Daily Report grp. |
| BC-99 Error Handler | dkzI3KyB8ygSWGus | Error trigger | `log_automation_error` RPC → Alert grp. |

### Supabase (project mqbyjshkocnkxfqoypyj)
16 tables exist exactly as documented. **The real business logic lives in Postgres RPCs** (the workflows are thin shells over them):

- `process_order_event(p_evt)` — creates integration_event (idempotency key = order_ref), client upsert, subscription create (package/duration), onboarding_request + token. Returns success/duplicate/client_code/telegram_chat_id/token.
- `process_renewal_event(p_evt)` — same idempotency; supports extension + `cancelled` action.
- `upsert_follow_up_task(p_task)` / `complete_follow_up_task(p_task_id, p_notes, p_completed_by)` — dedupe by source_type+source_id.
- `upsert_lead(p)` — lead upsert keyed by telegram identity.
- Form functions: `get_onboarding_form(p_token)`, `submit_onboarding(p_token, p_data, p_photos)`, `get_checkin_form(p_token)`, `submit_checkin(p_token, p_data, p_photos)` (tokens expire: onboarding 5d, checkin 10d).
- Enums: `bc_pkg_id` = **silver | gold only**; `bc_client_status` = needs_onboarding/onboarding/active/paused/ended.
- **Schema constraint of note:** `leads.telegram_user_id` is NOT NULL — the leads table is Telegram-shaped; `leads` has no generic `source`/`message` column (message context lives in chat_messages via conversation_id).

## 2. Existing integration points (usable today)
1. `bc03-order-event` — but payload contract is **coaching-package shaped** (silver/gold + duration_days + optional telegram identity).
2. `bc06-task-event` — upsert/complete, category enum includes `general_support`, `automation` (usable for website-originated tasks).
3. `bc07-renewal-event` — order_verified for a subscription_code.
4. Form endpoints (onboarding + checkin) with token auth — tokenized URLs are safe to forward through the website.
5. No website-lead endpoint anywhere (BC-01 is Telegram-only) → needs **BC-02** or a Supabase-first path.

## 3. Gaps / conflicts to resolve before Phase 2
| # | Issue | Consequence | Proposed resolution |
|---|---|---|---|
| G1 | Webhooks (`bc03/bc06/bc07`) have **zero authentication** — anyone who knows the URL can inject orders/tasks/renewals. | Privileged injection | Add shared-secret check inside each workflow (first node reads `X-BC-Signature`/`X-BC-Timestamp`, computes HMAC-SHA256 or compares secret env; reject 401). Website sends it from server-side only. Backup workflows before editing (export JSON to `n8n-backups/`). |
| G2 | `package_id` enum is silver/gold only, but **website sells 6 training programs** (products, not packages). | Program purchase cannot map to BC-03 subscription logic | Split semantics: **coaching package purchase → BC-03 order_verified (silver/gold + duration)**; **program purchase → informational order only (no subscription/onboarding — delivery is program access via Shopify at live time)**. Demo checkout must NOT send order_verified for program purchases; only coaching packages (demo placeholders Silver/Gold) may trigger BC-03. |
| G3 | `leads.telegram_user_id NOT NULL`; website leads have no Telegram identity. | Direct INSERT impossible cleanly | New RPC-or-workflow path: BC-02 stores website leads via a dedicated DB record with convention `telegram_user_id = 0` + `lead_code` prefixed `web-`, OR keep website leads in a website-side table. Decision needed from user. |
| G4 | No customer auth on the site; onboarding/check-in experience is tokenized-line based. | Client dashboard views must be token-driven | Client portal keyed by onboarding/check-in token URL params (Option B: branded page forwards token) — no session needed in demo. |
| G5 | No payment provider. "Verified payment" cannot exist in demo. | Order verification is untestable honestly | Demo: implement a **simulated-verified** path (clearly-labeled demo order → `order_verified` demo event), architecture identical to live (Shopify webhook → server verify → same event). Live: Shopify checkout + Orders-paid webhook verification replaces it without changing the event contract. |
| G6 | No outbox/delivery tracking; failed n8n delivery would silently lose events in demo. | Reliability rule #13 | Website-side outbox: integration events persisted (localStorage in demo / integration_events + local outbox in live) with attempts + status; admin monitoring view. |
| G7 | Existing demo event bus is client-side (localStorage) and `logEvent("order.paid")` from the checkout form — violates "never trust frontend". | Client-side dispatch demo-only | Phase 2 replaces dispatch with server-side API routes; keep the demo bus for UI event display only. |
| G8 | Telegram group IDs must stay literal in Telegram nodes — preserved in all plans. | — | Do not touch Telegram nodes. |

## 4. Security concerns
1. Unauthenticated privileged webhooks (G1) — top priority.
2. RLS: docs say disabled on 10 CRM tables. Website must access Supabase **service-role only, server-side**; expose nothing directly from browser. Customer-scoped reads in demo use token-based URLs. RLS enablement is deferred and coordinated (do not break n8n service access).
3. Onboarding tokens must never appear in logs/analytics — token-bearing links proxied/forwarded via client portal pages, not logged.
4. Validate every website→server payload with zod-style checks; never trust browser-submitted amounts/IDs.

## 5. Environment variables (names only)
Existing: `ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `EMAIL_API_KEY` (+ Supabase anon/service keys per usage).
To add (server-side only): `N8N_BASE_URL`, `N8N_BC03_ORDER_WEBHOOK`, `N8N_BC06_TASK_WEBHOOK`, `N8N_BC07_RENEWAL_WEBHOOK`, `N8N_WEBHOOK_SECRET` (HMAC shared secret with workflows), optional `N8N_WEBHOOK_URL_PROTECTED` if a Nginx-proxy route is chosen over G1 signature approach.

## 6. Proposed plan (phases 2-8, mapped to user's brief)
- **P2 Secure integration layer**: `src/lib/n8n/client.ts` (server-only fetch client, HMAC signing, correlation IDs, timeouts, retry w/ jitter, outbox), typed contracts `src/lib/integrations/contracts.ts`, API routes: `/api/leads` (contact form + selector), `/api/orders/[id]/verify` (demo-verified path), `/api/automation/events` (admin), `/api/tasks/complete` (admin), `/api/renew` (demo). Dashboard: Live/Demo **maintenance status indicator** (user requirement) in admin settings + settings page already has integrationStatus() to extend with n8n.
- **P3 Leads**: BC-02 — Website Lead Intake (new workflow; webhook `/webhook/bc02-lead` authenticated; validates, dedupes by lead_code, notifies Sales & Lead grp with literal chat id, optional handoff flag). Website: contact form + selector submit → server route → outbox → BC-02.
- **P4 Orders/Onboarding**: checkout distinguishes program purchase (informational only) vs coaching package (BC-03). Demo "payment verification" step clearly labeled. Duplicates handled by `process_order_event` idempotency.
- **P5 Client experience**: `/client/onboarding?t=…` and `/client/checkin?t=…` branded pages (Arabic RTL) that proxy/forward tokens to existing n8n form endpoints (Option B), expired-token states, Arabic confirmation.
- **P6 Renewals & coach ops**: admin "Tasks" section → BC-06 complete; renewal CTA in demo client view → `/api/renew` → BC-07.
- **P7 Monitoring**: admin Automation section — delivery/attempt/status from outbox + `automation_errors` summary (read via server), distinguishing DB vs n8n delivery vs automation completion.
- **P8 Verification**: tsc + build + Playwright scenarios from the brief (leads, orders, onboarding, check-in, renewal, security, screenshots).

## 7. Backup-first rule
Before touching any n8n workflow (G1 signature work), export copies of BC-03/06/07 (and any others modified) to `n8n-backups/` and keep the Telegram nodes untouched.

## 8. Questions needing user decision
1. **G2**: confirm programs ≠ onboarding triggers; only Silver/Gold coaching packages trigger BC-03 in demo.
2. **G3**: website leads → new BC-02 workflow + `telegram_user_id = 0` convention OK?
3. **G1**: OK to add shared-secret validation to BC-03/06/07 workflows (after backup export)?
4. Demo check-in/onboarding: OK to test via demo tokens generated through demo order_verified events?
