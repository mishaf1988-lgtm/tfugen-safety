-- Migration: add ncr_ai table for storing NCR AI analyses
-- Date: 2026-04-18
-- Related: routine/ncr-agent-db-save-2026-04-18

-- How to run:
-- 1. Open Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Verify: table ncr_ai appears under Tables

CREATE TABLE IF NOT EXISTS ncr_ai (
  id              bigserial     PRIMARY KEY,
  ncr_id          text          NOT NULL,
  version         int           NOT NULL DEFAULT 1,
  risk            text,
  rc              text,
  ia              text,
  ca              jsonb,
  prev            text,
  owner_suggested text,
  due_suggested   date,
  ts              timestamptz   NOT NULL DEFAULT now(),
  created_by      text          NOT NULL DEFAULT 'ai'
);

CREATE INDEX IF NOT EXISTS ncr_ai_ncr_id_idx ON ncr_ai(ncr_id);
CREATE INDEX IF NOT EXISTS ncr_ai_ncr_id_version_idx ON ncr_ai(ncr_id, version DESC);

-- Match the access model of other tables (publishable key / anon role).
ALTER TABLE ncr_ai DISABLE ROW LEVEL SECURITY;

-- Rollback (if needed):
-- DROP TABLE ncr_ai;
