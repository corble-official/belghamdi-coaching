-- ==========================================================================
-- 004_provisioning.sql — Phase 3 / Task 2.5
-- Invitation state-machine columns on public.clients.
--
-- Scope (deliberately minimal):
--   * THREE additive columns on clients — exact names per brief:
--       invite_status       text    'pending'|'sent'|'accepted'|'failed'
--       invite_attempts     integer (retries used; cap enforced in app code)
--       invite_last_sent_at timestamptz
--     All writes happen via the SERVICE-ROLE path
--     (src/lib/provisioning/{provision-client,invite}.ts). NO new RLS
--     policies: clients already has SELECT-only policies for authenticated
--     roles and NO write policies (deny-by-default), which is exactly the
--     required posture — the invite state is service-owned.
--   * NO new functions are created, so NO RPC lock-down REVOKEs are needed
--     (001_rbac.sql convention: any future SECURITY DEFINER function must
--     REVOKE EXECUTE from anon/authenticated/public + GRANT to service_role).
--   * The `process_order_event` / `process_renewal_event` RPCs, the
--     automation_errors / n8n-owned data, and Task 7's separate
--     004_coach_chat_policy.sql (different tables) are untouched.
--
-- Run AFTER 001_rbac.sql, 002_storage.sql, 003_columns.sql.
-- Rollback: rollback-pre-phase3/DOWN-004-provisioning.sql (drops ONLY these
-- columns; DOWN-004.sql itself belongs to Task 7's 004_coach_chat_policy.sql).
-- ==========================================================================

----------------------------------------------------------------------------
-- 1. clients — invitation state columns (IF NOT EXISTS only)
----------------------------------------------------------------------------
alter table public.clients
  add column if not exists invite_status text not null default 'pending',
  add column if not exists invite_attempts integer not null default 0,
  add column if not exists invite_last_sent_at timestamptz;

----------------------------------------------------------------------------
-- 2. invite_status CHECK — added under a stable name even if the column
--    pre-existed without one (guard is idempotent; existing rows that
--    violate the vocabulary would make this fail loudly, which is the
--    desired behavior — the app only ever writes these four values).
----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clients_invite_status_chk'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_invite_status_chk
      check (invite_status in ('pending', 'sent', 'accepted', 'failed'));
    raise notice '004: clients_invite_status_chk CREATED';
  else
    raise notice '004: clients_invite_status_chk already present — untouched';
  end if;
end;
$$;

-- esc: this file creates ONLY:
--   * clients columns: invite_status (default 'pending', CHECK
--     clients_invite_status_chk), invite_attempts (default 0),
--     invite_last_sent_at
--   * no functions, no policies, no triggers, no grants
-- DOWN-004-provisioning.sql drops the three columns (the CHECK constraint
-- drops with its column automatically; DOWN-004.sql belongs to Task 7's
-- 004_coach_chat_policy.sql).
