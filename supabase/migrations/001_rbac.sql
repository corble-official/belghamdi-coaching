-- ==========================================================================
-- 001_rbac.sql — Phase 3 / Task 2
-- RBAC foundation: hardened helpers, new tables, RLS policies, RPC lock-down.
--
-- Conventions
--   * Helper functions are SECURITY DEFINER + STABLE + `set search_path =
--     public, pg_temp` so RLS policies can call them without recursive
--     policy evaluation and without search-path hijacking.
--   * RLS is enable-by-default + explicit permissive policies (no PERMISSIVE
--     vs RESTRICTIVE mixing). Service-role and table owners bypass RLS, so
--     n8n / service-key writers keep working unchanged.
--   * Every statement is idempotent (IF NOT EXISTS / drop-if-exists / DO
--     guards) and safe via Supabase `execute_sql` (plain SQL + DO $$).
--
-- Order matters: 001 (this) -> 002_storage.sql -> 003_columns.sql.
-- Rollback: supabase/migrations/rollback-pre-phase3/DOWN-001.sql (last).
-- ==========================================================================

----------------------------------------------------------------------------
-- 0. Extensions
----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

----------------------------------------------------------------------------
-- 1. New tables
----------------------------------------------------------------------------

-- profiles — extends auth.users. (Live schema has NO profiles table today;
-- this is the single place top-level roles live.)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client'
    check (role in ('admin', 'coach', 'coach_assistant', 'client')),
  email text,
  full_name text,
  -- the admin/operator-linked business client (null for coaches/admins)
  client_id uuid unique references public.clients (id) on delete set null,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'Portal identities. role drives all RLS. capabilities jsonb reserved for '
  'fine-grained overrides. client_id binds a client-role user to exactly one '
  'public.clients row (unique).';

-- Defensive: if the table pre-existed with a narrower role CHECK (e.g. the
-- old ('client','coach','admin') vocabulary), widen it. Idempotent.
do $$
declare
  r record;
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
      and pg_get_constraintdef(con.oid) not ilike '%coach_assistant%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%coach_assistant%'
  ) then
    alter table public.profiles add constraint profiles_role_chk
      check (role in ('admin', 'coach', 'coach_assistant', 'client'));
  end if;
end;
$$;

-- Defensive: add any columns missing from a partially existing table.
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists client_id uuid
    references public.clients (id) on delete set null,
  add column if not exists capabilities jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- coach_clients — coach ↔ client assignment ledger.
create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, client_id)
);

-- coach_assistants — coach side inherits access to the coach's clients while
-- status='active'; revoking flips status to 'revoked' (rows are kept, never
-- re-granted silently — re-creating a row means a fresh grant).
create table if not exists public.coach_assistants (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references public.profiles (id) on delete cascade,
  assistant_profile_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (coach_profile_id, assistant_profile_id),
  check (coach_profile_id <> assistant_profile_id)
);

-- checkin_reviews — coach verdict on a check-in submission (state machine
-- pending -> approved|needs_work; kept as rows after client sub expiry).
create table if not exists public.checkin_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references public.checkin_submissions (id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'needs_work')),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- subscription_events — append-only lifecycle event ledger keyed off the
-- existing integration_events dedupe ledger id where applicable.
--   * order/conflict resolution: by occurred_at
--   * refund / dispute events WIN per affected period
--   * transactional processing happens in app code (Task 2.5)
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  event_id text, -- Shopify event / webhook id ('n/a' for operator actions)
  event_type text not null check (event_type in (
    'payment_verified', 'activated', 'cancelled', 'expired',
    'refunded_full', 'refunded_part', 'disputed', 'dispute_resolved',
    'extended', 'renewed',
    'manual_activated', 'manual_suspended', 'manual_extended', 'manual_revoked'
  )),
  source text not null default 'shopify'
    check (source in ('shopify', 'webhook', 'admin', 'system')),
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now(),
  payload_reference text, -- order / payment ref
  integration_event_id uuid references public.integration_events (id),
  idempotency_key text generated always as (
    coalesce(event_id, 'n/a') || ':' || event_type
  ) stored
    constraint subscription_events_idempotency_key_unique unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_subscription_events_client
  on public.subscription_events (client_id, occurred_at desc);

