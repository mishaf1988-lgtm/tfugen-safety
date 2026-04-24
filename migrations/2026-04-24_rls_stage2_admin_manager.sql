-- Migration: RLS Stage 2 — replace admin_all with admin/manager-only policies
-- Date: 2026-04-24
--
-- Context: After Stage 1 closed anonymous access, 22 tables still have
-- a legacy `admin_all` policy with `is_anonymous = false`. This allows
-- ANY authenticated user (user1..user10) to do full CRUD on production
-- data via REST — including deleting all 375 ncr rows.
--
-- This migration replaces each `admin_all` with a strict
-- `<table>_admin_manager_all` policy that uses the
-- `public.is_admin_manager()` helper (created in Stage 1).
--
-- After Stage 2:
--   - admin@tfugen.local              → full CRUD on all 22 tables
--   - app_users.role IN ('אדמין','מנהל') → full CRUD on all 22 tables
--   - other authenticated users       → NO access via REST
--   - anon (emp-mode)                 → only the 4 emp_insert policies
--                                       still apply (Stage 3 will tighten)
--
-- This is an OPINIONATED change: reporter-role users (role='מדווח')
-- will lose REST access after this migration. They should use:
--   - emp-mode (?emp=1) for quick reports → 4 emp_insert policies
--   - or be upgraded to 'מנהל' if they need full app access
--
-- Consultant plan step 2 of 3. Safe to re-run: DROP IF EXISTS + CREATE.

---------------------------------------------------------------------
-- Each block: drop admin_all, create admin_manager replacement.
---------------------------------------------------------------------

-- auds
DROP POLICY IF EXISTS admin_all ON auds;
DROP POLICY IF EXISTS auds_admin_manager_all ON auds;
CREATE POLICY auds_admin_manager_all ON auds
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ctr
DROP POLICY IF EXISTS admin_all ON ctr;
DROP POLICY IF EXISTS ctr_admin_manager_all ON ctr;
CREATE POLICY ctr_admin_manager_all ON ctr
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- docs
DROP POLICY IF EXISTS admin_all ON docs;
DROP POLICY IF EXISTS docs_admin_manager_all ON docs;
CREATE POLICY docs_admin_manager_all ON docs
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- drl
DROP POLICY IF EXISTS admin_all ON drl;
DROP POLICY IF EXISTS drl_admin_manager_all ON drl;
CREATE POLICY drl_admin_manager_all ON drl
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- emp
DROP POLICY IF EXISTS admin_all ON emp;
DROP POLICY IF EXISTS emp_admin_manager_all ON emp;
CREATE POLICY emp_admin_manager_all ON emp
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- env
DROP POLICY IF EXISTS admin_all ON env;
DROP POLICY IF EXISTS env_admin_manager_all ON env;
CREATE POLICY env_admin_manager_all ON env
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- equip_inspections (emp_insert stays untouched)
DROP POLICY IF EXISTS admin_all ON equip_inspections;
DROP POLICY IF EXISTS equip_inspections_admin_manager_all ON equip_inspections;
CREATE POLICY equip_inspections_admin_manager_all ON equip_inspections
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- hearing_tests
DROP POLICY IF EXISTS admin_all ON hearing_tests;
DROP POLICY IF EXISTS hearing_tests_admin_manager_all ON hearing_tests;
CREATE POLICY hearing_tests_admin_manager_all ON hearing_tests
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- hzm
DROP POLICY IF EXISTS admin_all ON hzm;
DROP POLICY IF EXISTS hzm_admin_manager_all ON hzm;
CREATE POLICY hzm_admin_manager_all ON hzm
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- inc
DROP POLICY IF EXISTS admin_all ON inc;
DROP POLICY IF EXISTS inc_admin_manager_all ON inc;
CREATE POLICY inc_admin_manager_all ON inc
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ins
DROP POLICY IF EXISTS admin_all ON ins;
DROP POLICY IF EXISTS ins_admin_manager_all ON ins;
CREATE POLICY ins_admin_manager_all ON ins
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- leg
DROP POLICY IF EXISTS admin_all ON leg;
DROP POLICY IF EXISTS leg_admin_manager_all ON leg;
CREATE POLICY leg_admin_manager_all ON leg
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- med
DROP POLICY IF EXISTS admin_all ON med;
DROP POLICY IF EXISTS med_admin_manager_all ON med;
CREATE POLICY med_admin_manager_all ON med
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ncr (375 production records!)
DROP POLICY IF EXISTS admin_all ON ncr;
DROP POLICY IF EXISTS ncr_admin_manager_all ON ncr;
CREATE POLICY ncr_admin_manager_all ON ncr
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ncr_ai
DROP POLICY IF EXISTS admin_all ON ncr_ai;
DROP POLICY IF EXISTS ncr_ai_admin_manager_all ON ncr_ai;
CREATE POLICY ncr_ai_admin_manager_all ON ncr_ai
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- near_miss (emp_insert stays)
DROP POLICY IF EXISTS admin_all ON near_miss;
DROP POLICY IF EXISTS near_miss_admin_manager_all ON near_miss;
CREATE POLICY near_miss_admin_manager_all ON near_miss
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ppe
DROP POLICY IF EXISTS admin_all ON ppe;
DROP POLICY IF EXISTS ppe_admin_manager_all ON ppe;
CREATE POLICY ppe_admin_manager_all ON ppe
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- ptw
DROP POLICY IF EXISTS admin_all ON ptw;
DROP POLICY IF EXISTS ptw_admin_manager_all ON ptw;
CREATE POLICY ptw_admin_manager_all ON ptw
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- rounds (emp_insert stays)
DROP POLICY IF EXISTS admin_all ON rounds;
DROP POLICY IF EXISTS rounds_admin_manager_all ON rounds;
CREATE POLICY rounds_admin_manager_all ON rounds
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- rsk
DROP POLICY IF EXISTS admin_all ON rsk;
DROP POLICY IF EXISTS rsk_admin_manager_all ON rsk;
CREATE POLICY rsk_admin_manager_all ON rsk
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- tr (emp_insert stays)
DROP POLICY IF EXISTS admin_all ON tr;
DROP POLICY IF EXISTS tr_admin_manager_all ON tr;
CREATE POLICY tr_admin_manager_all ON tr
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

