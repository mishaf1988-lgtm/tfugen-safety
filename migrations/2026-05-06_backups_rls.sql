-- Migration: RLS policy on the `backups` bucket
-- Date: 2026-05-06
-- Phase 3 of the backup story: the browser app needs to LIST and READ
-- objects in the private `backups` bucket so it can mirror them to
-- OneDrive when the user opens the app. Adds a SELECT policy for the
-- `authenticated` role (any signed-in user via Supabase Auth) scoped
-- to bucket_id='backups'.
--
-- The bucket itself remains PRIVATE — only signed-in app users can
-- list/download. The Cloudflare Worker uses the service_role key
-- which bypasses RLS, so it can keep writing as before.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'tapugan_auth_read_backups'
  ) THEN
    CREATE POLICY tapugan_auth_read_backups
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'backups');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify (optional):
-- SELECT polname FROM pg_policy WHERE polname = 'tapugan_auth_read_backups';
-- Expected: 1 row.

-- Rollback:
-- DROP POLICY IF EXISTS tapugan_auth_read_backups ON storage.objects;
