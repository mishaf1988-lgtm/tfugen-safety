-- Migration: ncr_patterns — history of NCR aggregate AI analyses
-- Date: 2026-04-30
-- Related: Pattern Detection AI (Vitre §17 — fixes the "lack of AI depth" gap)
--
-- Each invocation of "ניתוח כללי" (ncrAgentAnalyzeAll) writes one row
-- with the full AI response + the snapshot stats at that point in time.
-- Future trend / comparison features will read from here.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run
--   4. Verify (optional):
--      SELECT count(*) FROM ncr_patterns;  -- starts at 0

CREATE TABLE IF NOT EXISTS ncr_patterns (
  id           bigserial   PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  content      text        NOT NULL,
  open_count   int,
  closed_count int,
  by_area      jsonb,
  by_priority  jsonb,
  by_status    jsonb,
  created_by   text        NOT NULL DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS ncr_patterns_ts_idx ON ncr_patterns(ts DESC);

ALTER TABLE ncr_patterns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'ncr_patterns_admin_manager_all'
  ) THEN
    CREATE POLICY ncr_patterns_admin_manager_all ON ncr_patterns
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS ncr_patterns;
