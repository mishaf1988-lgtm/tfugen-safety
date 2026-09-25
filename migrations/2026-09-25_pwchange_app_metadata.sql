-- 2026-09-25 -- must_change_password moves from user_metadata to app_metadata
--
-- WHY: Supabase security advisor `rls_references_user_metadata` (ERROR, 49
-- tables + storage.objects). The RESTRICTIVE policy `pwchange_required`
-- (2026-09-24_z_pentest_hardening.sql, pentest #2) reads
-- auth.jwt() -> 'user_metadata' ->> 'must_change_password'. user_metadata is
-- writable by the user themself (supabase.auth.updateUser({data:{...}})), so
-- a user holding a temporary password can clear the flag WITHOUT changing
-- the password and keep using the one the admin dictated over the phone.
-- app_metadata can only be written with the service key.
--
-- WHAT:
--   1. trigger on auth.users: the flag in raw_app_meta_data is removed the
--      moment encrypted_password actually changes. Nothing else clears it.
--      (BEFORE UPDATE OF encrypted_password -- a metadata-only update, such as
--      the second PUT in reset-password.js, does not fire it.)
--   2. backfill: whoever is flagged in user_metadata today is flagged in
--      app_metadata too, so nobody is released by the switch.
--   3. pwchange_required recreated on every RLS table in public + storage.objects,
--      reading app_metadata, with (select auth.jwt()) so the advisor's
--      auth_rls_initplan warning on the same policy goes away as well.
--
-- CODE SIDE (same PR): create-user.js / reset-password.js also set
-- app_metadata.must_change_password=true; doLogin honours either flag.
-- Safe in both orders: before this runs the old policy still blocks via
-- user_metadata (the server keeps writing that too), after it the new one
-- blocks via app_metadata and only a real password change releases.

-- ---- 1. trigger --------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.clear_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
     AND NEW.raw_app_meta_data ? 'must_change_password' THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data - 'must_change_password';
  END IF;
  RETURN NEW;
END $$;

-- The trigger runs as the role doing the UPDATE on auth.users, which is
-- GoTrue's supabase_auth_admin. It has no USAGE on schema private today
-- (checked 2026-09-25), so without these two grants every password change
-- in Auth would fail with "permission denied". Nobody else may call it.
REVOKE ALL ON FUNCTION private.clear_must_change_password() FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.clear_must_change_password() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS clear_must_change_password ON auth.users;
CREATE TRIGGER clear_must_change_password
  BEFORE UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.clear_must_change_password();

-- ---- 2. backfill -------------------------------------------------------------
UPDATE auth.users
   SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb
 WHERE coalesce((raw_user_meta_data ->> 'must_change_password')::boolean, false)
   AND NOT coalesce((raw_app_meta_data ->> 'must_change_password')::boolean, false);

-- ---- 3. policies -------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS pwchange_required ON public.%I', t);
    EXECUTE format($f$CREATE POLICY pwchange_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
      WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)$f$, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS pwchange_required ON storage.objects;
CREATE POLICY pwchange_required ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
  WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false);

-- ---- Verify (read-only) ------------------------------------------------------
-- SELECT count(*) FROM pg_policies WHERE policyname='pwchange_required' AND qual LIKE '%app_metadata%';   -- 49 + 1
-- SELECT count(*) FROM pg_policies WHERE policyname='pwchange_required' AND qual LIKE '%user_metadata%';  -- 0
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='clear_must_change_password';
-- SELECT email FROM auth.users WHERE (raw_app_meta_data->>'must_change_password')::boolean;               -- the still-flagged users
