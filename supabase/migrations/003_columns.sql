-- ==========================================================================
-- 003_columns.sql — Phase 3 / Task 2
-- Column-level guards on LIVE tables + deferred chat policy creation.
--
-- Why this file exists: 001_rbac.sql creates the chat RLS policies only when
-- the live chat tables already expose the columns the policies reference
-- (conversation_id / source / chat_id / role). This file ADDS any of those
-- columns still missing (IF NOT EXISTS guards) and then creates the two
-- deferred policies, so the migration pair is correct for BOTH a live
-- schema that already matches the brief and one that does not.
--
-- Run AFTER 001_rbac.sql and 002_storage.sql.
-- Rollback: DOWN-003.sql (drops only what this file actually creates —
-- compare against the controller's pre-migration schema snapshot).
-- ==========================================================================

----------------------------------------------------------------------------
-- 1. chat_conversations — add ONLY if missing (brief: columns verified to
--    exist live; these guards are pure safety nets)
----------------------------------------------------------------------------
do $$
declare
  v_missing_chat_id boolean;
  v_missing_source  boolean;
begin
  select not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'chat_conversations'
             and column_name = 'chat_id'
         )
    into v_missing_chat_id;
  select not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'chat_conversations'
             and column_name = 'source'
         )
    into v_missing_source;

  if v_missing_chat_id then
    alter table public.chat_conversations
      add column chat_id bigint not null default 0;
    raise notice '003: chat_conversations.chat_id ADDED (pre-deployment had none)';
  else
    raise notice '003: chat_conversations.chat_id already present — untouched';
  end if;

  if v_missing_source then
    alter table public.chat_conversations
      add column source text not null default 'telegram';
    raise notice '003: chat_conversations.source ADDED (pre-deployment had none)';
  else
    raise notice '003: chat_conversations.source already present — untouched';
  end if;
end;
$$;

----------------------------------------------------------------------------
-- 2. chat_messages — add ONLY if missing. The brief confirms the policies
--    read/writes `role` and `source`. If the live table lacks any referenced
--    column it is added NULLABLE (we cannot know a default that matches the
--    live writer contract; the n8n writers already set these fields).
----------------------------------------------------------------------------
do $$
declare
  col record;
  v_missing text[] := '{}';
  c text;
begin
  for col in
    select c1.column_name
    from (values ('conversation_id'), ('role'), ('source')) as c1(column_name)
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'chat_messages'
        and column_name = c1.column_name
    )
  loop
    v_missing := array_append(v_missing, col.column_name);
    execute format(
      'alter table public.chat_messages add column %I text',
      col.column_name
    );
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise notice '003: chat_messages columns ADDED: %', v_missing;
  else
    raise notice '003: chat_messages columns already present — untouched';
  end if;
end;
$$;

----------------------------------------------------------------------------
-- 3. Deferred chat policies — created here ONLY IF 001 skipped them
--    (001 raises warnings and leaves them absent when referenced columns
--    were missing). Definitions are identical to 001's.
----------------------------------------------------------------------------
do $$
declare
  v_has_conversation_policy boolean;
  v_has_message_policy      boolean;
  v_cols_ok_conversations   boolean;
  v_cols_ok_messages        boolean;
begin
  select count(*) = 3 into v_cols_ok_conversations
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chat_conversations'
    and column_name in ('conversation_id', 'source', 'chat_id');

  select count(*) = 3 into v_cols_ok_messages
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chat_messages'
    and column_name in ('conversation_id', 'role', 'source');

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_conversations'
      and policyname = 'bc_chat_conversations_select'
  ) into v_has_conversation_policy;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_messages'
      and policyname = 'bc_chat_messages_select'
  ) into v_has_message_policy;

  if v_cols_ok_conversations and not v_has_conversation_policy then
    execute $p$
      create policy bc_chat_conversations_select on public.chat_conversations
        for select using (public.bc_can_read_conversation(conversation_id))
    $p$;
    execute $p$
      create policy bc_chat_conversations_insert_client on public.chat_conversations
        for insert with check (
          source = 'web'
          and chat_id = 0
          and conversation_id = 'web-' || (
            select p.client_id::text from public.profiles p
            where p.id = auth.uid() and p.client_id is not null
          )
        )
    $p$;
    raise notice '003: chat_conversations policies CREATED (deferred from 001)';
  else
    raise notice '003: chat_conversations policies already exist / columns absent — skipped';
  end if;

  if v_cols_ok_messages and not v_has_message_policy then
    execute $p$
      create policy bc_chat_messages_select on public.chat_messages
        for select using (public.bc_can_read_conversation(conversation_id))
    $p$;
    execute $p$
      create policy bc_chat_messages_insert_client on public.chat_messages
        for insert with check (
          role = 'client'
          and source = 'web'
          and public.bc_can_read_conversation(conversation_id)
          and conversation_id = 'web-' || (
            select p.client_id::text from public.profiles p
            where p.id = auth.uid() and p.client_id is not null
          )
        )
    $p$;
    raise notice '003: chat_messages policies CREATED (deferred from 001)';
  else
    raise notice '003: chat_messages policies already exist / columns absent — skipped';
  end if;
end;
$$;

----------------------------------------------------------------------------
-- 4. Deferred RLS enablement for chat tables — mirrors 001's enablement in
--    case 001's guard skipped the tables (idempotent either way).
----------------------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- esc: this file creates ONLY:
--   * chat_conversations: columns chat_id, source (if missing)
--   * chat_messages:      columns conversation_id, role, source (if missing)
--   * chat policies:      bc_chat_conversations_select / _insert_client,
--                         bc_chat_messages_select / _insert_client (if absent)
--   * RLS enablement on the two chat tables
-- DOWN-003.sql drops the columns ONLY where the controller's pre-migration
-- snapshot shows they did not exist before 003 ran.