-- notifications — operator-visible notices (missing email, errors, override
-- requests, general). Audience is a ROLE, not a person: every admin sees
-- everything, coaches/coach-assistants see their own scope.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience_role text not null
    check (audience_role in ('admin', 'coach', 'coach_assistant')),
  client_id uuid references public.clients (id) on delete set null,
  kind text not null, -- e.g. 'missing_email', 'error', 'general', 'override_request'
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_audience_read
  on public.notifications (audience_role, read, created_at desc);

-- automation_error_resolutions — the ONLY app-facing write path around
-- automation_errors. `automation_errors` itself gets NO write path from the
-- app: the n8n automation creates rows with the service key, operators
-- annotate failures here, and the error row itself stays immutable to
-- authenticated users (SELECT admin-only policy below).
create table if not exists public.automation_error_resolutions (
  id uuid primary key default gen_random_uuid(),
  error_id uuid not null references public.automation_errors (id) on delete cascade,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now()
);

-- NOTE: helper functions live in section 2 AFTER the tables so that
-- create-or-replace never references a table that does not exist yet
-- (plain `create function` validates referenced relations at creation).

----------------------------------------------------------------------------
-- 2. Hardened RBAC helper functions
--    All: SECURITY DEFINER · STABLE · set search_path = public, pg_temp
--    so RLS policies can call them without recursive policy evaluation
--    and without search-path hijacking.
----------------------------------------------------------------------------

-- current_role_of(): the calling auth user's profiles.role
create or replace function public.current_role_of() returns text
language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end;
$$;

-- is_admin(): operator/owner role
create or replace function public.is_admin() returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  return public.current_role_of() = 'admin';
end;
$$;

-- owns_client(p_client_id): caller's profile is a client profile bound to
-- exactly that client row.
create or replace function public.owns_client(p_client_id uuid) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_client_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'client'
      and client_id = p_client_id
  );
end;
$$;

-- is_coach_of(p_client_id): caller's profile has role='coach' AND is
-- assigned to the client via coach_clients (role re-checked defensively so
-- a stale coach_clients row can never out-live a role change).
create or replace function public.is_coach_of(p_client_id uuid) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_client_id is null then
    return false;
  end if;
  return exists (
    select 1
    from public.coach_clients cc
    join public.profiles p on p.id = cc.profile_id
    where cc.profile_id = auth.uid()
      and p.role = 'coach'
      and cc.client_id = p_client_id
  );
end;
$$;

-- can_access_client(p_client_id): THE single entry point for all
-- client-scoped data policies.
--   owns_client OR is_coach_of
--   OR (role = 'coach_assistant' AND an ACTIVE coach_assistants row links me
--       to a coach who is assigned to p_client_id via coach_clients)
--   Admin is included implicitly (verified below by role dispatch).
create or replace function public.can_access_client(p_client_id uuid) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_role text;
begin
  if auth.uid() is null or p_client_id is null then
    return false;
  end if;
  v_role := public.current_role_of();

  if v_role = 'admin' then
    return true;
  end if;

  if v_role = 'client' then
    return exists (
      select 1 from public.profiles
      where id = auth.uid() and client_id = p_client_id
    );
  end if;

  if v_role = 'coach' then
    return exists (
      select 1
      from public.coach_clients cc
      join public.profiles p on p.id = cc.profile_id
      where cc.profile_id = auth.uid()
        and p.role = 'coach'
        and cc.client_id = p_client_id
    );
  end if;

  if v_role = 'coach_assistant' then
    return exists (
      select 1
      from public.coach_assistants ca
      join public.coach_clients cc on cc.profile_id = ca.coach_profile_id
      join public.profiles coach_p on coach_p.id = ca.coach_profile_id
      where ca.assistant_profile_id = auth.uid()
        and ca.status = 'active'
        -- Reviewer Minor #3: only trust the link while the coach side is
        -- still actually a coach — a stale row for a demoted coach grants
        -- nothing.
        and coach_p.role = 'coach'
        and cc.client_id = p_client_id
    );
  end if;

  return false;
