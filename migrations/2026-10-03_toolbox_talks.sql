-- Weekly safety talk read and signed by each worker (הדרכה שבועית אישית), 03/10/2026.
-- Michael: every worker (no user account) reads the weekly talk and signs at the
-- end, instead of the group signature through Vitre. Content: Michael uploads
-- every week. Identity: name from the list + finger signature. Device: personal
-- phone and a shared tablet. Languages: he, ar, ru, am.
-- Stage 1 (this file): the two tables, admin/manager only. The anonymous worker
-- path (stage 2) gets its own migration and its own review.
--
-- toolbox_talks: one row per weekly talk
--   d        week date      title, body  Hebrew text (body_ar/ru/am: stage 3)
--   file_url optional file  s            טיוטה / פורסמה (workers see only פורסמה)
-- toolbox_reads: one row per worker signature
--   talk_id  the talk (FK, no cascade: a talk with signatures is evidence and
--            cannot be deleted by accident)
--   emp_id, emp_name, dept, lang, sig_url, device, read_at
-- Access: as tour_hazards. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.toolbox_talks (
  id         text PRIMARY KEY,
  d          date,
  title      text NOT NULL,
  body       text,
  body_ar    text,
  body_ru    text,
  body_am    text,
  file_url   text,
  s          text NOT NULL DEFAULT 'טיוטה',
  created_by text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.toolbox_reads (
  id        text PRIMARY KEY,
  talk_id   text NOT NULL REFERENCES public.toolbox_talks(id),
  emp_id    text,
  emp_name  text NOT NULL,
  dept      text,
  lang      text,
  sig_url   text,
  device    text,
  read_at   timestamptz NOT NULL DEFAULT now(),
  ts        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS toolbox_reads_talk_id_idx ON public.toolbox_reads(talk_id);

-- Plain statements, no DO block: through the Supabase connector a DO $$ block
-- timed out three times (03/10/2026) while the same statements one by one ran.
-- RLS and REVOKE come first: a new table is open to anon until they run.
ALTER TABLE public.toolbox_talks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.toolbox_talks FROM anon;
DROP POLICY IF EXISTS toolbox_talks_admin_manager_all ON public.toolbox_talks;
CREATE POLICY toolbox_talks_admin_manager_all ON public.toolbox_talks FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager())) WITH CHECK ((SELECT private.is_admin_manager()));
DROP POLICY IF EXISTS viewer_read ON public.toolbox_talks;
CREATE POLICY viewer_read ON public.toolbox_talks FOR SELECT TO authenticated USING ((SELECT private.is_viewer()));
DROP POLICY IF EXISTS viewer_no_insert ON public.toolbox_talks;
DROP POLICY IF EXISTS viewer_no_update ON public.toolbox_talks;
DROP POLICY IF EXISTS viewer_no_delete ON public.toolbox_talks;
DROP POLICY IF EXISTS mfa_required ON public.toolbox_talks;
DROP POLICY IF EXISTS pwchange_required ON public.toolbox_talks;
CREATE POLICY viewer_no_insert ON public.toolbox_talks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_update ON public.toolbox_talks AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_delete ON public.toolbox_talks AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY mfa_required ON public.toolbox_talks AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()));
CREATE POLICY pwchange_required ON public.toolbox_talks AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
  WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_talks TO authenticated;

ALTER TABLE public.toolbox_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.toolbox_reads FROM anon;
DROP POLICY IF EXISTS toolbox_reads_admin_manager_all ON public.toolbox_reads;
CREATE POLICY toolbox_reads_admin_manager_all ON public.toolbox_reads FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager())) WITH CHECK ((SELECT private.is_admin_manager()));
DROP POLICY IF EXISTS viewer_read ON public.toolbox_reads;
CREATE POLICY viewer_read ON public.toolbox_reads FOR SELECT TO authenticated USING ((SELECT private.is_viewer()));
DROP POLICY IF EXISTS viewer_no_insert ON public.toolbox_reads;
DROP POLICY IF EXISTS viewer_no_update ON public.toolbox_reads;
DROP POLICY IF EXISTS viewer_no_delete ON public.toolbox_reads;
DROP POLICY IF EXISTS mfa_required ON public.toolbox_reads;
DROP POLICY IF EXISTS pwchange_required ON public.toolbox_reads;
CREATE POLICY viewer_no_insert ON public.toolbox_reads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_update ON public.toolbox_reads AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_delete ON public.toolbox_reads AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY mfa_required ON public.toolbox_reads AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()));
CREATE POLICY pwchange_required ON public.toolbox_reads AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
  WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_reads TO authenticated;


-- Applied 03/10/2026 via execute_sql and verified: 7 policies on each table (same
-- set as tour_hazards), anon SELECT/INSERT false, authenticated INSERT true,
-- db_columns_snapshot refreshed to 624 columns, drift empty.
-- Verify:
-- SELECT tablename, count(*) FROM pg_policies WHERE tablename IN ('toolbox_talks','toolbox_reads') GROUP BY 1;  -- 7 each
-- SELECT has_table_privilege('anon','public.toolbox_talks','SELECT'), has_table_privilege('anon','public.toolbox_reads','SELECT');  -- false, false
--
-- Rollback (destructive, needs Michael's explicit OK; back up the rows first):
-- DROP TABLE public.toolbox_reads; DROP TABLE public.toolbox_talks;
