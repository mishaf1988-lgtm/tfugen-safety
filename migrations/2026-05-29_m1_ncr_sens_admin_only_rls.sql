-- M1 (security audit) — make the `sens` (sensitive NCR) flag REAL at the DB level.
--
-- Until now `ncr_admin_manager_all` was `FOR ALL TO authenticated USING
-- (private.is_admin_manager())`, which let BOTH admin AND manager read +
-- write every row, including sens=true. The UI hid sens rows from non-admin
-- (rNcr / showView / global search), but the data was already on the wire.
-- A direct REST call `GET /rest/v1/ncr?sens=eq.true&select=*` would return
-- everything to any manager.
--
-- This migration splits the policy in two:
--   1. ncr_admin_all          — admin only, full access (incl. sens rows).
--   2. ncr_manager_non_sens   — manager + admin, ONLY non-sens rows.
-- Reporter remains fully blocked (neither policy matches).
--
-- Helper function private.is_admin_only() — admin-only check.
-- private.is_admin_manager() stays as-is for all the other tables (35+
-- policies depend on it).
--
-- TESTED LIVE on prod (2026-05-29) via SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claims to simulate each role:
--   T1 admin     → sees 376/1 (all rows incl. test sens row). PASS.
--   T2 manager   → sees 375/0 (test sens row hidden). PASS.
--   T3 reporter  → sees 0/0. PASS.
--   T4 manager attempted UPDATE sens=true → blocked; admin re-check confirms
--      sens_total stayed at 1 (only the test row), no leaked promotions. PASS.
-- Test fixtures (one sens=true ncr + one fake manager app_user) were
-- inserted and deleted in-flight; final state verified clean.
--
-- Idempotent, safe to re-run.

CREATE OR REPLACE FUNCTION private.is_admin_only()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM public.app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role = 'אדמין'
    );
$$;

DROP POLICY IF EXISTS "ncr_admin_manager_all" ON public.ncr;
DROP POLICY IF EXISTS "ncr_admin_all"          ON public.ncr;
DROP POLICY IF EXISTS "ncr_manager_non_sens"   ON public.ncr;

-- Admin: full access (incl. sens rows).
CREATE POLICY "ncr_admin_all" ON public.ncr
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin_only()))
  WITH CHECK ((SELECT private.is_admin_only()));

-- Manager: only non-sens rows. Cannot promote a row to sens=true either.
CREATE POLICY "ncr_manager_non_sens" ON public.ncr
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager()) AND (sens IS NOT TRUE))
  WITH CHECK ((SELECT private.is_admin_manager()) AND (sens IS NOT TRUE));

NOTIFY pgrst, 'reload schema';