end;
$$;

-- has_followup_access(p_client_id): DATABASE mirror of computeEntitlements()
-- in src/lib/supabase/entitlements.ts (access = deriveAccess(...)).
-- Mirrored access logic (MUST stay in sync — tested for parity in Task 11):
--   * subscription.status 'active'        -> full  (when end_date >= today)
--   * subscription.status 'cancelled'     -> full  (cancelled keeps full
--     access until the paid period ends: end_date >= current_date);
--     history-only once end_date has passed
--   * status 'expired'                    -> history_only, NOT full
--   * refunded / disputed / suspended     -> revoked/suspended, NOT full
--   * no subscription or pending          -> NOT full
-- Order/conflict resolution by occurred_at; refund/dispute wins per affected
-- period; transactional subscription processing happens in app code
-- (Task 2.5) — this function reads the resulting stored state only.
create or replace function public.has_followup_access(p_client_id uuid) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if p_client_id is null then
    return false;
  end if;
  return exists (
    select 1
    from public.client_subscriptions s
    where s.client_id = p_client_id
      and s.status::text in ('active', 'cancelled')
      and s.end_date is not null
      and s.end_date::date >= current_date
  );
end;
$$;

-- bc_can_read_conversation(p_conversation_id): shared readability test used
-- by the chat_conversations / chat_messages policies instead of repeating
-- the same predicate per-table.
create or replace function public.bc_can_read_conversation(p_conversation_id text)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_conversation_id is null then
    return false;
  end if;
  return exists (
    select 1
    from public.chat_conversations c
    where c.conversation_id = p_conversation_id
      and (
        public.is_admin()
        -- the conversation's owning client
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.client_id is not null
            and c.source = 'web'
            and c.chat_id = 0
            and c.conversation_id = 'web-' || p.client_id::text
        )
        -- coach / assistant of the conversation's owning client
        or exists (
          select 1 from public.profiles p
          where p.client_id is not null
            and c.source = 'web'
            and c.chat_id = 0
            and c.conversation_id = 'web-' || p.client_id::text
            and public.can_access_client(p.client_id)
        )
      )
  );
end;
$$;

----------------------------------------------------------------------------
-- 3. clients — additive columns (IF NOT EXISTS only) + enum guard
----------------------------------------------------------------------------
-- `clients.status` on the live DB is enum bc_client_status with observed
-- values ('needs_onboarding','onboarding','active'). The portal needs no NEW
-- values, but guard-add the three we depend on so a live type missing one
-- cannot break deployments (ADD VALUE IF NOT EXISTS only fires when missing).
alter table public.clients
  add column if not exists shopify_customer_id bigint unique,
  add column if not exists auth_user_id uuid,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists email_collected_source text;

do $$
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'bc_client_status' and n.nspname = 'public'
  ) then
    execute $e$
      alter type public.bc_client_status add value if not exists 'needs_onboarding';
      alter type public.bc_client_status add value if not exists 'onboarding';
      alter type public.bc_client_status add value if not exists 'active';
    $e$;
  else
    raise notice 'bc_client_status enum not found; skipping guard-adds';
  end if;
end;
$$;

----------------------------------------------------------------------------
-- 4. updated_at trigger machinery (own function — do not depend on the
--    legacy public.touch_updated_at interface)
----------------------------------------------------------------------------
create or replace function public.bc_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bc_touch_updated_at on public.profiles;
create trigger trg_bc_touch_updated_at before update on public.profiles
  for each row execute function public.bc_touch_updated_at();

drop trigger if exists trg_bc_touch_updated_at on public.checkin_reviews;
create trigger trg_bc_touch_updated_at before update on public.checkin_reviews
  for each row execute function public.bc_touch_updated_at();

