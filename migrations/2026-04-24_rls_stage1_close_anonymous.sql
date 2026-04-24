-- Migration: RLS Stage 1 — close anonymous access (drop `open` policies)
-- Date: 2026-04-24
--
-- Context: security audit ran 2026-04-24 found 10 policies across
-- public schema with `USING true` — effectively allowing access
-- without any authentication (anon key alone). On ncr alone this
-- means any holder of the anon key can DELETE 375 production rows
-- via REST.
--
-- Because PostgreSQL combines permissive RLS policies with OR, the
-- existing per-table `admin_all` policies (is_anonymous=false) are
-- bypassed whenever an `open` USING(true) policy coexists. Dropping
-- `open` alone leaves `admin_all` in place — that still allows any
-- authenticated user full CRUD, but at least blocks anonymous.
--
-- This migration ONLY closes the anonymous exposure. Stage 2 (later)
-- will replace `admin_all` with admin/manager gating. Stage 3 will
-- tighten the emp_insert policies.
--
-- Consultant plan: staged, not all-in-one. Helper function
-- `public.is_admin_manager()` introduced now for reuse in Stage 2.
-- `files` and `hist` have ONLY the `open` policy (no `admin_all`),
-- so a replacement admin/manager policy is added for them here —
-- otherwise admin would be locked out after the drop.
--
-- Safe to re-run: uses DROP ... IF EXISTS + CREATE OR REPLACE.

---------------------------------------------------------------------
-- 1. Helper function for admin/manager checks
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM app_users
      WHERE id = split_part(auth.jwt() ->> 'email', '@', 1)
        AND role IN ('אדמין','מנהל')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_manager() TO authenticated, anon;

---------------------------------------------------------------------
-- 2. Drop anonymous-permissive `open` policies on 9 tables
--    (admin_all stays in place — closes anonymous but still allows
--     any authenticated user. Tightened in Stage 2.)
---------------------------------------------------------------------
DROP POLICY IF EXISTS open ON auds;
DROP POLICY IF EXISTS open ON docs;
DROP POLICY IF EXISTS open ON emp;
DROP POLICY IF EXISTS open ON files;
DROP POLICY IF EXISTS open ON hist;
DROP POLICY IF EXISTS open ON inc;
DROP POLICY IF EXISTS open ON ncr;
DROP POLICY IF EXISTS open ON rsk;
DROP POLICY IF EXISTS open ON tr;

---------------------------------------------------------------------
-- 3. files and hist have NO `admin_all` — without a replacement they
--    would be fully locked after the DROP above. Add admin/manager
--    policies immediately.
---------------------------------------------------------------------
DROP POLICY IF EXISTS files_admin_manager_all ON files;
CREATE POLICY files_admin_manager_all ON files
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

DROP POLICY IF EXISTS hist_admin_manager_all ON hist;
CREATE POLICY hist_admin_manager_all ON hist
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

---------------------------------------------------------------------
-- 4. Restrict app_users_read from anon to authenticated.
--    Column-level data stays visible to any logged-in user because
--    the reporter dropdown needs it. Anon exposure is removed.
---------------------------------------------------------------------
DROP POLICY IF EXISTS app_users_read ON app_users;
CREATE POLICY app_users_read ON app_users
  FOR SELECT
  TO authenticated
  USING (true);

---------------------------------------------------------------------
-- Verify (run separately):
---------------------------------------------------------------------
-- A. No more `USING true` policies exposed to anon:
--   SELECT c.relname, p.polname, p.polroles::regrole[] AS roles,
--          pg_get_expr(p.polqual, p.polrelid) AS using_expr
--     FROM pg_policy p
--     JOIN pg_class c ON c.oid = p.polrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND pg_get_expr(p.polqual, p.polrelid) = 'true'
--    ORDER BY c.relname;
-- Expected: only app_users.app_users_read with roles = {authenticated}.
--
-- B. is_admin_manager exists:
--   SELECT proname FROM pg_proc WHERE proname='is_admin_manager';
--
-- C. Zero `open` policies left:
--   SELECT COUNT(*) FROM pg_policy WHERE polname='open';
-- Expected: 0.
--
-- D. files/hist have their admin_manager policies:
--   SELECT c.relname, p.polname FROM pg_policy p
--     JOIN pg_class c ON c.oid=p.polrelid
--    WHERE c.relname IN ('files','hist');

---------------------------------------------------------------------
-- Rollback (re-opens everything to anon — use only in emergency):
---------------------------------------------------------------------
-- DROP POLICY IF EXISTS files_admin_manager_all ON files;
-- DROP POLICY IF EXISTS hist_admin_manager_all  ON hist;
-- CREATE POLICY open ON auds  FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON docs  FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON emp   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON files FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON hist  FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON inc   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON ncr   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON rsk   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY open ON tr    FOR ALL USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS app_users_read ON app_users;
-- CREATE POLICY app_users_read ON app_users FOR SELECT USING (true);
-- -- is_admin_manager() can stay, it is harmless without callers.
