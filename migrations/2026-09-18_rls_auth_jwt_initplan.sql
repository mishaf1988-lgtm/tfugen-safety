-- P1 (2026-09-18) — RLS initPlan: wrap auth.jwt() in (select auth.jwt())
--
-- Phase 4 (2026-05) wrapped private.is_admin_manager() in (select ...) so
-- Postgres evaluates it once per statement (InitPlan) instead of once per
-- row. Supabase advisors still flagged 5 policies where a bare auth.jwt()
-- remained and therefore still ran per row. Same treatment here.
--
-- Permission logic is byte-for-byte identical — only the evaluation
-- strategy changes. The live definitions were read from pg_policies before
-- this was written and matched the originals exactly.
--
-- Idempotent: ALTER POLICY is a full replace, safe to re-run.

-- saved_views_own
ALTER POLICY saved_views_own ON public.saved_views
  USING (user_email = ((select auth.jwt()) ->> 'email'))
  WITH CHECK (user_email = ((select auth.jwt()) ->> 'email'));

-- notification_prefs_own
ALTER POLICY notification_prefs_own ON public.notification_prefs
  USING (id = ((select auth.jwt()) ->> 'email'))
  WITH CHECK (id = ((select auth.jwt()) ->> 'email'));

-- app_users_admin_write
ALTER POLICY app_users_admin_write ON public.app_users
  USING (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local')
  WITH CHECK (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local');

-- app_users_read  (is_admin_manager was already wrapped; the jwt half was not)
ALTER POLICY app_users_read ON public.app_users
  USING (
    (SELECT private.is_admin_manager())
    OR (id = split_part(((select auth.jwt()) ->> 'email'), '@', 1))
  );

-- tasks_admin_manager_all
ALTER POLICY tasks_admin_manager_all ON public.tasks
  USING (
    (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local')
    OR (EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.id = split_part(((select auth.jwt()) ->> 'email'), '@', 1)
        AND app_users.role = ANY (ARRAY['אדמין'::text, 'מנהל'::text])
    ))
  )
  WITH CHECK (
    (((select auth.jwt()) ->> 'email') = 'admin@tfugen.local')
    OR (EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.id = split_part(((select auth.jwt()) ->> 'email'), '@', 1)
        AND app_users.role = ANY (ARRAY['אדמין'::text, 'מנהל'::text])
    ))
  );

NOTIFY pgrst, 'reload schema';
