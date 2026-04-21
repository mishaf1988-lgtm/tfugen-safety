-- Migration: Make storage bucket 'incidents-photos' fully private (Path B of Vuln #5).
-- Date: 2026-04-21
-- Purpose: Stop serving files at /object/public/... URLs. After this migration the
--   bucket requires a valid signed URL (or an authenticated session) to read.
--   The client generates signed URLs (1h TTL) on demand via _sign()/_signifyDom().

-- Prerequisites:
--   * Run 2026-04-21_storage_rls_writes.sql first (writes already restricted).
--   * Deploy the matching index.html that uses data-sign + _signifyDom(), otherwise
--     previously-rendered <img>/<a> will 400.

-- How to run:
-- 1. Supabase dashboard → SQL Editor → paste → Run
-- 2. Dashboard → Storage → bucket 'incidents-photos' → Settings → "Public" shows OFF
-- 3. Dashboard → Storage → Policies: a SELECT policy for authenticated is listed.

-- Flip bucket to private.
UPDATE storage.buckets
   SET public = false
 WHERE id = 'incidents-photos';

-- Allow authenticated users to read objects in this bucket.
-- (Signed URLs bypass RLS by design, so they will continue to work for unauthenticated
-- image loads in <img> tags as long as the token query param is valid.)
DROP POLICY IF EXISTS "incidents_photos_select_authenticated" ON storage.objects;
CREATE POLICY "incidents_photos_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'incidents-photos');

-- Rollback (restores public serving):
-- DROP POLICY IF EXISTS "incidents_photos_select_authenticated" ON storage.objects;
-- UPDATE storage.buckets SET public = true WHERE id = 'incidents-photos';
