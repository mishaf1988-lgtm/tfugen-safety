-- Manager hazard tours (סיורי מפגעים של הממונה), 2026-09-27.
-- DECISIONS 2026-09-27: entered in the app, in a module separate from the
-- trustees; the folder-13 Excel file will be written from this table (stage 3).
-- One row per hazard found on a weekly/monthly tour. Mirrors the columns of
-- the existing sheet "מאגר מפגעים", so the file keeps its structure.
--   n          מס"ד (running number, kept from the sheet)
--   d          tour date (null = unknown, tours 1-2 of June 2026)
--   tour_no    tour number
--   dept       department toured (= the department that gets the report)
--   loc        location, free text; location_id optional link to locations
--   descr      the hazard
--   sev        גבוהה / בינונית / נמוכה
--   resp       responsible: מנהל המחלקה / אחזקה / חשמל / הנדסה / בטיחות
--   action     required action
--   due        target date
--   s          פתוח / בטיפול / סגור
--   closed_d   actual closing date (null on a closed row = unknown)
--   notes, photo_url, ts
-- Access: same as toolbox. Admin/manager read+write, viewer reads, the
-- RESTRICTIVE MFA / password-change / viewer-no-write policies as on every table.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.tour_hazards (
  id          text PRIMARY KEY,
  n           integer,
  d           date,
  tour_no     integer,
  dept        text NOT NULL,
  loc         text,
  location_id text,
  descr       text NOT NULL,
  sev         text,
  resp        text,
  action      text,
  due         date,
  s           text NOT NULL DEFAULT 'פתוח',
  closed_d    date,
  notes       text,
  photo_url   text,
  ts          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tour_hazards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tour_hazards_admin_manager_all ON public.tour_hazards;
CREATE POLICY tour_hazards_admin_manager_all ON public.tour_hazards FOR ALL TO authenticated
  USING ((SELECT private.is_admin_manager())) WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS viewer_read ON public.tour_hazards;
CREATE POLICY viewer_read ON public.tour_hazards FOR SELECT TO authenticated
  USING ((SELECT private.is_viewer()));

DROP POLICY IF EXISTS viewer_no_insert ON public.tour_hazards;
DROP POLICY IF EXISTS viewer_no_update ON public.tour_hazards;
DROP POLICY IF EXISTS viewer_no_delete ON public.tour_hazards;
DROP POLICY IF EXISTS mfa_required ON public.tour_hazards;
DROP POLICY IF EXISTS pwchange_required ON public.tour_hazards;
CREATE POLICY viewer_no_insert ON public.tour_hazards AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_update ON public.tour_hazards AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY viewer_no_delete ON public.tour_hazards AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT private.is_viewer()));
CREATE POLICY mfa_required ON public.tour_hazards AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.mfa_ok())) WITH CHECK ((SELECT private.mfa_ok()));
CREATE POLICY pwchange_required ON public.tour_hazards AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false)
  WITH CHECK (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'must_change_password')::boolean, false) = false);

-- anon gets nothing (no trustee-style anonymous path to this table).
REVOKE ALL ON public.tour_hazards FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_hazards TO authenticated;

-- Verify:
-- SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename='tour_hazards' ORDER BY 1;  -- 7 rows
-- SELECT has_table_privilege('anon','public.tour_hazards','SELECT');                             -- false
--
-- Rollback (destructive, needs Michael's explicit OK; back up the rows first):
-- DROP TABLE public.tour_hazards;
