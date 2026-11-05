# Demo Guide — Belghamdi Coaching

The **full demo lifecycle**: from a visitor making an order → becoming a client → coaching → renewal → the admin managing all of it. Plus the go-live checklist.

---

## 1. What "demo mode" is

Demo mode is **automatic**: it is ON whenever Supabase or Shopify env vars are absent (`src/lib/mode.ts` → `isDemoMode()` returns true if `NEXT_PUBLIC_SUPABASE_URL` **or** `SHOPIFY_STORE_DOMAIN` is unset). This checkout currently ships that way — everything below works out of the box.

In demo mode:

- **Zero network**: no Supabase, no PostgREST, no Storage, no n8n, no real email. Every "backend" is simulated.
- **Real code paths**: the same pages, routes, auth gates, validations and entitlement logic run — only persistence is simulated.
- **Nothing you do can touch real data**: demo rows are flagged `demo: true` and badged DEMO in the UI.

**Two kinds of demo state:**

| State | Where it lives | Reset when |
|---|---|---|
| Admin CRM data (leads, orders from checkout, notifications, errors) | **Browser localStorage** (zustand persist) | Clear site data / "Reset seed" in admin settings |
| Portal data (onboarding, chat, check-ins, renewal requests) | **Server memory, keyed per login session** | Sign out, new login, or server restart |

## 2. Quick start

```bash
npm run dev        # http://localhost:3000
```

| Surface | URL | Credential |
|---|---|---|
| Public site | `/` | — |
| Client login | `/login` | **any email** (no code sent — simulated inbox) |
| Client portal | `/portal` | latched by the `bc_demo_session` cookie (7 days) |
| Admin login | `/admin/login` | password **`belghamdi-demo`** |
| Admin CRM | `/admin` | `bc_admin` cookie |

Use **two browser profiles** (or a normal + incognito window) to play client and admin at the same time.

---

## 3. The full journey — order → client → admin

### Act 1 — Visitor makes an order (public site)

1. Browse `/programs`, `/explore`, the selector; open a program page.
2. Add a program to the **cart** → go to **`/checkout`** → fill the form → place the order.
3. Demo checkout **does not process payment**. It:
   - creates a demo order (id like `od-07xx`, status timeline: *"Order created (demo)" → "Payment captured (demo)"*),
   - logs `order.paid` into the integration outbox,
   - shows the demo badge instead of a payment sheet.
4. Switch to the **admin browser**: `/admin/orders` — the order you just placed is there with its timeline, marked *"Demo order — simulated for demonstration. Live orders will be imported from Shopify."*

> In production this step is a real Shopify checkout; the order only becomes a **client** after the payment is *verified* (next act).

### Act 2 — Payment verified → identity pipeline (provisioning)

A verified order is what turns a buyer into a client. In demo, fire the verification event yourself:

```bash
# order WITH email  → full provisioning
node scripts/probe-bc03-webhook.mjs 3000 SO-DEMO-1 client@example.com

# order WITHOUT email → pending_email path (coach must collect it later)
node scripts/probe-bc03-webhook.mjs 3000 SO-DEMO-2

# replay the same order → idempotent: duplicate_ignored (ledger dedupe)
node scripts/probe-bc03-webhook.mjs 3000 SO-DEMO-1 client@example.com
```

What the pipeline does per verified order (simulated locally, identical logic live):

