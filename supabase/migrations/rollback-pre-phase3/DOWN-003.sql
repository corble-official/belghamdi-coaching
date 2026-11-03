-- ==========================================================================
-- DOWN-003.sql — rollback of 003_columns.sql (Phase 3 / Task 2)
-- Runs FIRST in the reverse chain: DOWN-003 → DOWN-002 → DOWN-001.
-- 003 conditionally created two kinds of things; both drops are guarded.
-- ==========================================================================

-- 1. Drop the deferred chat policies (conditional on creation; the DROPs are
--    safe if they were already created by 001 and removed by DOWN-001).
drop policy if exists bc_chat_messages_select         on public.chat_messages;
drop policy if exists bc_chat_messages_insert_client  on public.chat_messages;
drop policy if exists bc_chat_conversations_select         on public.chat_conversations;
drop policy if exists bc_chat_conversations_insert_client  on public.chat_conversations;

-- 2. Drop the columns 003 may have added — ONLY if the controller's
--    pre-migration schema snapshot (2026-11-02) shows the column did NOT
--    exist before the forward run. If the column pre-existed, dropping it
--    would destroy live data; verify against the snapshot first.
alter table public.chat_messages
  drop column if exists conversation_id, -- comment out unless snapshot says 003 added it
  drop column if exists role,            -- comment out unless snapshot says 003 added it
  drop column if exists source;          -- comment out unless snapshot says 003 added it

alter table public.chat_conversations
  drop column if exists chat_id,         -- comment out unless snapshot says 003 added it
  drop column if exists source;          -- comment out unless snapshot says 003 added it
