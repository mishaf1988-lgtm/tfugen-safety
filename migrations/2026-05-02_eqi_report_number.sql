-- Migration: report_number on equip_inspections
-- Date: 2026-05-02
-- Tracks which inspection report (תסקיר number) most recently updated each
-- record, so future PDF uploads can disambiguate between physical equipment
-- that share the same Hebrew name (e.g. multiple "קולט אויר אנכי" units from
-- different vendors).

ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS report_number text;
NOTIFY pgrst, 'reload schema';

-- Rollback (if needed):
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS report_number;
