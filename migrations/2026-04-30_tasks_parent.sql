-- Migration: add parent_id to tasks for sub-task hierarchy
-- Date: 2026-04-30
-- Related: Vitre §16#4 — sub-tasks under a parent task.
--
-- Use case: a parent task like "Quarterly safety audit Q2 2026" gets broken
-- into sub-tasks ("inspect fire systems", "review PPE compliance", ...).
-- The parent stays open until all sub-tasks are closed (UX hint, not enforced).
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run
--   4. Verify (optional):
--      SELECT column_name FROM information_schema.columns
--      WHERE table_name='tasks' AND column_name='parent_id';
--      Should return 1 row.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id text;
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON tasks(parent_id) WHERE parent_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE tasks DROP COLUMN IF EXISTS parent_id;
