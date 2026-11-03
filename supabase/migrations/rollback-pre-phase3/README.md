# Rollback — pre-Phase 3 restoration (Task 2)

Snapshot date: **2026-11-02** — the controller captured the schema snapshot of
the live Supabase project before applying the forward migrations
(`001_rbac.sql`, `002_storage.sql`, `003_columns.sql`). Every DOWN script
restores the state described by that snapshot.

## Run order

Reverse order only:

1. `DOWN-003.sql`
2. `DOWN-002.sql`
3. `DOWN-001.sql`

## What each script reverts

| Script | Reverts | Notes |
|---|---|---|
| `DOWN-003.sql` | Conditional column adds on `chat_conversations` (`chat_id`, `source`) and `chat_messages` (`conversation_id`, `role`, `source`) + deferred chat RLS policies | Column DROPs are laid out raw; **comment out every `DROP COLUMN` whose pre-existence is shown by the snapshot** — only drop columns 003 actually added. |
| `DOWN-002.sql` | 10 `storage.objects` policies + (opt-in) the two buckets `checkin-photos`, `onboarding-photos` | Bucket `delete` is commented out by default; run it only if you accept abandoning the objects under those buckets. |
| `DOWN-001.sql` | All `bc_*` DB policies, RLS enable/disable restores, guard + touch triggers and functions, the 7 helper functions, the `clients` additive columns, and the new 7 tables; and **re-GRANTs EXECUTE on the six RPCs** (`process_order_event`, `process_renewal_event`, `submit_checkin`, `submit_onboarding`, `get_checkin_form`, `upsert_lead`) to `anon, authenticated, public` to restore the pre-Phase-3 grant state. | Policy drop loop deletes names starting `bc_` — the controller snapshot shows no pre-existing `bc_*` policies in public as of 2026-11-02; re-verify if other migrations added any in between. |

## Explicit privileges restored by the DOWN scripts

- EXECUTE on `process_order_event`, `process_renewal_event`, `submit_checkin`,
  `submit_onboarding`, `get_checkin_form`, `upsert_lead` → re-granted to
  `anon`, `authenticated`, `public` (DOWN-001, step 5). This intentionally
  restores the state the forward migration calls a critical security bug —
  that restore is only correct as long as the application code consuming
  this rollback predates the RPC lock-down decision.
- RLS: tables that were RLS=true with zero policies pre-Phase 3
  (`chat_conversations`, `chat_messages`, `leads`, `sales_notifications`,
  `knowledge_base_items`, `telegram_webhook_update_claims`) are left RLS=true;
  tables that were RLS=false are disabled explicitly. `profiles`,
  `coach_clients`, `coach_assistants`, `checkin_reviews`,
  `subscription_events`, `notifications`, `automation_error_resolutions` did
  not exist pre-Phase 3 and are fully dropped.

## Accepted residue (cannot be reverted by plain SQL)

- Enum additions on `bc_client_status` (`needs_onboarding` guard-adds) —
  Postgres cannot drop enum values without a type swap; they are additive and
  harmless.
- Any rows inserted into the new tables or the private buckets before
  rollback (buckets: `delete` step is opt-in).
- Any `service_role` usage patterns introduced alongside the migration.

## Snapshot check reminder

Before running any DOWN script, diff the live output against the
controller's 2026-11-02 snapshot (`pg_dump --schema-only` capture) and pause
on any mismatch rather than forcing a drop.
