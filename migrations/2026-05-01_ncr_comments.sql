-- Migration: ncr_comments — discussion thread per NCR
-- Date: 2026-05-01
-- Use case: safety manager and area owner often need back-and-forth
-- coordination on each NCR (clarifications, status updates, photos
-- of follow-up work). Currently the only free-form field is `notes`
-- which gets overwritten. A real comments table preserves the conversation.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS ncr_comments (
  id        bigserial   PRIMARY KEY,
  ncr_id    text        NOT NULL,
  author    text        NOT NULL,
  text      text        NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ncr_comments_ncr_id_ts_idx ON ncr_comments(ncr_id, ts DESC);

ALTER TABLE ncr_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'ncr_comments_admin_manager_all'
  ) THEN
    CREATE POLICY ncr_comments_admin_manager_all ON ncr_comments
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS ncr_comments;
