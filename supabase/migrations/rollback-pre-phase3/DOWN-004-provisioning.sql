-- ==========================================================================
-- DOWN-004-provisioning.sql — rollback of 004_provisioning.sql
-- (Phase 3 / Task 2.5)
--
-- NAMING NOTE: TWO forward migrations carry the 004 prefix —
--   004_coach_chat_policy.sql (Task 7)  → rollback: DOWN-004.sql
--   004_provisioning.sql      (Task 2.5) → rollback: this file
-- The two touch different tables; either rollback order is safe.
--
-- Drops ONLY the three invitation-state columns added to public.clients.
-- The clients_invite_status_chk CHECK constraint is dropped automatically
-- with its column. Nothing else was created by 004_provisioning.sql (no
-- functions, policies, triggers, or grants).
-- ==========================================================================

alter table public.clients
  drop column if exists invite_status,
  drop column if exists invite_attempts,
  drop column if exists invite_last_sent_at;
