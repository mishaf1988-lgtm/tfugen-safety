-- Migration: projects — group records under named projects
-- Date: 2026-05-02
-- Inspired by Vitre §16#18 (Project-Form-Employee triad).
--
-- Examples:
--   id='PRJ-001' name='שדרוג קווי ייצור 2026' status='פעיל'
--   id='PRJ-002' name='הסבת אמוניה לפריאון' status='הושלם'
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS projects (
  id           text        PRIMARY KEY,
  name         text        NOT NULL,
  description  text,
  start_date   date,
  end_date     date,
  status       text        DEFAULT 'פעיל',
  ts           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'projects_admin_manager_all'
  ) THEN
    CREATE POLICY projects_admin_manager_all ON projects
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS projects;
