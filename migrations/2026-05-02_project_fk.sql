-- Migration: add project_id FK to ncr + tasks + inc
-- Date: 2026-05-02
-- Lets records be grouped under a named project (Vitre §16#18).
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE ncr    ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE inc    ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ncr_project_idx   ON ncr(project_id)   WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inc_project_idx   ON inc(project_id)   WHERE project_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE ncr DROP COLUMN IF EXISTS project_id;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;
-- ALTER TABLE inc DROP COLUMN IF EXISTS project_id;
