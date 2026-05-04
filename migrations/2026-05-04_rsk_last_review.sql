-- Migration: rsk last_review column for periodic review tracking
-- Date: 2026-05-04
-- ISO 45001:6.1.2 / 6.1.4 — risk assessments must be periodically reviewed
-- (typically annually). Mirrors the same pattern added to env_aspects and
-- the Legal Register earlier this year.
--
-- Run: paste in Supabase SQL Editor → Run.

ALTER TABLE rsk ADD COLUMN IF NOT EXISTS last_review date;

NOTIFY pgrst, 'reload schema';

-- Verify (optional):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='rsk' AND column_name='last_review';
-- Expected: 1 row.

-- Rollback:
-- ALTER TABLE rsk DROP COLUMN IF EXISTS last_review;
