-- Migration: Storage RLS — restrict writes to bucket 'incidents-photos' to authenticated users.
-- Date: 2026-04-21
-- Purpose (Path A of Vuln #5): Block anonymous INSERT/UPDATE/DELETE on storage.objects
--   for bucket 'incidents-photos'. Anyone using just the anon key (no Supabase session)
--   can no longer upload files. SELECT is deliberately left as-is here; the follow-up
--   migration (2026-04-21_storage_private.sql, Path B) makes the bucket fully private.

-- Prerequisites:
--   * Bucket 'incidents-photos' already exists.
--   * Anonymous Sign-Ins are enabled (see 2026-04-20_enable_rls.sql header).

-- How to run:
-- 1. Supabase dashboard → SQL Editor
-- 2. Paste this file → Run
-- 3. Verify in dashboard → Storage → Policies: three policies named
--    incidents_photos_{insert,update,delete}_authenticated are listed.

-- Drop prior versions of these policies if re-running
DROP POLICY IF EXISTS "incidents_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_delete_authenticated" ON storage.objects;

-- Allow authenticated users to upload/overwrite/delete in this bucket only.
CREATE POLICY "incidents_photos_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incidents-photos');

CREATE POLICY "incidents_photos_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'incidents-photos')
  WITH CHECK (bucket_id = 'incidents-photos');

CREATE POLICY "incidents_photos_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incidents-photos');

-- Rollback (if needed):
-- DROP POLICY IF EXISTS "incidents_photos_insert_authenticated" ON storage.objects;
-- DROP POLICY IF EXISTS "incidents_photos_update_authenticated" ON storage.objects;
-- DROP POLICY IF EXISTS "incidents_photos_delete_authenticated" ON storage.objects;
