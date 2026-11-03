-- ==========================================================================
-- DOWN-001.sql — rollback of 001_rbac.sql (Phase 3 / Task 2)
-- Run order for full rollback: DOWN-003 → DOWN-002 → DOWN-001.
-- Snapshot guard: controller captured the pre-migration schema snapshot on
-- 2026-11-02; DOWN scripts restore only objects/columns/policies that
-- snapshot shows did not exist before the forward migration.
-- ==========================================================================

----------------------------------------------------------------------------
-- 1. Drop policies created by 001
----------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and policyname like 'bc\_%' -- escape: only Phase-3 policies (001 names every policy it creates with a bc_ prefix)
  loop
    -- snapshot cross-check 2026-11-02: no pre-existing public policies start
    -- with bc_; if a later migration introduces other bc_* policies, review
    -- this loop before running.
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end;
$$;

----------------------------------------------------------------------------
-- 2. Restore RLS to the pre-migration state (snapshot 2026-11-02):
--   RLS=true, no policies (already restored by dropping our bc_* policies):
--     chat_conversations, chat_messages, leads, sales_notifications,
--     knowledge_base_items, telegram_webhook_update_claims
--     → leave ENABLED; do not disable them here.
--   RLS=false (pre-Phase 3): the tables below get disabled again.
alter table public.checkin_requests          disable row level security;
alter table public.checkin_submissions       disable row level security;
alter table public.client_subscriptions      disable row level security;
alter table public.clients                   disable row level security;
alter table public.communication_logs        disable row level security;
alter table public.automation_errors         disable row level security;
alter table public.integration_events        disable row level security;
alter table public.onboarding_requests       disable row level security;
alter table public.onboarding_submissions    disable row level security;
alter table public.follow_up_tasks           disable row level security;

-- NOTE: the disable above assumes 001 did not add other policies to these
-- tables (it added only bc_* ones, already dropped). Cross-check snapshot.

----------------------------------------------------------------------------
-- 3. Drop triggers + their functions
----------------------------------------------------------------------------
drop trigger if exists trg_bc_profiles_self_update_guard on public.profiles;
drop trigger if exists trg_bc_touch_updated_at on public.profiles;
drop trigger if exists trg_bc_touch_updated_at on public.checkin_reviews;
drop function if exists public.bc_profiles_self_update_guard();
drop function if exists public.bc_touch_updated_at();

----------------------------------------------------------------------------
-- 4. Drop helper functions
----------------------------------------------------------------------------
drop function if exists public.current_role_of();
drop function if exists public.is_admin();
drop function if exists public.owns_client(uuid);
drop function if exists public.is_coach_of(uuid);
drop function if exists public.can_access_client(uuid);
drop function if exists public.has_followup_access(uuid);
drop function if exists public.bc_can_read_conversation(text);

----------------------------------------------------------------------------
-- 5. Re-grant the RPC EXECUTE privileges 001 revoked (the CRITICAL fix is
--    being rolled back here by design — this restores the pre-Phase-3
--    grant state: EXECUTE to PUBLIC, which includes anon/authenticated).
--    Functions touched (any argument signature present):
--      process_order_event, process_renewal_event, submit_checkin,
--      submit_onboarding, get_checkin_form, upsert_lead
----------------------------------------------------------------------------
do $$
declare
  fn_name text := '';
  fn_oid record;
  sigs text[] := array[
    'process_order_event', 'process_renewal_event', 'submit_checkin',
    'submit_onboarding', 'get_checkin_form', 'upsert_lead'
  ];
begin
  foreach fn_name in array sigs loop
    for fn_oid in
      select p.oid, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn_name
    loop
      execute format(
        'grant execute on function public.%I(%s) to anon, authenticated, public',
        fn_name, fn_oid.args
      );
    end loop;
  end loop;
end;
$$;

----------------------------------------------------------------------------
-- 6. Drop clients columns added by 001 (snapshot-checked)
----------------------------------------------------------------------------
alter table public.clients
  drop column if exists shopify_customer_id,
  drop column if exists auth_user_id,
  drop column if exists onboarding_completed,
  drop column if exists email_collected_source;
-- NOTE: only if the controller's snapshot shows these columns did NOT exist
-- before 001. Enum guard-adds were value-additions only; enum values are
-- NOT removed (Postgres cannot drop enum values without a round-trip using
-- a new type; documented as accepted residue in the rollback README).

----------------------------------------------------------------------------
-- 7. Drop the new tables in reverse creation order
----------------------------------------------------------------------------
drop table if exists public.automation_error_resolutions;
drop table if exists public.notifications;
drop table if exists public.subscription_events;
drop table if exists public.checkin_reviews;
drop table if exists public.coach_assistants;
drop table if exists public.coach_clients;
drop table if exists public.profiles;
