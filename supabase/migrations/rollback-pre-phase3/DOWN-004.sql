-- ==========================================================================
-- DOWN-004.sql — rollback of 004_coach_chat_policy.sql (Phase 3 / Task 7)
-- Runs FIRST in the reverse chain: DOWN-004 → DOWN-003 → DOWN-002 → DOWN-001.
-- 004 only adds one INSERT policy; no schema/data changes. Idempotent.
-- ==========================================================================

drop policy if exists bc_chat_messages_insert_coach on public.chat_messages;
