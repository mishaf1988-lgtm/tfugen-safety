-- Migration: locations — hierarchical location tree (אזור → קו → תחנה)
-- Date: 2026-05-01
-- Standardizes location entries across NCR, PTW, near_miss, equip_inspections,
-- hazmat — replaces free-text fields with cascading dropdowns.
--
-- 3 levels:
--   level 1: אזור (Area)         — e.g. "מחלקת ייצור", "אחסון", "מטבח"
--   level 2: קו ייצור (Line)     — e.g. "קו 1 - שניצלים" (parent: ייצור)
--   level 3: תחנה (Station)      — e.g. "תחנת אריזה" (parent: קו 1)
--
-- parent_id NULL on level 1; level 2 parent must be level 1; level 3 parent must be level 2.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

CREATE TABLE IF NOT EXISTS locations (
  id         text        PRIMARY KEY,
  name       text        NOT NULL,
  parent_id  text        REFERENCES locations(id) ON DELETE RESTRICT,
  level      smallint    NOT NULL CHECK (level BETWEEN 1 AND 3),
  notes      text,
  ts         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locations_parent_idx ON locations(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS locations_level_idx ON locations(level);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'locations_admin_manager_all'
  ) THEN
    CREATE POLICY locations_admin_manager_all ON locations
      FOR ALL
      TO authenticated
      USING (private.is_admin_manager())
      WITH CHECK (private.is_admin_manager());
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS locations;
