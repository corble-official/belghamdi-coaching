# Belghamdi Coaching — Automation Series Guide
_Covers all 9 n8n workflows, how the forms work, every API endpoint, daily schedule, demo script, and maintenance._

---

## 1. What exists

| ID | Workflow | Role | Trigger |
|---|---|---|---|
| BC-01 | AI Sales Assistant v2 | Answers prospects in Egyptian Arabic, qualifies leads, alerts sales | Telegram messages to **@BelghamdiFull0x0101_bot** |
| BC-03 | Client Onboarding | Verified order → client record → 5-day onboarding form link | `POST /webhook/bc03-order-event` + daily sweep 18:30 |
| BC-04 | Weekly Check-in | Opens weekly check-in requests + serves the check-in webform | Daily sweep 09:00 + form webhooks |
| BC-05 | Missed Check-in Follow-up | 24h/48h reminders, 72h escalation to coach | Daily sweep 20:30 |
| BC-06 | Coach Tasks | Create/complete follow-up tasks + coach alert | `POST /webhook/bc06-task-event` |
| BC-07 | Renewals | 7/3/1-day reminders, expiry tasks, renewal/extension events | Daily sweep 10:00 + `POST /webhook/bc07-renewal-event` |
| BC-08 | Daily Report | One summary message with all KPIs | Daily 09:00 |
| BC-99 | Error Handler | Logs & alerts on ANY workflow failure | Automatic (`errorWorkflow` on all others) |

Editor links: `https://n8n.corble.net/workflow/<id>` (IDs above).

## 2. Telegram groups (notifications)

| Group | chat_id | What lands there |
|---|---|---|
| Belghamdi - Sales & lead | `-1003694741353` | BC-01: qualified leads, human-handoff requests |
| Belghamdi - Coach Ops | `-1003977860508` | BC-03/04/05/06/07: onboarding done, check-ins, missed escalations, task + renewal alerts |
| Belghamdi - Daily Report | `-1004466218595` | BC-08: 09:00 daily summary |
| Belghamdi - Alert & Errors | `-1004385158265` | BC-99: automation failure alerts |

Client-facing DMs go to the client's own `telegram_chat_id` (from their Telegram chat with the bot). During demo, client DMs are pointed at Coach Ops.

- Bot: **@BelghamdiFull0x0101_bot** — token in the n8n credential **BC01 Telegram v2**.
- ⚠️ Group chat-IDs must be **plain literal values** in Telegram nodes (not `={{ '...' }}` expressions) — string expressions break group sends.

## 3. Credentials (n8n)

| Credential | Type | Used for |
|---|---|---|
| BC01 Supabase v2 | supabaseApi | All REST/RPC calls (project `mqbyjshkocnkxfqoypyj`) |
| BC01 Telegram v2 | telegramApi | All Telegram sends + the Telegram Trigger for BC-01 |
| BC01 Groq v2 | groqApi | BC-01 LLM (`openai/gpt-oss-120b`) |

Secrets source (rotate!): `n8n/belghamdi-automation/MCP's.md`.

## 4. Daily timeline (Africa/Cairo — all automatic)

```
09:00  BC-08 Daily report  → Daily Report group
09:00  BC-04 check-in sweep → new check-in requests + invites to clients
10:00  BC-07 renewal sweep  → 7/3/1-day reminders + expiry-day coach task
20:30  BC-05 missed sweep   → 24h/48h reminders, 72h escalation (high-priority task + alert)
18:30  BC-03 onboarding sweep → 24h/48h form reminders, 72h escalation
```
Any failure anywhere → BC-99 logs it (deduped) and posts to Alert & Errors (escalation badge after 3 repeats).

## 5. The two forms (secure token links)

Both forms are n8n webhooks serving an HTML page; the token in the URL is the only credential and expires automatically.

### 5.1 Onboarding form (BC-03)
1. Payment/order verified → `POST /bc03-order-event`
2. BC-03 stores the client, opens `onboarding_requests` (token, 5-day expiry), and DMs the client:
   `https://n8n.corble.net/webhook/form/onboarding?t=<token>`
3. Client fills name/phone/email/goal/training days/location/experience + photos → submit
4. `POST /webhook/form/onboarding-submit?t=<token>` → stored in `onboarding_submissions`, client → `active`, coach task `onboarding` + alert in Coach Ops
5. Pending >24h → reminder 1; >48h → reminder 2; >72h → high-priority escalation

### 5.2 Weekly check-in form (BC-04)
1. Every day 09:00, for each active subscription due for its weekly check-in, BC-04 creates `checkin_requests` (token, 10-day expiry) and DMs:
   `https://n8n.corble.net/webhook/form/checkin?t=<token>`
