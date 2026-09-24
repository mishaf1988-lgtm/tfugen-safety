-- 2026-09-24 — storage: drop the four policies open to the `anon` role
--
-- Approved explicitly by Michael on 2026-09-24 («כן, להסיר»), as CLAUDE.md
-- requires for removing an existing RLS policy.
--
-- `anon` is the Postgres role for a request that carries only the publishable
-- key and no user session. The publishable key is in the page source by design,
-- so `anon` means anyone on the internet. Four legacy policies granted it:
--
--   "Enable read access for all users"   INSERT  WITH CHECK (true)
--        -- despite the name, an UPLOAD policy with no bucket restriction:
--        -- anyone could write a file into ANY bucket, including `backups`,
--        -- where a planted "backup" is a restore away from poisoning the data.
--   "allow anon insert incidents-photos"  INSERT  bucket = incidents-photos
--   "allow_anon_upload 1ug2xgt_0"         INSERT  bucket = incidents-photos
--   "allow anon read incidents-photos"    SELECT  bucket = incidents-photos
--        -- both buckets are private (public = false), so this was the ONLY
--        -- thing letting a stranger list and download every incident photo.
--
-- The app never uses them: _fileUpload refuses to upload without a user
-- session (`if(!_sbToken) throw`), and the anonymous trustee kiosk signs in and
-- is `authenticated`, served by the *_trustee_kiosk policies (tru-ph- prefix).
-- The 20/09 audit counted "7 policies, all restricted" because it looked at the
-- authenticated role; these four sat on `anon` next to them.
--
-- Rollback at the bottom recreates them exactly.

BEGIN;
DROP POLICY IF EXISTS "Enable read access for all users"   ON storage.objects;
DROP POLICY IF EXISTS "allow anon insert incidents-photos" ON storage.objects;
DROP POLICY IF EXISTS "allow_anon_upload 1ug2xgt_0"        ON storage.objects;
DROP POLICY IF EXISTS "allow anon read incidents-photos"   ON storage.objects;
COMMIT;

-- ---- Verify ------------------------------------------------------------------
-- SELECT policyname, roles FROM pg_policies
--  WHERE schemaname='storage' AND tablename='objects' AND 'anon' = ANY(roles);   -- expect 0 rows

-- ---- Rollback ----------------------------------------------------------------
-- BEGIN;
-- CREATE POLICY "Enable read access for all users"   ON storage.objects FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "allow anon insert incidents-photos" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'incidents-photos');
-- CREATE POLICY "allow_anon_upload 1ug2xgt_0"        ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'incidents-photos');
-- CREATE POLICY "allow anon read incidents-photos"   ON storage.objects FOR SELECT TO anon USING (bucket_id = 'incidents-photos');
-- COMMIT;
