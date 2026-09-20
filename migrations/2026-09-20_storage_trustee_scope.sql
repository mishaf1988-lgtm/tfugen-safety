-- Storage — the anonymous kiosk session had the run of the whole bucket
-- Date: 2026-09-20 (security review, second round)
--
-- ⚠ NOT YET RUN. Needs Michael's explicit go-ahead: this replaces four existing
--   RLS policies, which CLAUDE.md classes as a destructive-class operation
--   approved each time.
--
-- THE HOLE
-- April's two Storage migrations made 'incidents-photos' private and then gave
-- every signed-in user the whole bucket:
--
--   incidents_photos_select_authenticated   SELECT TO authenticated  bucket_id = …
--   incidents_photos_insert_authenticated   INSERT TO authenticated  bucket_id = …
--   incidents_photos_update_authenticated   UPDATE TO authenticated  bucket_id = …
--   incidents_photos_delete_authenticated   DELETE TO authenticated  bucket_id = …
--
-- In April "authenticated" meant a real account. In September the app gained a
-- no-password trustee screen that signs in ANONYMOUSLY, and a Supabase
-- anonymous sign-in produces a token whose role is exactly `authenticated`.
-- That is the same trap #615 closed on the API side on 2026-09-20 — this is
-- the side of it nobody checked.
--
-- So today, any visitor to the public site can, with two taps and a console:
--   * LIST and DOWNLOAD every file ever uploaded — incident photos, hearing-test
--     scans, medical documents, contractor files. (Creating a signed URL is a
--     SELECT, so index.html's own _sign() is all the tooling needed.)
--   * OVERWRITE any of them: _fileUpload sends `x-upsert: true`, and listing
--     hands over the exact object names, so nothing has to be guessed.
--   * DELETE any of them.
--
-- WHAT THE KIOSK ACTUALLY NEEDS — read from the code, not assumed:
--   * upload a tour photo, and the "after" photo that closes a finding
--   * display its own photos: _truRender (index.html ~14331) renders a 📷 link,
--     and _sign() (~16387) mints it by POSTing to /storage/v1/object/sign/…,
--     which RLS treats as a SELECT. Without SELECT the link goes dead.
--   * nothing else. The app issues no DELETE to Storage anywhere — grep for
--     method:'DELETE' against /storage/v1/object returns zero hits, and
--     _attachClear only drops the local reference.
--
-- THE BOUNDARY
-- _attachBtn / _attachClear call _attachPick(areaId, areaId) — the upload
-- PREFIX IS THE AREA ID — and the trustee form's area ids come from
-- _truPhId(n,k) = 'tru-ph-<task>-<item>'. _fileUpload names the object
-- `<prefix>-<Date.now()>.jpg`, so every trustee tour photo, and only a trustee
-- tour photo, is stored under a name beginning 'tru-ph-'. Every other upload
-- path uses a different prefix (nm, inc, tr, toolbox, easp, round, eqi, docs,
-- pf-<page>, cap-, cap-vid-). Note 'tr-' (training certificates) does not
-- collide: 'tru-ph-…' does not begin with 'tr-'.
-- tests/harness/storage-scope-test.js holds that boundary in place.
--
-- WHO COUNTS AS A REAL USER
-- The same test functions/_shared.js requireUser() applies: not flagged
-- anonymous, AND carrying an email — every real account in this app signs in
-- with one, so its absence is the tell. Both checks FAIL CLOSED: a token with
-- no is_anonymous claim at all is treated as anonymous.

-- ---------------------------------------------------------------------------
-- SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_select_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_select_trustee_kiosk" ON storage.objects;

-- A real, named account reads the whole bucket, exactly as before.
CREATE POLICY "incidents_photos_select_named_user"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- Anyone signed in — including the anonymous kiosk — reads tour photos, which
-- is all the trustee screen ever renders.
CREATE POLICY "incidents_photos_select_trustee_kiosk"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND name LIKE 'tru-ph-%'
  );

-- ---------------------------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_insert_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_insert_trustee_kiosk" ON storage.objects;

CREATE POLICY "incidents_photos_insert_named_user"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- The tour photo. This is the one thing the kiosk must keep.
CREATE POLICY "incidents_photos_insert_trustee_kiosk"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND name LIKE 'tru-ph-%'
  );

-- ---------------------------------------------------------------------------
-- UPDATE — _fileUpload always sends x-upsert, so an upload onto an existing
-- name is an UPDATE. Names carry Date.now(), so a real collision is vanishing,
-- but the kiosk must not be able to overwrite anything outside its own prefix.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_update_named_user"    ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_update_trustee_kiosk" ON storage.objects;

CREATE POLICY "incidents_photos_update_named_user"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  )
  WITH CHECK (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

CREATE POLICY "incidents_photos_update_trustee_kiosk"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'incidents-photos' AND name LIKE 'tru-ph-%')
  WITH CHECK (bucket_id = 'incidents-photos' AND name LIKE 'tru-ph-%');

-- ---------------------------------------------------------------------------
-- DELETE — named users only. The app never deletes from Storage at all, so
-- this takes nothing away from anyone; it removes the ability entirely from
-- the one session type that should never have had it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_photos_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "incidents_photos_delete_named_user"    ON storage.objects;

CREATE POLICY "incidents_photos_delete_named_user"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'incidents-photos'
    AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );

-- Idempotent: every statement drops before it creates. Re-running is safe.

-- VERIFY after running (paste into the SQL editor):
--
--   -- 1. seven policies, and none of the old bucket-wide four
--   SELECT policyname, cmd
--     FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects'
--      AND policyname LIKE 'incidents_photos%'
--    ORDER BY cmd, policyname;
--   -- expect exactly:
--   --   DELETE  incidents_photos_delete_named_user
--   --   INSERT  incidents_photos_insert_named_user
--   --   INSERT  incidents_photos_insert_trustee_kiosk
--   --   SELECT  incidents_photos_select_named_user
--   --   SELECT  incidents_photos_select_trustee_kiosk
--   --   UPDATE  incidents_photos_update_named_user
--   --   UPDATE  incidents_photos_update_trustee_kiosk
--   -- and NO policyname ending in _authenticated
--
--   -- 2. how many objects the kiosk can still see, and of what kind
--   SELECT split_part(name, '-', 1) AS prefix, count(*)
--     FROM storage.objects
--    WHERE bucket_id = 'incidents-photos'
--    GROUP BY 1 ORDER BY 2 DESC;
--   -- the kiosk now sees only the 'tru' rows; everything else is closed to it
--
-- THEN, ON THE PHONE (this is the part that matters):
--   1. open the trustee link, file a tour with a photo → it must upload
--   2. reopen the trustee screen → the 📷 link on that report must still open
--   3. close a finding with an "after" photo → must upload
--   4. sign in as the manager → every photo, everywhere, must still open
--
-- Rollback: re-run 2026-04-21_storage_private.sql and
-- 2026-04-21_storage_rls_writes.sql, which hold the original four policies.