----------------------------------------------------------------------------
-- 5. Self-escalation guard
--    RLS WITH CHECK cannot reference OLD (to compare against the stored
--    row), so the enforcement is a BEFORE UPDATE trigger: any authenticated
--    self-update by a non-admin is rejected if it tries to change role,
--    client_id, or capabilities. The RLS UPDATE policy then only constrains
--    WHO can update (id = auth.uid()) — field-level integrity lives here.
--    Service-key / postgres callers bypass RLS and are untouched because
--    auth.uid() is null for them.
----------------------------------------------------------------------------
create or replace function public.bc_profiles_self_update_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and not public.is_admin() then
    if new.role is distinct from old.role
      or new.client_id is distinct from old.client_id
      or new.capabilities is distinct from old.capabilities then
      raise exception
        'self-escalation guard: only admin (service path) may change role, '
        'client_id or capabilities; requested change on profiles row % was denied',
        old.id
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bc_profiles_self_update_guard on public.profiles;
create trigger trg_bc_profiles_self_update_guard
  before update on public.profiles
  for each row execute function public.bc_profiles_self_update_guard();

----------------------------------------------------------------------------
-- 6. RLS enablement — LAST within this file, grouped in brief-mandated
--    order: assignments first, then client family, then the rest.
----------------------------------------------------------------------------

-- 6a. assignment tables
alter table public.coach_clients   enable row level security;
alter table public.coach_assistants enable row level security;

drop policy if exists bc_coach_clients_select on public.coach_clients;
create policy bc_coach_clients_select on public.coach_clients
  for select using (
    public.is_admin() or profile_id = auth.uid()
  );

drop policy if exists bc_coach_clients_insert on public.coach_clients;
create policy bc_coach_clients_insert on public.coach_clients
  for insert with check (
    -- admins use the service path, but keep the policy complete for
    -- authenticated-admin rows; coaches may self-assign their clients.
    (public.current_role_of() in ('admin', 'coach') and profile_id = auth.uid())
    -- coach_assistants can NEVER write these tables (no policy = deny).
  );

drop policy if exists bc_coach_clients_update on public.coach_clients;
create policy bc_coach_clients_update on public.coach_clients
  for update using (
    public.current_role_of() in ('admin', 'coach') and profile_id = auth.uid()
  );

drop policy if exists bc_coach_clients_delete on public.coach_clients;
create policy bc_coach_clients_delete on public.coach_clients
  for delete using (
    public.current_role_of() in ('admin', 'coach') and profile_id = auth.uid()
  );

drop policy if exists bc_coach_assistants_select on public.coach_assistants;
create policy bc_coach_assistants_select on public.coach_assistants
  for select using (
    public.is_admin()
    or coach_profile_id = auth.uid()
    or assistant_profile_id = auth.uid()
  );

drop policy if exists bc_coach_assistants_insert on public.coach_assistants;
create policy bc_coach_assistants_insert on public.coach_assistants
  for insert with check (
    -- coach links their own assistants; admin via service path
    (public.current_role_of() = 'coach' and coach_profile_id = auth.uid())
  );

drop policy if exists bc_coach_assistants_update on public.coach_assistants;
create policy bc_coach_assistants_update on public.coach_assistants
  for update using (
    (public.current_role_of() = 'coach' and coach_profile_id = auth.uid())
  );

drop policy if exists bc_coach_assistants_delete on public.coach_assistants;
create policy bc_coach_assistants_delete on public.coach_assistants
  for delete using (
    (public.current_role_of() = 'coach' and coach_profile_id = auth.uid())
  );

-- 6b. clients / client_subscriptions / profiles (client family)
alter table public.clients enable row level security;
drop policy if exists bc_clients_select on public.clients;
create policy bc_clients_select on public.clients
  for select using (
    public.is_admin() or public.can_access_client(id)
  );
-- writes: none for authenticated (service path owns client records)

alter table public.client_subscriptions enable row level security;
drop policy if exists bc_client_subscriptions_select on public.client_subscriptions;
create policy bc_client_subscriptions_select on public.client_subscriptions
  for select using (public.can_access_client(client_id));
