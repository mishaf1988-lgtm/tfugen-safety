-- Trustees roster (2026-09-18) — public.trustees + trustee_reports.tour
--
-- Michael's spreadsheet "מעקב נאמני בטיחות" lists the trustees who may
-- report. The app now offers that list (instead of free text) and the
-- manager maintains it from the trustees page — no code change when a
-- trustee joins or leaves.
--
-- Columns: n name · dep department / area of responsibility · ph phone ·
-- active (inactive = kept for history, not offered in the picker) · notes.
--
-- RLS — same trust model as trustee_reports, one policy per command:
--   SELECT  any authenticated session (the anonymous trustee session needs
--           the list to pick a name)
--   INSERT / UPDATE / DELETE  admin / manager only
--
-- Also: trustee_reports.tour — one tour (a visit covering several tasks and
-- several findings) is saved as several rows sharing a tour id.
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS public.trustees (
  id      text        PRIMARY KEY,
  n       text        NOT NULL,
  dep     text,
  ph      text,
  active  boolean     NOT NULL DEFAULT true,
  notes   text,
  ts      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trustees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trustees_read ON public.trustees;
CREATE POLICY trustees_read ON public.trustees
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS trustees_admin_manager_insert ON public.trustees;
CREATE POLICY trustees_admin_manager_insert ON public.trustees
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustees_admin_manager_update ON public.trustees;
CREATE POLICY trustees_admin_manager_update ON public.trustees
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin_manager()))
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustees_admin_manager_delete ON public.trustees;
CREATE POLICY trustees_admin_manager_delete ON public.trustees
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin_manager()));

-- Seed: the roster sheet (16.09.2026). Phone column was a placeholder ("24") — not copied.
INSERT INTO public.trustees (id, n, dep, notes) VALUES
  ('tru_01', 'לב',          'ייצור ואריזה', NULL),
  ('tru_02', 'גלינה',       'מעבדה',        NULL),
  ('tru_03', 'ויטלי ויינר', 'אחזקה',        NULL),
  ('tru_04', 'טטינה',       'מעוצבים',      NULL),
  ('tru_05', 'מוסא',        'חומר גלם',     NULL),
  ('tru_06', 'רנט',         'מט"ש וסביבה',  NULL),
  ('tru_07', 'עאיד',        'תוצ"ג',        NULL),
  ('tru_08', 'יוני',        'חומר גלם',     'בהסמכה')
ON CONFLICT (id) DO NOTHING;

-- One tour = several rows sharing a tour id (nullable; old rows stay null).
ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS tour text;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trustees';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='trustees';   -- 4 rows
--   SELECT count(*) FROM public.trustees;                                  -- 8
-- Rollback:
--   DROP TABLE public.trustees;
--   ALTER TABLE public.trustee_reports DROP COLUMN tour;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.trustees;
