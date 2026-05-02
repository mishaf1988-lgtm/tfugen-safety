-- Migration: issue_types — hierarchical NCR/incident category tree
-- Date: 2026-05-02
-- Inspired by Vitre §6.3 (71 issue types in hierarchy).
--
-- Examples:
--   level 1: 'מפגעי בטיחות'
--   level 2 under it: 'החלקות, מעידות ונפילות', 'חומרים מסוכנים'
--   level 3 under "החלקות": 'שמן/מים על הרצפה', 'בור/תעלת ניקוז פתוחים'
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS issue_types (
  id         text        PRIMARY KEY,
  name       text        NOT NULL,
  parent_id  text        REFERENCES issue_types(id) ON DELETE RESTRICT,
  level      smallint    NOT NULL CHECK (level BETWEEN 1 AND 3),
  category   text,
  notes      text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_types_parent_idx ON issue_types(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS issue_types_level_idx ON issue_types(level);

ALTER TABLE issue_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'issue_types_admin_manager_all'
  ) THEN
    CREATE POLICY issue_types_admin_manager_all ON issue_types
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Add issue_type_id to NCR + incidents for classification
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS issue_type_id text REFERENCES issue_types(id) ON DELETE SET NULL;
ALTER TABLE inc ADD COLUMN IF NOT EXISTS issue_type_id text REFERENCES issue_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ncr_issue_type_idx ON ncr(issue_type_id) WHERE issue_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inc_issue_type_idx ON inc(issue_type_id) WHERE issue_type_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE ncr DROP COLUMN IF EXISTS issue_type_id;
-- ALTER TABLE inc DROP COLUMN IF EXISTS issue_type_id;
-- DROP TABLE IF EXISTS issue_types;
