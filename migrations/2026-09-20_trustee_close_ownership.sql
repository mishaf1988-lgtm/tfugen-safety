-- Trustee closure trigger — ownership check (2026-09-20, security review)
--
-- ⚠ NOT YET RUN. Needs Michael's explicit go-ahead (CLAUDE.md: changing an
--   existing DB function is a destructive-class operation, approved each time).
--
-- THE HOLE
-- private.trustee_reports_close_ref() from 2026-09-18 is SECURITY DEFINER and
-- closes whatever row NEW.ref names, with no check that the person filing the
-- closure is the one who reported the finding:
--
--     UPDATE public.trustee_reports SET s = 'נסגר'
--      WHERE id = NEW.ref AND ok = false AND t BETWEEN 1 AND 7 AND s <> 'נסגר';
--
-- Combined with the two policies the same migration created —
--     emp_select  USING (true)        -- any session reads every finding + its id
--     emp_insert  WITH CHECK (true)   -- any session inserts
-- — and with the no-password trustee screen handing every visitor an anonymous
-- Supabase session, ANY visitor to the public site can:
--   1. list every open hazard and its id, then
--   2. insert {t:8, ref:<id>, ok:true} rows in a loop
-- and silently mark the whole open-findings list 'נסגר'. That empties the
-- manager's findings view and the #591 "reported, routed, still not fixed"
-- alert. The same primitive files reports under any trustee's name (u is free
-- text), which corrupts the scoreboard and the monthly prize.
--
-- THE FIX
-- A closure may only close a finding filed under the SAME trustee name. That is
-- the strongest check available here: an anonymous session carries no identity
-- of its own, so u is all there is. It does not stop a determined person who
-- knows a trustee's name from closing that trustee's own findings — it does
-- stop the enumerate-everything sweep, which is the actual risk.
--
-- Nothing legitimate changes: _truCloseReport (index.html) always files the
-- closure under the same name shown on the trustee's screen, and the manager
-- closes findings through an UPDATE (admin/manager policy), not through this
-- trigger.
--
-- Idempotent: CREATE OR REPLACE. Re-running is safe.

CREATE OR REPLACE FUNCTION private.trustee_reports_close_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.t = 8 AND NEW.ref IS NOT NULL AND NEW.ref <> '' THEN
    UPDATE public.trustee_reports
       SET s = 'נסגר'
     WHERE id = NEW.ref
       AND ok = false
       AND t BETWEEN 1 AND 7
       AND s <> 'נסגר'
       -- added 2026-09-20: only the trustee who filed it may close it
       AND u IS NOT DISTINCT FROM NEW.u;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.trustee_reports_close_ref() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- VERIFY after running (paste into the SQL editor):
--
--   -- 1. the new condition is in the function body
--   SELECT prosrc LIKE '%IS NOT DISTINCT FROM NEW.u%' AS has_ownership_check
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'private' AND p.proname = 'trustee_reports_close_ref';
--   -- expect: t
--
--   -- 2. a closure filed under a DIFFERENT name must not close anything.
--   --    Run inside a transaction and roll back so nothing is left behind.
--   BEGIN;
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,f,s)
--     VALUES ('ztest_find','בדיקה א','2026-09',5,'2026-09-20','בדיקה',false,'ממצא בדיקה','פתוח');
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,s,ref)
--     VALUES ('ztest_close','בדיקה ב','2026-09',8,'2026-09-20','בדיקה',true,'תקין','ztest_find');
--     SELECT s FROM public.trustee_reports WHERE id='ztest_find';   -- expect: פתוח
--     INSERT INTO public.trustee_reports (id,u,m,t,d,loc,ok,s,ref)
--     VALUES ('ztest_close2','בדיקה א','2026-09',8,'2026-09-20','בדיקה',true,'תקין','ztest_find');
--     SELECT s FROM public.trustee_reports WHERE id='ztest_find';   -- expect: נסגר
--   ROLLBACK;
--
-- Rollback of the change itself: re-run 2026-09-18_trustee_reports.sql, which
-- holds the original function body.
