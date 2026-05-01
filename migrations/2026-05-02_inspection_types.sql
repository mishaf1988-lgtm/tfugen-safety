-- Migration: inspection_types — recurrence templates for inspections
-- Date: 2026-05-02
-- Inspired by Vitre §12.2.
--
-- Each row defines a recurring inspection (e.g. "annual forklift safety").
-- The UI auto-generates virtual tasks N days before the next due date.
--
-- recur_unit: 'day' | 'week' | 'month' | 'year'
-- scope_table: optional — limit to a specific entity table
-- next_due: rolling target date

CREATE TABLE IF NOT EXISTS inspection_types (
  id            text        PRIMARY KEY,
  name          text        NOT NULL,
  scope_table   text,
  recur_count   int         NOT NULL DEFAULT 1,
  recur_unit    text        NOT NULL DEFAULT 'year',
  next_due      date,
  responsible   text,
  notes         text,
  active        boolean     NOT NULL DEFAULT true,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_types_due_idx ON inspection_types(next_due) WHERE active=true;

ALTER TABLE inspection_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'inspection_types_admin_manager_all'
  ) THEN
    CREATE POLICY inspection_types_admin_manager_all ON inspection_types
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS inspection_types;