2. Client fills weight, training days made, workout/nutrition %, energy, sleep, difficulties, feedback
3. Submit → `checkin_submissions` row + request `submitted` + open coach task `checkin_review` + alert
4. If ignored >24h (BC-05 20:30): reminder 1 → >48h reminder 2 → >72h high-priority `missed_checkin` escalation
5. Coach reviews submissions and completes tasks via the CRM/Sales channels (or API below)

## 6. HTTP API (all no auth — keep URLs private)

### BC-03 — order event (create / renew / cancel)
`POST https://n8n.corble.net/webhook/bc03-order-event`
```json
{
  "event_type": "order_verified", "provider": "internal",
  "order_ref": "ORD-1001", "package_id": "gold", "duration_days": 30,
  "customer_name": "محمد علي", "telegram_user_id": 731956856,
  "telegram_chat_id": 731956856, "email": "", "phone": "",
  "kind": null, "subscription_code": null
}
```
Idempotent on `order_ref` (`kind: renewal|cancel` with `subscription_code` also supported).

### BC-06 — coach task
`POST https://n8n.corble.net/webhook/bc06-task-event`
```json
{ "action": "upsert", "source_type": "automation", "source_id": "my-unique-ref",
  "client_code": "cl-demo-001", "category": "checkin_review",
  "priority": "high", "reason": "سبب المهمة" }
```
- `category` allowed: `checkin_review, missed_checkin, plan_update, renewal, manual_check, onboarding, general_support, automation`
- `action: complete` adds `notes` / `reviewed_by`.
- Upsert is idempotent on (`category`, `source_type`, `source_id`).

### BC-07 — renewal event (payment confirmed)
`POST https://n8n.corble.net/webhook/bc07-renewal-event`
```json
{ "event_type": "order_verified", "provider": "internal",
  "order_ref": "ORD-1002",
  "payload": { "subscription_code": "sub-demo-001", "new_end_date": "2026-12-31" } }
```
Extends the subscription end date and notifies the coach. Idempotent on `order_ref` (stored in `integration_events`).

### BC-01 — no HTTP; messaging the bot is the API.

## 7. Demo script

`n8n/run-demo.ps1` (same folder as this README):
```powershell
.\run-demo.ps1                          # webhooks only (BC-03 order, BC-06 tasks, BC-07 renewal)
.\run-demo.ps1 -InvokeAll               # + sweeps BC-03/04/05/07/08 now (asks for n8n API key)
.\run-demo.ps1 -InvokeAll -N8nApiKey "eyJ..."   # fully hands-off
```
Watch the 4 groups as it fires. Demo data in Supabase is seeded with `DEMO —` names (`cl-demo-001..005`, `demo-task-001/002`, subs `sub-demo-001..005`).

## 8. Training the AI (BC-01)
- Edit `knowledge_base_items` (Supabase). Every active row is loaded into the prompt each message — no redeploy needed. Keep titles short, `category` = topic (`pricing`, `packages`, `process`…), use `sort_order` for priority.
- Rules already enforced in code: replies must be Egyptian Arabic, price guard rejects any number not present in the KB, medical/payment questions force human handoff, Telegram profile names are never treated as confirmed names.
- Change the bot's personality/system prompt: BC-01 → `AI Sales Agent` node → `systemMessage`.

## 9. Database (Supabase) quick map
`clients`, `client_subscriptions`, `checkin_requests` (+`checkin_submissions`), `onboarding_requests` (+`onboarding_submissions`), `follow_up_tasks`, `integration_events`, `automation_errors`, `chat_conversations`/`chat_messages`, `leads`, `knowledge_base_items`, `sales_notifications`, `telegram_webhook_update_claims`, `communication_logs`.

## 10. Runbook / common issues
| Symptom | Cause | Fix |
|---|---|---|
| `Bad Request: chat not found` on a Telegram node | Wrong chat id or bot not member — or chat id wrapped in an expression | Use literal `-100...` value; add bot to the group |
| Telegram Trigger suddenly silent | Someone re-registered/detached the webhook | `getWebhookInfo` → URL must be `https://n8n.corble.net/webhook/ef5cc9a7-.../webhook` |
| Alert repeats | Same root error re-reaching BC-99 | It dedupes; check `automation_errors` (open/escalated) |
| Test a scheduled sweep manually | — | n8n UI "Test workflow", or `run-demo.ps1 -InvokeAll` |
| Rotate secrets | tokens are plaintext in `MCP's.md` | Rotate bot token / Supabase keys / Groq key, update n8n credentials |
| ⚠️ Security | RLS currently DISABLED on 10 CRM tables | Decide & add policies before going public |
