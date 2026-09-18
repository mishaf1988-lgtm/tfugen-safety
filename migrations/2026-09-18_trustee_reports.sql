-- Trustees T1 (2026-09-18) — public.trustee_reports
--
-- One table for the safety-trustee programme ("נאמן בטיחות — המשימות
-- החודשיות", 16.09.2026). Replaces the WhatsApp group as the record of
-- who did which of the 8 monthly tasks, what they found, and whether a
-- reported hazard was actually closed. Spec:
-- project-files/SPEC-trustees-2026-09-18.md
--
-- Columns (short names, house style):
--   u            trustee name as typed/picked in the form
--   m            'YYYY-MM' — derived from d by the BEFORE INSERT trigger
--                when the client does not send it
--   t            task number 1..8 (8 = "מעקב סגירה": the "after" photo)
--   d            date the task was done
--   location_id  area from the locations catalogue (+ loc = free text)
--   ok           true = תקין, false = ליקוי
--   f            the finding
--   photo_url    photo (required by the app for a ליקוי)
--   s            'תקין' | 'פתוח' | 'נסגר'
--   ref          t=8 only: id of the finding this "after" photo closes
--   mgr_note     manager's routing note
--
-- RLS — same trust model as near_miss / rounds (employee mode runs on an
-- anonymous Supabase session, i.e. role `authenticated`):
--   INSERT  any authenticated session            (emp_insert, like near_miss)
--   SELECT  any authenticated session            (needed for the trustee's
--           own score / status view; the WhatsApp group was visible to every
--           trustee too)
--   UPDATE  admin / manager only                 (private.is_admin_manager)
--   DELETE  admin / manager only
-- One policy per command on purpose — no multiple_permissive_policies.
--
-- Closure without UPDATE rights: a trustee "closes" a hazard by inserting a
-- t=8 report with ref = the hazard's id. The AFTER INSERT trigger (security
-- definer, fixed search_path) flips that one row to s='נסגר'. The manager
-- can reopen (UPDATE s='פתוח') at any time.
--
-- Idempotent: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.trustee_reports (
  id          text        PRIMARY KEY,
  u           text        NOT NULL,
  m           text        NOT NULL,
  t           smallint    NOT NULL CHECK (t BETWEEN 1 AND 8),
  d           date        NOT NULL,
  location_id text,
  loc         text,
  ok          boolean     NOT NULL DEFAULT true,
  f           text,
  photo_url   text,
  s           text        NOT NULL DEFAULT 'פתוח',
  ref         text,
  mgr_note    text,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trustee_reports_m_idx   ON public.trustee_reports (m);
CREATE INDEX IF NOT EXISTS trustee_reports_ts_idx  ON public.trustee_reports (ts);
CREATE INDEX IF NOT EXISTS trustee_reports_ref_idx ON public.trustee_reports (ref) WHERE ref IS NOT NULL;

-- Normalise on the way in: derive the month, and a "תקין" report is never
-- an open hazard whatever the client sent for s.
CREATE OR REPLACE FUNCTION private.trustee_reports_before_ins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.m IS NULL OR NEW.m = '' THEN
    NEW.m := to_char(NEW.d, 'YYYY-MM');
  END IF;
  IF NEW.ok AND (NEW.s IS NULL OR NEW.s = '' OR NEW.s = 'פתוח') THEN
    NEW.s := 'תקין';
  END IF;
  IF NOT NEW.ok AND (NEW.s IS NULL OR NEW.s = '' OR NEW.s = 'תקין') THEN
    NEW.s := 'פתוח';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trustee_reports_before_ins ON public.trustee_reports;
CREATE TRIGGER trustee_reports_before_ins
  BEFORE INSERT ON public.trustee_reports
  FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_before_ins();

-- A t=8 "after" report closes the hazard it references. Runs as the
-- function owner so the anonymous trustee session, which has no UPDATE
-- right on the table, can still close exactly that one row.
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
       AND s <> 'נסגר';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trustee_reports_close_ref ON public.trustee_reports;
CREATE TRIGGER trustee_reports_close_ref
  AFTER INSERT ON public.trustee_reports
  FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_close_ref();

-- Trigger functions are internal: nothing calls them through the API.
REVOKE ALL ON FUNCTION private.trustee_reports_before_ins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trustee_reports_close_ref()  FROM PUBLIC, anon, authenticated;

-- RLS
ALTER TABLE public.trustee_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emp_insert ON public.trustee_reports;
CREATE POLICY emp_insert ON public.trustee_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS emp_select ON public.trustee_reports;
CREATE POLICY emp_select ON public.trustee_reports
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS trustee_reports_admin_manager_update ON public.trustee_reports;
CREATE POLICY trustee_reports_admin_manager_update ON public.trustee_reports
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin_manager()))
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustee_reports_admin_manager_delete ON public.trustee_reports;
CREATE POLICY trustee_reports_admin_manager_delete ON public.trustee_reports
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin_manager()));

-- Realtime (skip silently if already in the publication).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trustee_reports';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify (run as postgres):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='trustee_reports';
--   Expected 4 rows: emp_insert INSERT, emp_select SELECT,
--   trustee_reports_admin_manager_update UPDATE, trustee_reports_admin_manager_delete DELETE.
--
-- Rollback:
--   DROP TABLE public.trustee_reports;                      -- drops its triggers + policies
--   DROP FUNCTION private.trustee_reports_before_ins();
--   DROP FUNCTION private.trustee_reports_close_ref();
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.trustee_reports;
