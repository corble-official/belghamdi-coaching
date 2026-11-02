# DISCOVERY REPORT — Belghamdi Coaching n8n Client Operations Automation

**Instance:** https://n8n.corble.net (self-hosted, n8n behind nginx; workflow scopes include `workflow:export`)
**Inspection date:** 2026-11-01
**Method:** Read-only discovery via n8n MCP (`get_instance_context`, `search_workflows`, `get_workflow_details`, `list_credentials`, `list_workflow_tags`, `search_workflow_executions`, `get_workflow_execution`). No workflow was modified, activated, deactivated, renamed, or deleted. No credentials were created, edited, or revealed. No database writes were performed.

---

## 1. Workflow inventory (8 total)

| # | Workflow name | ID | Active | Triggers | Notes |
|---|---|---|---|---|---|
| 1 | **BC-01 \| Belghamdi AI Sales Assistant** | `UbWrogw0MfrKSaXM` | **YES (published)** | Telegram Trigger (`updates: ["message"]`) | The existing AI Sales Assistant. 34 nodes, last updated 2026-11-01T00:43Z. Full export at `backup/BC-01-belghamdi-ai-sales-assistant.json`. **DO NOT TOUCH.** |
| 2 | Real Estate - Lead Management (Intake, Assignment, Follow-up) | `3gq44Xg6y5XOj2mJ` | No | 2 webhooks (`/real-estate-lead`, `/lead-status`) + schedule | Unrelated template-style workflow (placeholder Supabase URL `https://YOUR_PROJECT_REF.supabase.co`, placeholder emails). 36 nodes. Not Belghamdi business logic. Has an Error Trigger → email admin pattern (SMTP unconfigured). |
| 3 | Real Estate + "My workflow 3" | `quwdluVdMyR0p8z2` | No | 1 | **Cannot inspect: `availableInMCP: false`** (MCP access toggle off). Name suggests an experiment, not production. |
| 4 | "real" | `YhtrVm0e5edyOdBF` | No | 0 | **Cannot inspect: `availableInMCP: false`**. |
| 5 | "My workflow 2" | `OXQFoByf2faV9nKg` | No | 0 | **Cannot inspect: `availableInMCP: false`**. |
| 6 | "My workflow" | `zBccaMco7k02MAZE` | No | 0 | **Cannot inspect: `availableInMCP: false`**. |
| 7 | "noooooor" | `BuZMbR60LAoCb6Rc` | No | 0 | Empty (0 nodes), created today. Junk. |
| 8 | "test test" | `uHu0xctFQCNk8yCa` | No | 0 | Empty (0 nodes), created today. Junk. |

