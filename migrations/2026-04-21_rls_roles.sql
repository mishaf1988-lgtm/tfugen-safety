-- Migration: Per-role RLS — distinguish admin (email-authenticated) from
--   emp (anonymous sign-in) at the database level.
-- Date: 2026-04-21
-- Purpose (Vuln #7): The previous policy "authenticated_all" gave full
--   read/write/delete on every table to any authenticated user — including
--   anonymous-sign-in sessions that employees use via the "Quick Report"
--   entrypoint. That meant any field worker could, from DevTools, read/edit
--   all NCRs, delete audits, etc. This migration replaces that policy with:
--     * admin_all       — full access, only for non-anonymous JWTs (email login)
--     * emp_insert_*    — INSERT-only for the 4 tables the employee UI writes to
--   Anonymous sessions cannot SELECT, UPDATE, or DELETE any row; they can
--   only INSERT into near_miss, rounds, equip_inspections, tr.

-- Prerequisites:
--   * 2026-04-20_enable_rls.sql has already been applied (RLS enabled, with
--     the permissive "authenticated_all" policy this migration replaces).

-- How to run:
-- 1. Supabase dashboard → SQL Editor → paste → Run.
-- 2. Verify: Table Editor → Policies. Every table shows "admin_all"; four
--    emp-writable tables also show "emp_insert".
-- 3. After apply, employee mode still submits forms; admin still has full
--    access; anyone with just an anonymous session loses read on all tables.

-- ----------------------------------------------------------------------
-- STEP 1: Drop the old permissive policy from every table.
-- ----------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med',
    'ins','drl','ctr','wst','hzm','env','leg','equip_inspections',
    'near_miss','rounds','hearing_tests','ncr_ai'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_all        ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS emp_insert       ON public.%I', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- STEP 2: admin_all on every table — full access for email-authenticated users.
--   The JWT claim is_anonymous is TRUE for anonymous sign-in, FALSE/absent
--   for email sign-in. COALESCE handles the absent-claim case.
-- ----------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med',
    'ins','drl','ctr','wst','hzm','env','leg','equip_inspections',
    'near_miss','rounds','hearing_tests','ncr_ai'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format($f$
      CREATE POLICY admin_all ON public.%I
        FOR ALL TO authenticated
        USING  (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
        WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
    $f$, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- STEP 3: emp_insert on the four employee-writable tables — INSERT only.
--   No USING clause (SELECT/UPDATE/DELETE stay blocked for anonymous).
--   Policies stack OR-wise, so admins keep full access via admin_all.
-- ----------------------------------------------------------------------
DO $$
DECLARE
  t text;
  emp_tbls text[] := ARRAY['near_miss','rounds','equip_inspections','tr'];
BEGIN
  FOREACH t IN ARRAY emp_tbls LOOP
    EXECUTE format($f$
      CREATE POLICY emp_insert ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (true)
    $f$, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- Rollback (restores the old permissive policy):
-- ----------------------------------------------------------------------
-- DO $$ DECLARE t text; tbls text[] := ARRAY['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med','ins','drl','ctr','wst','hzm','env','leg','equip_inspections','near_miss','rounds','hearing_tests','ncr_ai']; BEGIN FOREACH t IN ARRAY tbls LOOP EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t); EXECUTE format('DROP POLICY IF EXISTS emp_insert ON public.%I', t); EXECUTE format('CREATE POLICY authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t); END LOOP; END $$;
