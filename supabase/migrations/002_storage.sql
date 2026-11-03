-- ==========================================================================
-- 002_storage.sql — Phase 3 / Task 2
-- Private storage buckets for client-submitted photos + owner-prefix RLS on
-- storage.objects.
--
-- Ownership model (folder-prefix = client identity):
--   * Clients upload ONLY under the folder named after THEIR OWN
--     public.clients.id, i.e. `checkin-photos/<client_id>/...`.
--     The folder name doubles as the authorization key, so objects can
--     never be re-homed into another client's folder by renaming paths.
--   * The client's `profiles.client_id` drives the check: foldername[1]
--     must equal the caller's own bound client id.
--   * Coaches / assistants / admins gain read-only object access by
--     resolving foldername[1] to a client row they can access via
--     can_access_client() (the same single entry point used by all data
--     policies). They never write into the buckets at authenticated level.
--   * n8n / webhook flows keep using the service key, which bypasses
--     bucket policies.
-- Run AFTER 001_rbac.sql (policies reference profiles / helpers).
-- ==========================================================================

----------------------------------------------------------------------------
-- 1. Buckets (private, insert-idempotent)
----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('checkin-photos', 'checkin-photos', false),
  ('onboarding-photos', 'onboarding-photos', false)
on conflict (id) do nothing;

-- NOTE: deliberately no file_size_limit / allowed_mime_types: those change
-- validation behavior for EXISTING upload flows; tighten in a follow-up
-- migration after the app passes the client-side validators (tracked with
-- Task 4 / controller feedback).

----------------------------------------------------------------------------
-- 2. storage.objects policies (owner-prefix model)
--    storage.foldername(name)[1] = the first path segment = client id.
--    User-selected folder references inside policies use the
--    storage foldername helper exactly as Supabase storage RLS expects.
--    NOTE: storage.objects rows are keyed by bucket 'id'.
--    NOTE: policies are for role `authenticated` (create policy ... on
--    storage.objects applies to all roles the statement grants; explicit
--    `to authenticated` keeps anon fully denied).
----------------------------------------------------------------------------

-- ---------------- checkin-photos ----------------

drop policy if exists bc_checkin_photos_select_own on storage.objects;
create policy bc_checkin_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_checkin_photos_select_staff on storage.objects;
create policy bc_checkin_photos_select_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and exists (
      select 1
      from public.profiles p
      where p.client_id::text = (storage.foldername(name))[1]
        and public.can_access_client(p.client_id)
        -- can_access_client() already grants the OWNING client (owns_client)
        -- as well as admins/coaches/assistants; that is intended: a client
        -- can always read their own photos even before profiles round-trips.
    )
  );
-- staff read-only: no insert/update/delete policy for staff at all — reviews
-- happen in-app on data rows, never by reshuffling the object store.

drop policy if exists bc_checkin_photos_insert_own on storage.objects;
create policy bc_checkin_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'checkin-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_checkin_photos_update_own on storage.objects;
create policy bc_checkin_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'checkin-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_checkin_photos_delete_own on storage.objects;
create policy bc_checkin_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'checkin-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

-- ---------------- onboarding-photos ----------------

drop policy if exists bc_onboarding_photos_select_own on storage.objects;
create policy bc_onboarding_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'onboarding-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_onboarding_photos_select_staff on storage.objects;
create policy bc_onboarding_photos_select_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'onboarding-photos'
    and exists (
      select 1
      from public.profiles p
      where p.client_id::text = (storage.foldername(name))[1]
        and public.can_access_client(p.client_id)
    )
  );

drop policy if exists bc_onboarding_photos_insert_own on storage.objects;
create policy bc_onboarding_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'onboarding-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_onboarding_photos_update_own on storage.objects;
create policy bc_onboarding_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'onboarding-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

drop policy if exists bc_onboarding_photos_delete_own on storage.objects;
create policy bc_onboarding_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'onboarding-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.client_id is not null
        and (storage.foldername(name))[1] = p.client_id::text
    )
  );

-- esc: anonymous users get NOTHING on these buckets (no `to anon` policies).
-- Signed URLs still work for the service/admin route generators.
