-- Migration: enable Realtime (postgres_changes) on all app tables
-- Date: 2026-04-19
--
-- How to run:
-- 1. Open Supabase dashboard -> SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
--
-- This adds each table to the built-in `supabase_realtime` publication so
-- the client receives INSERT/UPDATE/DELETE events in real time.
-- Tables that are already in the publication are skipped silently.

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','med',
    'ins','drl','ctr','wst','hzm','env','leg',
    'equip_inspections','near_miss','rounds'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- Verify (optional, paste separately):
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
