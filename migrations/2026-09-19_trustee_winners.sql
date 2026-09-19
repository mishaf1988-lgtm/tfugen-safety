-- Trustee monthly winner (2026-09-19, phase 2) — public.trustee_winners
--
-- The competition ran to a leaderboard but nobody was ever declared. The
-- manager now announces one winner per month; the trustees see it on their
-- own screen, and past winners become the "who hasn't won yet" tie-break.
--
-- Columns: m month 'YYYY-MM' (one winner per month) · u the trustee's name
-- as it appears in trustee_reports.u · pts the score at announcement time
-- (kept as-is: a later report must not rewrite history) · note optional.
--
-- id is deterministic ('win_' || m) so re-announcing the same month updates
-- the same row instead of creating a second one.
--
-- RLS — same trust model as trustees, one policy per command (keeps the
-- multiple_permissive_policies advisor at its accepted baseline):
--   SELECT  any authenticated session (the anonymous trustee session shows
--           the winner banner on the trustee screen)
--   INSERT / UPDATE / DELETE  admin / manager only
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.trustee_winners (
  id    text        PRIMARY KEY,
  m     text        NOT NULL UNIQUE,
  u     text        NOT NULL,
  pts   integer,
  note  text,
  ts    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trustee_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trustee_winners_read ON public.trustee_winners;
CREATE POLICY trustee_winners_read ON public.trustee_winners
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS trustee_winners_admin_manager_insert ON public.trustee_winners;
CREATE POLICY trustee_winners_admin_manager_insert ON public.trustee_winners
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustee_winners_admin_manager_update ON public.trustee_winners;
CREATE POLICY trustee_winners_admin_manager_update ON public.trustee_winners
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin_manager()))
  WITH CHECK ((SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS trustee_winners_admin_manager_delete ON public.trustee_winners;
CREATE POLICY trustee_winners_admin_manager_delete ON public.trustee_winners
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin_manager()));

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trustee_winners';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='trustee_winners';  -- 4 rows
--   SELECT * FROM public.trustee_winners ORDER BY m DESC;                        -- empty at first
-- Rollback:
--   DROP TABLE public.trustee_winners;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.trustee_winners;
