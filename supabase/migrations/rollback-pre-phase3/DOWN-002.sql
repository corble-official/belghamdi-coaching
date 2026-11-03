-- ==========================================================================
-- DOWN-002.sql — rollback of 002_storage.sql (Phase 3 / Task 2)
-- Run AFTER DOWN-003 and BEFORE DOWN-001 (reverse order 003 → 002 → 001).
-- ==========================================================================

-- 1. Drop the storage.objects policies created by 002
drop policy if exists bc_checkin_photos_select_own      on storage.objects;
drop policy if exists bc_checkin_photos_select_staff    on storage.objects;
drop policy if exists bc_checkin_photos_insert_own      on storage.objects;
drop policy if exists bc_checkin_photos_update_own      on storage.objects;
drop policy if exists bc_checkin_photos_delete_own      on storage.objects;
drop policy if exists bc_onboarding_photos_select_own   on storage.objects;
drop policy if exists bc_onboarding_photos_select_staff on storage.objects;
drop policy if exists bc_onboarding_photos_insert_own   on storage.objects;
drop policy if exists bc_onboarding_photos_update_own   on storage.objects;
drop policy if exists bc_onboarding_photos_delete_own   on storage.objects;

-- 2. Remove the buckets created by 002
-- SAFETY: deleting the bucket row does NOT delete underlying objects, but it
-- does orphan access (no bucket → no API access until remade). Only run this
-- step if the controller confirms the buckets contain no data worth keeping,
-- or if a full rollback is required by policy. Commented by default:
-- delete from storage.buckets where id in ('checkin-photos', 'onboarding-photos');
