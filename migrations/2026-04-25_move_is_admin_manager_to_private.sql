-- Migration: move is_admin_manager() from public to private schema
-- Date: 2026-04-25
--
-- Context: Supabase Security Advisor (2026-04-27 lint) flagged two warnings:
--   - anon_security_definer_function_executable
--   - authenticated_security_definer_function_executable
-- on `public.is_admin_manager()`. PostgREST exposes any function in the
-- `public` schema via `/rest/v1/rpc/<name>`, so the function is callable
-- by both anon and authenticated roles directly. While the function
-- only returns a boolean (no data leak), exposing helper RLS functions
-- via the public API is bad practice — Supabase docs recommend keeping
-- them in a non-public schema.
--
-- This migration:
--   1. Creates a `private` schema (PostgREST does not expose it).
--   2. Recreates the function as `private.is_admin_manager()` with
--      identical body and SECURITY DEFINER semantics.
--   3. Grants USAGE on the schema and EXECUTE on the function to
--      `authenticated` and `anon` so RLS policies can still call it.
--   4. Drops and recreates 26 policies that reference the public
--      function, switching them to `private.is_admin_manager()`.
--   5. Drops `public.is_admin_manager()` last (after all references
--      are gone).
--
-- Tables affected (26 policies):
--   Stage 1: files, hist
--   Stage 2: auds, ctr, docs, drl, emp, env, equip_inspections,
--            hearing_tests, hzm, inc, ins, leg, med, ncr, ncr_ai,
--            near_miss, ppe, ptw, rounds, rsk, tr, wst
--   Other:   audit_log, toolbox
--
-- NOT affected:
--   - tasks: its policy inlines the admin/manager check, no helper.
--   - app_users: uses email check, no helper.
--   - emp_insert policies: WITH CHECK (true), no helper.
--
-- Wrapped in BEGIN/COMMIT — if any statement fails, nothing changes.
-- Safe to re-run: DROP POLICY IF EXISTS, CREATE OR REPLACE FUNCTION.

BEGIN;

---------------------------------------------------------------------
-- 1. Create private schema
---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA private TO authenticated, anon;

---------------------------------------------------------------------
-- 2. Create private.is_admin_manager() — same body as the public one
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_admin_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM public.app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role IN ('אדמין', 'מנהל')
    );
$$;

GRANT EXECUTE ON FUNCTION private.is_admin_manager() TO authenticated, anon;

---------------------------------------------------------------------
-- 3. Recreate all 26 policies using private.is_admin_manager()
---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'files','hist',
    'auds','ctr','docs','drl','emp','env','equip_inspections',
    'hearing_tests','hzm','inc','ins','leg','med','ncr','ncr_ai',
    'near_miss','ppe','ptw','rounds','rsk','tr','wst',
    'audit_log','toolbox'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_admin_manager_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I '
      'FOR ALL TO authenticated '
      'USING (private.is_admin_manager()) '
      'WITH CHECK (private.is_admin_manager())',
      t || '_admin_manager_all', t
    );
  END LOOP;
END $$;

---------------------------------------------------------------------
-- 4. Drop the public function — no callers remain
---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_admin_manager();

COMMIT;

---------------------------------------------------------------------
-- Verify (run separately):
---------------------------------------------------------------------
-- A. Function moved:
-- SELECT n.nspname, p.proname
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE p.proname = 'is_admin_manager';
-- Expected: 1 row — nspname='private'.
--
-- B. All 26 policies reference private:
-- SELECT tablename, policyname,
--        pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policies pol
--   JOIN pg_policy   pp  ON pp.polname = pol.policyname
--                       AND pp.polrelid = (pol.schemaname||'.'||pol.tablename)::regclass
--  WHERE pol.policyname LIKE '%_admin_manager_all'
--  ORDER BY tablename;
-- Expected: 26 rows, each using_expr contains 'private.is_admin_manager()'.
--
-- C. Security Advisor: re-run linter, the two
--    `*_security_definer_function_executable` warnings should disappear.

---------------------------------------------------------------------
-- Rollback (recreates public function and reverts policies):
---------------------------------------------------------------------
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.is_admin_manager() RETURNS boolean
--   LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
--     SELECT auth.jwt() ->> 'email' = 'admin@tfugen.local'
--     OR EXISTS (SELECT 1 FROM public.app_users u
--                 WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
--                   AND u.role IN ('אדמין','מנהל'));
--   $$;
-- GRANT EXECUTE ON FUNCTION public.is_admin_manager() TO authenticated, anon;
-- -- (then re-run Stage 1+2 policy CREATE statements with public.)
-- DROP FUNCTION IF EXISTS private.is_admin_manager();
-- DROP SCHEMA IF EXISTS private;
-- COMMIT;
