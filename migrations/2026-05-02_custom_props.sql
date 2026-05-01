-- Migration: custom_props — generic key-value storage per record
-- Date: 2026-05-02
-- Lets the user add ad-hoc fields to any record in any table without
-- schema migrations. Inspired by Vitre §16#5.
--
-- Examples:
--   entity_table='ctr'  entity_id='C-042'  k='ביטוח עד'    v='2026-12-31'
--   entity_table='ncr'  entity_id='abc123' k='גורם חיצוני' v='קבלן XYZ'
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS custom_props (
  id            text        PRIMARY KEY,
  entity_table  text        NOT NULL,
  entity_id     text        NOT NULL,
  k             text        NOT NULL,
  v             text,
  ts            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_props_entity_idx ON custom_props(entity_table, entity_id);

ALTER TABLE custom_props ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'custom_props_admin_manager_all'
  ) THEN
    CREATE POLICY custom_props_admin_manager_all ON custom_props
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS custom_props;