1. HMAC check (`X-BC-Signature`, same `N8N_WEBHOOK_SECRET` both sides hold) — unsigned/tampered → **401**.
2. Client find-or-create → **email gate**: no usable email → client is staged, an admin `missing_email` notification is created, and **no identity/invite** is issued (coach collects the email).
3. One identity per person: auth user found-or-created (never duplicated), profile row linked to the client.
4. Subscription written + mirror event appended (idempotent — replays self-heal).
5. **Invitation** state machine: `pending → sent → accepted` (accepted flips on the client's first portal login).

In the **admin browser** you'll see the side effects: new notification(s), the outbox delivery in `/admin/automation`.

### Act 3 — Becomes a client (portal)

1. In the **client browser**, go to `/login` → type any email → submit.
2. Demo skips the OTP: you see the "check your inbox" state and the portal is latched (`bc_demo_session`, 7 days).
3. `/portal` **hub** — entitlement cards (onboarding, follow-up, progress, renewal) + the status banner. Banner precedence: red/amber (revoked/suspended) > blue (pending verification) > green (active). A brand-new demo client is active/green.
4. **Onboarding** — `/portal/onboarding` → fill the intake form → submit. The request is recorded and flips to `completed`.

### Act 4 — The coaching loop

- **Follow-up chat** — `/portal/follow-up` → send a message → a simulated coach reply appears (same unified thread model as live, where Telegram + web share one conversation). A check-ins section is embedded below.
- **Check-in** — open a check-in → weight (30–300 kg), workout/nutrition %, training days, energy/sleep (1–10), notes → attach up to 3 photos (private-bucket simulation) → submit.
- **Progress** — `/portal/progress` → sparkline trends (weight, waist), full history, photo tiles. An expired subscription renders history **read-only** (expiry never deletes history).
- **Admin side**: your messages appear in `/admin/conversations`; your check-ins appear for review; the follow-up tasks surface in `/admin/tasks`.

### Act 5 — Renewal (request-only)

1. `/portal/renewal` — subscription card, order/payment timeline, past requests.
2. Pick a package preference (Silver/Gold) → **Request renewal** → success card with a `DEMO-…` reference.
3. Hard rule (enforced in code): a portal request **never activates or extends anything** — no subscription writes, no entitlement events. Access restores only when a verified payment event arrives (Act 2 again). The request only notifies the coach (BC-06-shaped task) and lands in the ledger.

### Act 6 — The admin manages everything (`belghamdi-demo`)

- **`/admin`** — role-aware dashboard.
- **`/admin/orders`** — the Act-1 order with its lifecycle timeline.
- **`/admin/clients`** — client list → open a **drawer** → profile, subscription, onboarding, per-client history.
- **`/admin/subscriptions`** — read-only table; as admin you get the **override** button. Demo simulates the lifecycle rules: refund → immediate revoke, cancel → until period end, dispute → suspend, renewal → restore. Override the demo client, then watch the **portal banner flip** (red/amber) in the client browser — expiry keeps history visible but read-only, and `/portal/renewal` remains reachable (it is the remediation path).
- **`/admin/conversations`** — reply as the coach into the same thread the client sees.
- **`/admin/tasks`** — review/complete follow-up tasks (renewal requests create these).
- **`/admin/notifications`** — center with **Notifications** tab (kind badges, unread indicator) + **Sales** tab (admin-only).
- **`/admin/automation`** — Automation Center: n8n workflow inventory (BC-01…BC-99) + the **outbox**: every simulated communication from the whole journey (order.paid, lead intake, BC-06 tasks) shows here as demo/skipped records.
- **`/admin/automation/errors`** — the **BC-99 view**: errors deduped by key (occurrences, severity, workflow, node, first/last seen, execution link) → **Resolve** (note required → resolution record). The error rows themselves are read-only forever: the n8n workflow owns their status; the app can never mutate them.

> Role model: this demo login is `admin`. Coach/assistant roles exist in the data model (scoped views, no admin overrides) but their **pages** are gated behind the admin cookie — see backlog item "coach-JWT page reachability".

---

## 4. Testing workflows & automation in demo

**The core idea:** the webapp and n8n talk through a single choke point — `deliver()` (`src/lib/integrations/n8n-client.ts`), HMAC-signed. In live mode it POSTs to the n8n webhook; **in demo mode it records the delivery locally instead** (status `skipped`, up to 300 records in your browser localStorage under `bc_n8n_outbox`). So you can test everything the *website* does with automation, entirely offline.

### What you can exercise (all visible in `/admin/automation`)

| Trigger | Where you fire it | Outbox result |
|---|---|---|
| **BC-02 — website lead intake** | Submit the contact/lead form on the public site | delivery record for the BC-02 webhook (payload the workflow would receive) |
| **BC-03 — order verified → identity** | `node scripts/probe-bc03-webhook.mjs 3000 SO-… email` (Act 2) + demo checkout (`order.paid`) | webhook 200 + provisioning result; checkout order event in the outbox |
| **BC-06 — follow-up task** | Portal renewal request (Act 5) | delivery record + the task appearing in `/admin/tasks` |
| **Notifications** | Onboarding submit, missing-email event, task events | rows in `/admin/notifications` |
| **BC-99 — automation errors** | `/admin/automation/errors` demo rows | deduped view + **Resolve** flow (resolution recorded; error rows stay read-only — app never mutates them) |
| **Retry path** | **Retry** button on a delivery in the Automation Center | re-fires through `/api/automation/retry` (bounded to 3 attempts per record) |
| **Health probe** | Automation Center status card | `/api/automation/status` (admin-gated) reports n8n `configured/connected/secretConfigured` without ever exposing the secret |

Also useful: the **outbox records are the contract check**. Open any delivery and compare its payload against `src/lib/integrations/contracts.ts` — that's the exact shape n8n must accept. Task 11 did this and found the BC-03 mapping mismatch (live workflow `ignored` the app-shaped event), which is why that's an owner item.

### What demo *cannot* test (and how to test it anyway)

Demo proves the **website side** fires and records; it cannot run the **workflows themselves** (they live on the n8n instance outside this app). To test those:

1. **From the n8n editor** — open BC-01…BC-99 on your instance and use *Test workflow* / *Execute previous* with pinned data. Nothing on the website changes; publishing stays owner-authorized.
2. **Signed payloads from scripts** — the probe pattern (`scripts/probe-bc03-webhook.mjs`) can point at the **live** n8n webhooks instead of localhost: same HMAC headers, real workflow run. Known finding: BC-03's intake currently `ignored`s the app-shaped payload (`missing order_ref`) — that's the mapping review in §6.
3. **Telegram flows (BC-01/BC-06 consumer side)** and real Shopify webhooks need real credentials — end-to-end checks live in the §6 runbooks once the service key and Shopify env land.

## 5. Security checks you can try in demo

- Open `/portal` in a fresh incognito window → redirected to `/login`.
- `POST /api/portal/renewal` / `/api/admin/*` without cookies → **401/403**.
- `PATCH /api/admin/automation-resolutions` → **405** (deliberately no mutation endpoint).
- Webhook without (or with a tampered) `X-BC-Signature` → **401**; missing `N8N_WEBHOOK_SECRET` → **503 fail-closed**.
- Admin APIs re-verify the role server-side on every call — the cookie alone never grants role.

---

## 6. What is remaining (before go-live — NOT now)

### A. Environment / access (owner)
| Item | Why |
|---|---|
| **Rotate the Groq API key** | A live key was redacted from repo history during the GitHub push (`GROQ_API_KEY_REDACTED` placeholder now in `n8n/belghamdi-automation/MCP's.md`). Revoke at Groq, keep the new one in the n8n credential only. |
| Paste `SUPABASE_SERVICE_ROLE_KEY` into `.env.local` | Unlocks blocked live probes: provisioning E2E, cross-client chat isolation, JWT photo upload, signed-URL expiry, RLS checks. Runbooks: `task-2-5-report.md` §5 + `task-11-report.md`. |
| `NEXT_PUBLIC_SITE_URL` | Invite/magic-link redirect origin — without it invites point at localhost. |
| `ADMIN_PASSWORD` | Change from the `belghamdi-demo` fallback. |
| Resend domain + Supabase SMTP hook | Real invite/OTP emails (built-in sender is demo-grade). |
| Shopify env vars | Their presence flips the app out of demo mode. |

### B. Cutover code switches (adjudicated in the SDD ledger)
- **PKCE**: `createPortalClient()` → `flowType: "pkce"` + `{{ .ConfirmationURL }}?code=` email template at the Shopify/Resend cutover (currently implicit OTP, fail-closed).
- **OTP rate-limiter** insertion cap on `/api/auth/otp` once live.
- Redirect allowlist for auth callbacks.

### C. Owner n8n decisions (publishing stays owner-authorized)
- **BC-03 intake mapping**: live BC-03 answered `{"status":"ignored","reason":"missing order_ref"}` to the app-shaped verify event — HMAC/transport fine, field mapping isn't. Either teach BC-03's intake the app shape or document the two shapes as separate consumers.
- **BC-03 portal-link variant**: add the `source='web'` portal-link branch and publish (draft was declined — the n8n API can't draft without overwriting the live workflow).

### D. Post-acceptance backlog (code, non-blocking)
1. **Renewal 15-min dedupe window** — a scripted client can currently grow the ledger / re-ping n8n per POST (BC-06 dedupes coach spam only).
2. **`integration_events` index migration** — hub queries filter on `payload->>'client_id'/'email'` (jsonb expressions, no index → sequential scans as the ledger grows).
3. **Mark-read UI toggle** — the notifications PATCH API exists; the view has no button consuming it yet.
4. **Admin i18n pass** — admin pages are English-only by convention (public site is fully EN/AR).
5. **Middleware coach-JWT page reachability** — `/admin/*` pages are gated on the `bc_admin` cookie only; coach JWTs work on all APIs (server-side role checks) but can't reach the pages.

### E. Known demo-mode allowances (by design)
- `/api/portal/renewal` without a session returns demo data (demo-only path).
- The anonymous demo photo bucket is shared across cookie-less visitors.

---

*Phase 3 status: complete — 21 commits, per-task reviews APPROVE, final integration review APPROVE-WITH-NOTES (0 blockers), migrations 001–004 applied live, merged to `main` and pushed to GitHub.*
