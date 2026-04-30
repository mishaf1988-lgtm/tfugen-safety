-- Migration: add ext_id (external integration ID) to main entities
-- Date: 2026-04-30
-- Related: Vitre §16#13 — every entity carries an external ID alongside its
-- internal id, enabling future integration with ERP/SAP/payroll without
-- a painful data migration.
--
-- Strategy: add now (cheap), populate later (per integration). All NULL
-- until the user maps records. No effect on existing functionality.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click Run
--   4. Verify (optional):
--      SELECT table_name, column_name FROM information_schema.columns
--      WHERE column_name='ext_id' ORDER BY table_name;
--      Should return 7 rows.

-- Core safety entities (most likely to need integration first)
ALTER TABLE ncr                ADD COLUMN IF NOT EXISTS ext_id text;
ALTER TABLE equip_inspections  ADD COLUMN IF NOT EXISTS ext_id text;
ALTER TABLE emp                ADD COLUMN IF NOT EXISTS ext_id text;

-- Compliance/training tables
ALTER TABLE tr   ADD COLUMN IF NOT EXISTS ext_id text;
ALTER TABLE ppe  ADD COLUMN IF NOT EXISTS ext_id text;
ALTER TABLE med  ADD COLUMN IF NOT EXISTS ext_id text;

-- Tasks (CAPA tracking — likely target for project management integrations)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ext_id text;

-- Indexes for lookup-by-ext_id (partial: only rows with ext_id set)
CREATE INDEX IF NOT EXISTS ncr_ext_id_idx               ON ncr(ext_id)               WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equip_inspections_ext_id_idx ON equip_inspections(ext_id) WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS emp_ext_id_idx               ON emp(ext_id)               WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tr_ext_id_idx                ON tr(ext_id)                WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ppe_ext_id_idx               ON ppe(ext_id)               WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS med_ext_id_idx               ON med(ext_id)               WHERE ext_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_ext_id_idx             ON tasks(ext_id)             WHERE ext_id IS NOT NULL;

-- Rollback (if needed):
-- ALTER TABLE ncr               DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE emp               DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE tr                DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE ppe               DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE med               DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE tasks             DROP COLUMN IF EXISTS ext_id;
