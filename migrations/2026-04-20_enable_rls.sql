-- Migration: Enable RLS on all tables + allow authenticated role full access
-- Date: 2026-04-20
-- Purpose: Block anonymous REST access. App uses Supabase Anonymous Sign-In,
--          so every real user of the app gets the "authenticated" role.
--          Attackers hitting REST with just the anon key (no session) are blocked.

-- Prerequisite — enable Anonymous Sign-Ins in Supabase dashboard:
--   Authentication → Providers → Anonymous → toggle ON
-- Without that step, the app will fail to authenticate after this migration runs.

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: every table listed below shows "RLS enabled" with a policy
--    named "authenticated_all" in the Table Editor → Policies tab

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med',
    'ins','drl','ctr','wst','hzm','env','leg','equip_inspections',
    'near_miss','rounds','hearing_tests','ncr_ai'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- Enable RLS (no-op if already enabled)
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop existing policy if re-running this migration
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);

    -- Allow any authenticated user (including anonymous sign-in) full access
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Rollback (if needed — restores previous open state):
-- DO $$ DECLARE t text; tbls text[] := ARRAY['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med','ins','drl','ctr','wst','hzm','env','leg','equip_inspections','near_miss','rounds','hearing_tests','ncr_ai']; BEGIN FOREACH t IN ARRAY tbls LOOP EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t); EXECUTE format('ALTER TABLE IF EXISTS public.%I DISABLE ROW LEVEL SECURITY', t); END LOOP; END $$;