-- writes: none (service path, fleet of n8n flows)

-- profiles RLS enablement + policies ride the client family block per the
-- brief's ordering; all profile policies live here in one place.
alter table public.profiles enable row level security;

drop policy if exists bc_profiles_select on public.profiles;
create policy bc_profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or (client_id is not null and public.can_access_client(client_id))
  );

drop policy if exists bc_profiles_insert_self on public.profiles;
create policy bc_profiles_insert_self on public.profiles
  for insert with check (
    -- signup cannot mint privilege: self-registrations are role='client',
    -- empty capabilities, and cannot claim a client binding (that binding is
    -- created by the admin/service path).
    id = auth.uid()
    and role = 'client'
    and capabilities = '{}'::jsonb
    and client_id is null
  );

drop policy if exists bc_profiles_update_self on public.profiles;
create policy bc_profiles_update_self on public.profiles
  -- field-level integrity enforced by trg_bc_profiles_self_update_guard
  -- (RLS WITH CHECK cannot consult OLD).
  for update using (id = auth.uid());

-- no delete policy for profiles: deny-by-default (account removal arrives
-- via auth.users cascade, which is a service-path operation).

-- 6d. check-ins
alter table public.checkin_requests enable row level security;
drop policy if exists bc_checkin_requests_select on public.checkin_requests;
create policy bc_checkin_requests_select on public.checkin_requests
  for select using (public.can_access_client(client_id));
-- writes: none (n8n scheduling owns check-in requests)

alter table public.checkin_submissions enable row level security;
drop policy if exists bc_checkin_submissions_select on public.checkin_submissions;
create policy bc_checkin_submissions_select on public.checkin_submissions
  for select using (public.can_access_client(client_id));

drop policy if exists bc_checkin_submissions_insert_client on public.checkin_submissions;
create policy bc_checkin_submissions_insert_client on public.checkin_submissions
  for insert with check (
    public.owns_client(client_id)
    and (
      -- entitlement mirror gate (see has_followup_access)
      public.has_followup_access(client_id)
      -- onboarding path: pending onboarding clients submit regardless of sub
      or exists (
        select 1 from public.clients c
        where c.id = checkin_submissions.client_id
          and c.status::text in ('needs_onboarding', 'onboarding')
      )
    )
  );
-- UPDATE/DELETE: service only (review state lives in checkin_reviews)

alter table public.checkin_reviews enable row level security;
drop policy if exists bc_checkin_reviews_select on public.checkin_reviews;
create policy bc_checkin_reviews_select on public.checkin_reviews
  for select using (
    public.is_admin()
    or public.can_access_client(
         (select client_id from public.checkin_submissions s
          where s.id = checkin_reviews.submission_id)
       )
  );

drop policy if exists bc_checkin_reviews_insert_coach on public.checkin_reviews;
create policy bc_checkin_reviews_insert_coach on public.checkin_reviews
  for insert with check (
    public.is_admin()
    or public.is_coach_of(
         (select client_id from public.checkin_submissions s
          where s.id = checkin_reviews.submission_id)
       )
  );

drop policy if exists bc_checkin_reviews_update_coach on public.checkin_reviews;
create policy bc_checkin_reviews_update_coach on public.checkin_reviews
  for update using (
    public.is_admin()
    or public.is_coach_of(
         (select client_id from public.checkin_submissions s
          where s.id = checkin_reviews.submission_id)
       )
  );

-- 6e. chat — policies are created ONLY when the referenced columns exist
--     (conversation_id / source / chat_id / role). If a live column is
--     missing, 003_columns.sql adds it and then creates the deferred
--     policies. This keeps 001 runnable against the live schema regardless.
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

do $$
declare
  v_cols_conv boolean;
  v_cols_msg  boolean;
