-- Migration: add feedback columns to ncr_ai
-- Date: 2026-04-30
-- Related: AI Feedback Loop (Vitre §9.2 inspiration)
--
-- Adds 👍/👎 feedback tracking on each NCR Agent analysis version,
-- so the admin can mark which AI outputs were good/bad. Builds a dataset
-- for future prompt tuning.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click Run
--   4. Verify: ncr_ai now has columns feedback, feedback_user, feedback_ts

ALTER TABLE ncr_ai
  ADD COLUMN IF NOT EXISTS feedback      text,
  ADD COLUMN IF NOT EXISTS feedback_user text,
  ADD COLUMN IF NOT EXISTS feedback_ts   timestamptz;

-- Restrict feedback values to 'up' / 'down' / NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ncr_ai_feedback_chk'
  ) THEN
    ALTER TABLE ncr_ai
      ADD CONSTRAINT ncr_ai_feedback_chk
      CHECK (feedback IS NULL OR feedback IN ('up','down'));
  END IF;
END $$;

-- Rollback:
-- ALTER TABLE ncr_ai
--   DROP CONSTRAINT IF EXISTS ncr_ai_feedback_chk,
--   DROP COLUMN IF EXISTS feedback,
--   DROP COLUMN IF EXISTS feedback_user,
--   DROP COLUMN IF EXISTS feedback_ts;
