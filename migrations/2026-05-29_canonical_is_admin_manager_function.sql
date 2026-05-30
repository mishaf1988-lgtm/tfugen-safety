-- Security governance — 2026-05-29
--
-- The gate function that authorizes RLS on 14+ tables lives at
-- private.is_admin_manager(). It was created out-of-band early in the
-- project and was never committed to version control until now. The
-- 2026-05-04 RLS perf-wrap migration assumed it existed but never
-- defined it — meaning a fresh restore from this repo alone would FAIL.
-- This file captures the canonical definition so the repo is now
-- complete and recoverable.
--
-- IMPORTANT: this migration is NOT meant to be re-applied to the live
-- production project — it would be a no-op (CREATE OR REPLACE with the
-- same body), but applying it via Supabase migrations records an
-- unnecessary version stamp. It is preserved here for:
--   (a) disaster recovery / project recreation
--   (b) code review / audit of the actual gate logic
--   (c) detecting drift (compare against pg_get_functiondef on prod)
--
-- Verified live 2026-05-29 — body matches pg_get_functiondef byte-for-byte.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM public.app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role IN ('אדמין', 'מנהל')
    );
$function$;

-- Notes on the design:
-- * STABLE — same input within a query → same output (Postgres can optimize).
-- * SECURITY DEFINER — runs as the function owner, bypassing RLS on
--   app_users so the lookup never fails for low-privilege callers.
-- * SET search_path TO 'public' — prevents search_path hijacking via
--   schema injection (the linter 0011 flag this is designed to defuse).
-- * Logic: caller is admin/manager iff their auth.jwt() email is
--   admin@tfugen.local (bootstrap admin), OR there is an app_users row
--   whose id matches the part-before-@ AND role is אדמין/מנהל.