begin
  select count(*) = 3 into v_cols_conv
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chat_conversations'
    and column_name in ('conversation_id', 'source', 'chat_id');

  select count(*) = 3 into v_cols_msg
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chat_messages'
    and column_name in ('conversation_id', 'role', 'source');

  if v_cols_conv then
    drop policy if exists bc_chat_conversations_select on public.chat_conversations;
    create policy bc_chat_conversations_select on public.chat_conversations
      for select using (public.bc_can_read_conversation(conversation_id));

    drop policy if exists bc_chat_conversations_insert_client on public.chat_conversations;
    create policy bc_chat_conversations_insert_client on public.chat_conversations
      for insert with check (
        -- own sentinel web conversation only: 'web-{my client id}', chat_id=0.
        -- n8n telegram conversations (source='telegram') stay service-only.
        source = 'web'
        and chat_id = 0
        and conversation_id = 'web-' || (
          select p.client_id::text from public.profiles p
          where p.id = auth.uid() and p.client_id is not null
        )
      );
    -- UPDATE/DELETE: none (service path only)
  else
    raise warning '001: chat_conversations columns incomplete — chat policies DEFERRED to 003_columns.sql';
  end if;

  if v_cols_msg then
    drop policy if exists bc_chat_messages_select on public.chat_messages;
    create policy bc_chat_messages_select on public.chat_messages
      for select using (public.bc_can_read_conversation(conversation_id));

    drop policy if exists bc_chat_messages_insert_client on public.chat_messages;
    create policy bc_chat_messages_insert_client on public.chat_messages
      for insert with check (
        -- clients may only append client-role messages into their OWN web
        -- thread; clients must NEVER insert role='coach'/'admin' rows.
        role = 'client'
        and source = 'web'
        and public.bc_can_read_conversation(conversation_id)
        and conversation_id = 'web-' || (
          select p.client_id::text from public.profiles p
          where p.id = auth.uid() and p.client_id is not null
        )
      );
    -- UPDATE/DELETE: none — chat history is immutable to authenticated users.
  else
    raise warning '001: chat_messages columns incomplete — chat policies DEFERRED to 003_columns.sql';
  end if;
end;
$$;

-- 6f. onboarding
alter table public.onboarding_requests enable row level security;
drop policy if exists bc_onboarding_requests_select on public.onboarding_requests;
create policy bc_onboarding_requests_select on public.onboarding_requests
  for select using (public.can_access_client(client_id));
-- writes: none (n8n owns the request lifecycle)

alter table public.onboarding_submissions enable row level security;
drop policy if exists bc_onboarding_submissions_select on public.onboarding_submissions;
create policy bc_onboarding_submissions_select on public.onboarding_submissions
  for select using (
    public.is_admin()
    or public.can_access_client(
         (select r.client_id from public.onboarding_requests r
          where r.id = onboarding_submissions.request_id)
       )
  );

drop policy if exists bc_onboarding_submissions_insert_client on public.onboarding_submissions;
create policy bc_onboarding_submissions_insert_client on public.onboarding_submissions
  for insert with check (
    -- own submission only: the request's client must be the caller's client.
    -- UPDATE path stays service-only (no update policy = deny).
    public.owns_client(
      (select r.client_id from public.onboarding_requests r
       where r.id = onboarding_submissions.request_id)
    )
  );

-- 6g. coach workspace
alter table public.follow_up_tasks enable row level security;
drop policy if exists bc_follow_up_tasks_select on public.follow_up_tasks;
create policy bc_follow_up_tasks_select on public.follow_up_tasks
  for select using (
    public.is_admin()
    or (public.can_access_client(client_id) and public.has_followup_access(client_id))
  );
-- writes: none at authenticated level (coach actions land via validated
-- admin routes ⇒ service path). has_followup_access keeps coach history
-- read-only semantics aligned with computeEntitlements.

alter table public.communication_logs enable row level security;
drop policy if exists bc_communication_logs_select on public.communication_logs;
create policy bc_communication_logs_select on public.communication_logs
  for select using (
    public.is_admin() or public.can_access_client(client_id)
  );

drop policy if exists bc_communication_logs_insert_coach on public.communication_logs;
create policy bc_communication_logs_insert_coach on public.communication_logs
  for insert with check (
    public.is_admin() or public.is_coach_of(client_id)
  );
