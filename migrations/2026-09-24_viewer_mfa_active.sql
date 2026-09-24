-- 2026-09-24 — viewer role, two-step sign-in enforcement, inactive staff lose access
--
-- Approved by Michael on 2026-09-24 (review of the whole system):
--   * build the read-only viewer role («צופה») and two-step sign-in, and
--   * fix the bug that a deactivated manager keeps database access.
--
-- Three things, all in one transaction so the database is never half-changed.
--
-- 1. ACTIVE CHECK. private.is_admin_manager() and private.is_admin_only() never
--    looked at app_users.active. Switching a manager off on the users page ended
--    their app login, but a token they still held kept reading and writing every
--    table through the REST API. The tasks policy inlined the same logic without
--    the function, so it is routed through the function here to get the fix too.
--
-- 2. VIEWER («צופה»). Reads what a manager reads, writes nothing. Purely ADDITIVE:
--    a permissive SELECT policy per table a manager reads, and RESTRICTIVE
--    policies that refuse a viewer every INSERT/UPDATE/DELETE everywhere. The
--    restrictive ones matter because five tables carry `emp_insert WITH CHECK
--    (true)` for the trustee kiosk, and a viewer is `authenticated` too.
--    Excluded from the viewer, as Michael chose («כמו מנהל, בלי ניהול משתמשים
--    ובלי יומן ביקורת»): app_users beyond their own row, audit_log,
--    password_reset_requests. ncr: non-sensitive rows only, like a manager.
--
-- 3. TWO-STEP SIGN-IN. A RESTRICTIVE policy on every table and on
--    storage.objects: a user who HAS a verified second factor must be at aal2.
--    A user without one is untouched. That is deliberate:
--      - nobody is enrolled today (auth.mfa_factors is empty, checked 24/09), so
--        this changes nothing until someone enrols -- no lock-out;
--      - the moment Michael enrols, an aal1 session (password only) stops
--        reading anything, so a stolen password alone is no longer enough;
--      - the anonymous trustee kiosk has no factor and is never affected.
--    Scoped TO authenticated: the anon role has no factors and, after the
--    companion migration, no storage access at all.
--
-- Rollback at the bottom.

BEGIN;

-- ---- 1. active check ------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_admin_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM public.app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role IN ('אדמין', 'מנהל')
         AND u.active IS NOT FALSE
    );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin_only()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    auth.jwt() ->> 'email' = 'admin@tfugen.local'
    OR EXISTS (
      SELECT 1 FROM public.app_users u
       WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
         AND u.role = 'אדמין'
         AND u.active IS NOT FALSE
    );
$function$;

DROP POLICY IF EXISTS tasks_admin_manager_all ON public.tasks;
CREATE POLICY tasks_admin_manager_all ON public.tasks
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager()))
  WITH CHECK ((SELECT private.is_admin_manager()));

-- ---- 2. viewer ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_viewer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users u
     WHERE u.id = split_part(auth.jwt() ->> 'email', '@', 1)
       AND u.role = 'צופה'
       AND u.active IS NOT FALSE
  );
$function$;

-- ---- 3. second factor -----------------------------------------------------
CREATE OR REPLACE FUNCTION private.mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = auth.uid() AND f.status = 'verified'
      );
$function$;

GRANT EXECUTE ON FUNCTION private.is_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION private.mfa_ok() TO authenticated;

-- Viewer reads: the tables a manager reads, minus the three Michael excluded.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'auds','ctr','custom_props','docs','drl','emp','env','env_aspects',
    'equip_inspection_history','equip_inspections','files','hearing_tests','hist',
    'hzm','inc','ins','inspection_types','issue_types','leg','locations','med',
    'mgmt_reviews','ncr_ai','ncr_comments','ncr_patterns','near_miss',
    'notifications_log','page_files','ppe','projects','ptw','record_history',
    'rounds','rsk','tasks','toolbox','tr','wst'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS viewer_read ON public.%I', t);
    EXECUTE format('CREATE POLICY viewer_read ON public.%I FOR SELECT TO authenticated USING ((SELECT private.is_viewer()))', t);
  END LOOP;
