-- Migration: add location_id to ptw + equip_inspections + hzm
-- Date: 2026-05-01
-- Continues the location FK rollout (after ncr + near_miss).
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE ptw                ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE equip_inspections  ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE hzm                ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ptw_location_idx               ON ptw(location_id)               WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equip_inspections_location_idx ON equip_inspections(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hzm_location_idx               ON hzm(location_id)               WHERE location_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE ptw DROP COLUMN IF EXISTS location_id;
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS location_id;
-- ALTER TABLE hzm DROP COLUMN IF EXISTS location_id;