-- UPDATE/DELETE: none (log is append-only)

-- 6h. service-only tables (RLS on, NO policies ⇒ deny all authenticated;
--     service-role key and table owner bypass RLS)
alter table public.integration_events enable row level security;
-- integration_events was RLS=false; flipping to true with zero policies
-- preserves the service-only effective behavior now formalized here.

alter table public.automation_errors enable row level security;
drop policy if exists bc_automation_errors_select_admin on public.automation_errors;
create policy bc_automation_errors_select_admin on public.automation_errors
  for select using (public.is_admin());
-- INSERT/UPDATE/DELETE: none — service path only (n8n is the writer).

-- IoT-ish/webhook tables keep their pre-existing zero-policy posture. These
-- already have RLS = true with no policies; do NOT touch (recorded here for
-- the audit trail): public.sales_notifications, public.leads,
-- public.knowledge_base_items, public.telegram_webhook_update_claims.

-- 6i. Phase-3 new service/operator tables
alter table public.automation_error_resolutions enable row level security;
drop policy if exists bc_aer_select_admin on public.automation_error_resolutions;
create policy bc_aer_select_admin on public.automation_error_resolutions
  for select using (public.is_admin());

drop policy if exists bc_aer_insert_admin on public.automation_error_resolutions;
create policy bc_aer_insert_admin on public.automation_error_resolutions
  -- Review finding: INSERT is admin-only. The previous `resolved_by =
  -- auth.uid()` branch let ANY authenticated client-role user fabricate
  -- audit rows. Operators record resolutions via the admin/service path.
  for insert with check (public.is_admin());
-- UPDATE/DELETE: none (audit trail immutable once written)

alter table public.notifications enable row level security;
drop policy if exists bc_notifications_select_staff on public.notifications;
create policy bc_notifications_select_staff on public.notifications
  for select using (
    -- admins see everything; coaches/assistants see their audience rows
    public.current_role_of() = 'admin'
    or (public.current_role_of() in ('coach', 'coach_assistant')
        and audience_role in ('coach', 'coach_assistant'))
  );
-- INSERT: none at authenticated level — validated admin routes write via the
-- service path (unfiltered notification writes would be spoofable).

alter table public.subscription_events enable row level security;
drop policy if exists bc_subscription_events_select on public.subscription_events;
create policy bc_subscription_events_select on public.subscription_events
  for select using (
    public.is_admin() or public.can_access_client(client_id)
  );
-- writes: none (ledger is service-written by Task 2.5 processing)

----------------------------------------------------------------------------
-- 7. RPC lock-down — CRITICAL security fix
--    SECURITY DEFINER RPCs were EXECUTE-granted to PUBLIC/anon/authenticated:
--    any internet client could invoke privileged webhook/check-in/lead
--    flows. Revoke from every caller except the service path.
--    Signatures confirmed via pg_proc patterns; every argument variant
--    present is revoked.
----------------------------------------------------------------------------
do $$
declare
  fn_name text := '';
  fn_oid record;
  sigs text[] := array[
    'process_order_event', 'process_renewal_event', 'submit_checkin',
    'submit_onboarding', 'get_checkin_form', 'upsert_lead'
  ];
  arg_signature text;
begin
  foreach fn_name in array sigs loop
    for fn_oid in
      select p.oid, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn_name
    loop
      arg_signature := fn_oid.args;
      execute format(
        'revoke execute on function public.%I(%s) from anon, authenticated, public',
        fn_name, arg_signature
      );
      -- keep the service path working
      execute format(
        'grant execute on function public.%I(%s) to service_role',
        fn_name, arg_signature
      );
      raise notice 'locked down public.%(%)', fn_name, arg_signature;
    end loop;
    if fn_oid.oid is null then
      raise warning 'function public.% not found for RPC lock-down', fn_name;
    end if;
    fn_oid := null;
  end loop;
end;
$$;

-- esc: any future SECURITY DEFINER function must follow this pattern:
--   revoke from anon/authenticated/public + explicit grant to service_role.