END $$;
-- ncr: like a manager, the sensitive rows stay admin-only.
DROP POLICY IF EXISTS viewer_read ON public.ncr;
CREATE POLICY viewer_read ON public.ncr FOR SELECT TO authenticated
  USING ((SELECT private.is_viewer()) AND sens IS NOT TRUE);

-- Viewer writes nothing, and two-step sign-in is enforced, on every table with RLS.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS viewer_no_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS viewer_no_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS viewer_no_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t);
    EXECUTE format('CREATE POLICY viewer_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()))', t);
    EXECUTE format('CREATE POLICY viewer_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()))', t);
    EXECUTE format('CREATE POLICY viewer_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()))', t);
    EXECUTE format('CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()))', t);
  END LOOP;
END $$;

-- Storage: backups hold the whole database, so a password-only session of an
-- enrolled admin must not read them either.
DROP POLICY IF EXISTS mfa_required ON storage.objects;
CREATE POLICY mfa_required ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()));
DROP POLICY IF EXISTS viewer_no_insert ON storage.objects;
DROP POLICY IF EXISTS viewer_no_update ON storage.objects;
DROP POLICY IF EXISTS viewer_no_delete ON storage.objects;
CREATE POLICY viewer_no_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()));

COMMIT;

-- ---- Verify (read-only) ----------------------------------------------------
-- SELECT tablename, count(*) FILTER (WHERE policyname='mfa_required')     AS mfa,
--        count(*) FILTER (WHERE policyname LIKE 'viewer_no_%')           AS viewer_blocks,
--        count(*) FILTER (WHERE policyname='viewer_read')                AS viewer_read
--   FROM pg_policies WHERE schemaname IN ('public','storage') GROUP BY 1 ORDER BY 1;
-- SELECT pg_get_functiondef('private.is_admin_manager()'::regprocedure);   -- has "active IS NOT FALSE"

-- ---- Rollback --------------------------------------------------------------
-- BEGIN;
-- DO $$ DECLARE t text; BEGIN
--   FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--             WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity LOOP
--     EXECUTE format('DROP POLICY IF EXISTS viewer_no_insert ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS viewer_no_update ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS viewer_no_delete ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS viewer_read ON public.%I', t);
--   END LOOP; END $$;
-- DROP POLICY IF EXISTS mfa_required ON storage.objects;
-- DROP POLICY IF EXISTS viewer_no_insert ON storage.objects;
-- DROP POLICY IF EXISTS viewer_no_update ON storage.objects;
-- DROP POLICY IF EXISTS viewer_no_delete ON storage.objects;
-- -- the two functions as they were before 2026-09-24 (no active check):
-- CREATE OR REPLACE FUNCTION private.is_admin_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS $f$ SELECT auth.jwt() ->> 'email' = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM public.app_users u
--        WHERE u.id = split_part(auth.jwt() ->> 'email','@',1) AND u.role IN ('אדמין','מנהל')); $f$;
-- CREATE OR REPLACE FUNCTION private.is_admin_only() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS $f$ SELECT auth.jwt() ->> 'email' = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM public.app_users u
--        WHERE u.id = split_part(auth.jwt() ->> 'email','@',1) AND u.role = 'אדמין'); $f$;
-- DROP FUNCTION IF EXISTS private.is_viewer();
-- DROP FUNCTION IF EXISTS private.mfa_ok();
-- -- tasks: the inline form it had before (same logic, no active check), read from pg_policies 24/09:
-- DROP POLICY IF EXISTS tasks_admin_manager_all ON public.tasks;
-- CREATE POLICY tasks_admin_manager_all ON public.tasks FOR ALL TO authenticated
--   USING (((SELECT auth.jwt()) ->> 'email') = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM app_users
--          WHERE app_users.id = split_part(((SELECT auth.jwt()) ->> 'email'), '@', 1) AND app_users.role = ANY (ARRAY['אדמין','מנהל'])))
--   WITH CHECK (((SELECT auth.jwt()) ->> 'email') = 'admin@tfugen.local' OR EXISTS (SELECT 1 FROM app_users
--          WHERE app_users.id = split_part(((SELECT auth.jwt()) ->> 'email'), '@', 1) AND app_users.role = ANY (ARRAY['אדמין','מנהל'])));
-- COMMIT;
