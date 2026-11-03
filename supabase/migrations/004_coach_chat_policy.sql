-- ==========================================================================
-- 004_coach_chat_policy.sql — coach reply INSERT parity for the unified
-- (web + telegram) chat thread.                   Phase 3 / Task 7 follow-up
--
-- WHY (deviation documented in .superpowers/.../task-7-report.md):
--   The admin Conversations route and the check-in review route reply as the
--   coach (`role='coach'`, `source='web'`) through the validated admin route's
--   SERVICE client, AFTER a route-level staff role check. That keeps coach
--   replies available today without widening RLS. This migration is the
--   strict-parity follow-up: it lets an AUTHENTICATED coach (JWT) insert their
--   own reply rows directly, scoped by the existing `can_access_client()`
--   helper (coach own assignments + active coach_assistant inheritance).
--
-- SAFETY:
--   * INSERT-only. No UPDATE/DELETE — chat history stays immutable to
--     authenticated users (matches 001/003).
--   * role is pinned to 'coach' and source pinned to 'web', so a client JWT
--     can never mint a coach/admin message (the client policy only allows
--     role='client').
--   * The target conversation must be the client's `web-{client_id}` sentinel
--     (source='web', chat_id=0) and the caller must pass can_access_client on
--     that client id.
--   * `can_access_client()` returns true for admins and for the owning client;
--     the extra role predicate restricts this policy to STAFF profiles only.
--
-- NOT APPLIED by the implementer — the controller applies migrations.
-- DOWN: supabase/migrations/rollback-pre-phase3/DOWN-004.sql
--       (drops bc_chat_messages_insert_coach; idempotent, no data change).
-- ==========================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name in ('conversation_id', 'role', 'source')
    group by table_name
    having count(*) = 3
  ) then
    raise warning '004: chat_messages columns incomplete — coach reply policy SKIPPED';
    return;
  end if;

  drop policy if exists bc_chat_messages_insert_coach on public.chat_messages;

  create policy bc_chat_messages_insert_coach on public.chat_messages
    for insert with check (
      role = 'coach'
      and source = 'web'
      -- staff only: never the owning client, never anon
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'coach', 'coach_assistant')
      )
      -- the conversation must be the client's own web sentinel
      and exists (
        select 1
        from public.chat_conversations c
        where c.conversation_id = chat_messages.conversation_id
          and c.source = 'web'
          and c.chat_id = 0
          and c.conversation_id ~ '^web-[0-9a-fA-F-]{36}$'
          and public.can_access_client(
                substring(c.conversation_id from '^web-(.*)$')::uuid
              )
      )
    );

  raise notice '004: bc_chat_messages_insert_coach CREATED';
end;
$$;

-- --------------------------------------------------------------------------
-- Verification (run manually, do not apply automatically):
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'chat_messages';
--
-- Expected: bc_chat_messages_select, bc_chat_messages_insert_client (from
-- 001/003) and bc_chat_messages_insert_coach (this file).
-- --------------------------------------------------------------------------
