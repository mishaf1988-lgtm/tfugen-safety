-- Migration: add location_id to incidents (inc) + hearing_tests
-- Date: 2026-05-02
-- Continues the location FK rollout. Both tables benefit from structured
-- location data (incidents happen at a location, hearing tests can be
-- aggregated by area to spot noise hotspots).
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

ALTER TABLE inc            ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE hearing_tests  ADD COLUMN IF NOT EXISTS location_id text REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inc_location_idx           ON inc(location_id)           WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hearing_tests_location_idx ON hearing_tests(location_id) WHERE location_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE inc DROP COLUMN IF EXISTS location_id;
-- ALTER TABLE hearing_tests DROP COLUMN IF EXISTS location_id;