**⚠ No "Order Registration" workflow exists in this n8n instance.** Nothing with order/payment/registration logic is present. The 4 MCP-disabled workflows are unverified; none is *named* order-related. This is the single most important open question for Part 2 (BC-03's trigger). See §5 blockers.

**No folders, no tags** exist on the instance (`list_workflow_tags` → 0; all `parentFolderId: null`).

## 2. BC-01 deep inspection (the only Belghamdi production workflow)

### 2.1 Trigger & flow
- **Telegram Trigger** (updates: `message`) → `Config` (non-secret settings) → `Normalize Webhook Update` (JS; ignores bots, non-private chats, non-text; computes `action: process|ignore`) → `Claim Webhook Update` (Supabase RPC **idempotency claim** on `update_id`) → IF claimed → Switch process/ignore → AI pipeline or completion.
- AI pipeline: `Normalize Message` → `Get Conversation History` (RPC) → `Already Completed?` → `Get Belghamdi Knowledge Base` (RPC) → `Build AI Context` (JS; assembles `<knowledge_base>`, `<existing_lead_profile>`, `<telegram_profile>`, `<conversation_history>`, `<new_customer_message>`; prompt-injection hardening) → **AI Sales Agent** (`@n8n/n8n-nodes-langchain.agent`, system prompt: Egyptian Arabic sales rules, safety limits, handoff conditions) → `Validate Structured Output` (JS; JSON coercion, intent/status whitelisting, **deterministic price guard** against knowledge-base numbers, phone/email validation, Arabic-digit normalization) → `Extract Lead Information` (JS; AI proposes, deterministic rules decide qualification) → `Lead Qualification` (IF) → `Upsert Lead` (RPC) → `Needs Sales Notification?` (IF) → `Build Sales Notification` → `Send Sales Notification` (Telegram) → `Evaluate Notification Result` → `Log Sales Notification` (RPC) → `Save Conversation` (RPC) → `Prepare Reply Chunks` (Telegram 4096-char chunking) → `Send Customer Reply` → completion.
- Completion: `Prepare Completion` / `Prepare Ignored Update` / `Send Fallback Message` → `Complete Webhook Update` (RPC).
- Failure path (centralized inside the workflow): every fallible node wired with `onError: continueErrorOutput` → `Format Failure` (sanitizes secrets via regex: bot tokens, JWTs, apikey/token patterns) → `Record Update Failure` (RPC incl. `p_max_attempts: 5` retry accounting) → `Dead Letter?` (IF) → `Send Fallback Message` (customer gets a polite Arabic "technique issue, team will contact you") → completion.

### 2.2 Supabase integration (credential-based, no secrets exposed)
- **Every DB operation is an RPC** via `POST {supabase_url}/rest/v1/rpc/<fn>` (HTTP Request node, `predefinedCredentialType: supabaseApi`, credential **"BC01 Supabase"** id `IT0NuubXg73ViM4g`).
- **RPC functions in use (existing — names are ground truth, do not invent others):**
  1. `claim_telegram_webhook_update(p_update_id)` → returns `claimed`
  2. `complete_webhook_update(p_update_id)`
  3. `get_conversation_context(p_chat_id, p_user_id, p_username, p_first_name, p_last_name, p_update_id, p_limit)` → `{ conversation_id, history[], lead, is_new_conversation, update_already_completed }`
  4. `get_knowledge_base()` → `{ items[{category,title,content}] }`
  5. `upsert_lead(p jsonb)` → `{ lead_id, lead_code, snapshot{…, has_contact}, should_notify, handoff_notify, lead_status }`
  6. `log_sales_notification(p_lead_id, p_qualified, p_handoff, p_success, p_error)`
  7. `save_conversation_turn(p_conversation_id, p_update_id, p_message_id, p_user_text, p_reply, p_intent, p_message_ts, p_metadata jsonb)`
  8. `record_update_failure(p_update_id, p_stage, p_error, p_max_attempts)` → returns `dead_letter`
- **Implied tables** (from call signatures only — schema not directly inspected): webhook-update ledger with idempotency (`update_id`, claimed/completed state), conversations/messages, leads (with `lead_code`, `lead_status ∈ new/collecting_information/qualified/contacted/converted/lost`, `qualification_score`, Telegram identity fields, contact fields `full_name/phone/email`, goal fields `fitness_goal/current_weight/target_weight/training_location/training_days/experience_level/interested_package`, `handoff_required`), knowledge base entries, sales-notification logs, update-failure/dead-letter ledger.
- **Supabase project URL** (non-secret, from BC-01 `Config`): `https://sjcclkozpmrjckahtcex.supabase.co` → project ref **`sjcclkozpmrjckahtcex`**.

### 2.3 Credentials present on instance (metadata only — 9 total)
| Credential | Type | ID | Owner project |
|---|---|---|---|
| BC01 Supabase | supabaseApi | `IT0NuubXg73ViM4g` | nour walled (QwLamip4MGlbYF4s) |
| BC01 Supabase | supabaseApi | `2Y5m6dSxIEFGkheo` | nour walled — **duplicate same-name credential ⚠** |
| BC01 Telegram | telegramApi | `1mATyViP1zAfLOTb` | nour walled |
| BC01 Groq | groqApi | `DKVZv9ikmrWImYkL` | nour walled (used by BC-01) |
| BC01 Groq | groqApi | `X3mOJBkpiNv6SCB3` | nour walled — **duplicate ⚠** |
| BC01 Groq | groqApi | `jU8WcnMd4urCp9Cm` | nour walled — **duplicate ⚠** |
| BC01 Google Gemini | googlePalmApi | `oVP3Y0WaGccH5Syv` | nour walled (node disabled) |
| Supabase account | supabaseApi | `rhnCo1p78xOoMVT9` | Mohamed Yousef (4DpqIVvKOtLn1kmn) — likely points at a *different* project |
| OpenRouter account | openRouterApi | `oGBeVe3EysIroKNK` | Mohamed Yousef — **not used by BC-01** |

### 2.4 Communication channels actually available (Part 2 rule: use only these)
1. **Telegram bot** ("BC01 Telegram" credential) — proven: customer replies, sales notifications to group chat `-1004475682811`.
2. **Email via `emailSend` node** — *pattern exists* only in the inactive Real Estate workflow with placeholder sender/recipient; **no SMTP credential is configured** on the instance. Treat email as **NOT available** until the user provisions SMTP creds.

### 2.5 Automation health / error handling (read-only evidence)
- No `errorWorkflow` is set on BC-01; BC-01 uses only its internal failure path (per-node `onError` + RPC failure ledger + dead-letter flag after 5 attempts).
- BC-01 ran **57× in the last day, 3 failures** (executions 40, 41, 42, webhook mode, 2026-10-31 ~23:30–23:41).
- **Root cause of all 3 failures (verified from execution #42):** `Normalize Webhook Update` returns `update_id: null` for *ignored* updates (e.g., non-text/bot/group messages), but the flow still runs `Claim Webhook Update` → RPC rejects with `400 P0001 "p_update_id is required"`. Known **BC-01 bug** — reported, **not fixed** (do-not-modify rule; it needs the user's or maintenance task's go-ahead).

## 3. Conventions to reuse (source of truth)
- HTTP Request + `predefinedCredentialType: supabaseApi` for ALL Supabase calls; RPCs over raw table access for business logic; idempotency via claim/complete RPC pattern keyed by an external event ID; `retryOnFail: true, maxTries: 3, waitBetweenTries: 2000` on DB calls; `onError: continueErrorOutput` on every fallible node; sanitized failure payloads (`Format Failure`-style stateless helper); JS Code nodes allowed (BC-01 style) with Arabic-digit normalization helpers; `executionOrder: "v1"`, no workflow-level `errorWorkflow` yet.

## 4. Integration event architecture status
- **No `integration_events`/event-dispatch table or dispatcher exists** in anything inspectable. No eventing between workflows today (BC-01 is self-contained). For Part 4 the events layer must be **created new** (this is allowed after approval: "propose and implement the necessary migration").

## 5. Blockers & items requiring your decision (per promptn8n.md lines 21–22, stop-and-report rule)

1. **BC-03 trigger dependency — where does Order Registration actually live?** It does not exist in n8n. Options: (a) it exists somewhere else (another system / Shopify-side / the Next.js app), and you tell me how to receive verified payment/order events (webhook?); (b) it is one of the 4 MCP-disabled workflows I could not inspect — **enable MCP access** on "My workflow 3" (`quwdluVdMyR0p8z2`) and "real" (`YhtrVm0e5edyOdBF`) so I can verify, or confirm they're junk; (c) order registration actually happens only manually/inside the store, and BC-03 needs a defined order-verified event contract that we design together.
2. **Supabase schema inspection blocked.** The coaching DB is project `sjcclkozpmrjckahtcex`. I have no read access path into it (the Supabase MCP configured in opencode points at a *different* project ref `jzmcdmszuxfhiabnmxim` and is not authenticated; the `supabaseApi` key inside n8n's credential refuses to be listed by design). To satisfy the read-only schema inspection I need one of: (a) Supabase MCP authed for project `sjcclkozpmrjckahtcex` (`opencode mcp auth supabase` + fix project_ref in the config), or (b) the Supabase **URL + service_role key dropped into `n8n/.secrets/`** files from where I can configure migration + schema checks, or (c) you paste/describe the schema (tables + RPC list) from the Supabase dashboard.
3. **Duplicate credentials on instance:** 1 duplicated Supabase + 3 "BC01 Groq" credentials; n8n binds new nodes to the most-recently-edited credential of a type by default, so this can silently split new workflows across two different Supabase keys (possibly different projects!). Recommend (user action, post-approval): keep exactly one `BC01 Supabase` (the one BC-01 actually uses, id `IT0NuubXg73ViM4g`) and consolidate Groq to one.
4. **Email is not a configured channel.** BC-03 invitation, BC-04 check-in link, BC-05/BC-07 reminders → all will go via the existing **Telegram bot** unless you provision SMTP (current design assumption: Telegram only, matching BC-01).
5. **Internal management channel** for BC-08 daily report + BC-99 error alerts: the sales group `-1004475682811` is the only existing group chat. Confirm you want these reports there, or give me a different operations chat ID.

## 6. What I did NOT do (compliance)
- No existing workflow edit/activate/publish/unpublish/delete/rename. No node settings changes. No credential create/update/share. No Supabase queries, migrations, or new workflows created. No test runs that message customers or mutate data. No `claim`/`complete` or other RPC write calls replayed.
- BC-01 export written to `backup/BC-01-belghamdi-ai-sales-assistant.json`. Real Estate workflow full JSON was captured in-session from `get_workflow_details`; it is inactive, pointer-editable placeholder content of no business value — say the word if you want it materialized too.

---

**Discovered system summary:** production = BC-01 (Telegram sales assistant over Supabase RPCs, hardened idempotency + internal failure branch); everything else is either unrelated (Real Estate), unreachable via MCP (4 junk-looking), or empty. The "Order Registration" workflow referenced by promptn8n.md is **not present**, and Supabase's actual schema is **not yet inspectable** — those are the two gates to clear before implementation can start without guessing.

**Awaiting your explicit approval + answers to §5 before proceeding to BC-03.**