-- wst
DROP POLICY IF EXISTS admin_all ON wst;
DROP POLICY IF EXISTS wst_admin_manager_all ON wst;
CREATE POLICY wst_admin_manager_all ON wst
  FOR ALL TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());

---------------------------------------------------------------------
-- Verification (run separately):
---------------------------------------------------------------------
-- A. Zero admin_all policies left:
--   SELECT COUNT(*) FROM pg_policy WHERE polname='admin_all';
-- Expected: 0.
--
-- B. 22 admin_manager policies exist:
--   SELECT c.relname, p.polname
--     FROM pg_policy p
--     JOIN pg_class  c ON c.oid = p.polrelid
--    WHERE p.polname LIKE '%_admin_manager_all'
--    ORDER BY c.relname;
-- Expected: 24 rows (the 22 from this file + tasks + files + hist).
--
-- C. No policy with is_anonymous still references it as the gate:
--   SELECT c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid)
--     FROM pg_policy p
--     JOIN pg_class  c ON c.oid = p.polrelid
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname='public'
--      AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%is_anonymous%';
-- Expected: 0 rows.

---------------------------------------------------------------------
-- Rollback (restores admin_all on all 22 tables — emergency only):
---------------------------------------------------------------------
-- DROP POLICY IF EXISTS auds_admin_manager_all ON auds;
-- CREATE POLICY admin_all ON auds FOR ALL
--   USING (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false);
-- ... (repeat for ctr, docs, drl, emp, env, equip_inspections,
--      hearing_tests, hzm, inc, ins, leg, med, ncr, ncr_ai,
--      near_miss, ppe, ptw, rounds, rsk, tr, wst)
