-- Migration: extra columns for Excel-based equipment intake
-- Date: 2026-05-02
-- The user prepared a 48-row Excel of every inspection-required item plus a
-- 67-row inspection history sheet. The columns there go beyond what the
-- existing schema captures — manufacturer, model, serial, year, inspector
-- certificate/contact, and pressure values for steam boilers. Adding them as
-- explicit text columns so the data stays queryable instead of being dumped
-- into notes blobs.

ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS year_of_production smallint;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS inspector_certificate text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS inspector_phone text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS inspector_address text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS work_pressure text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS test_pressure text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS approved_pressure text;

ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS year_of_production smallint;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS inspector_certificate text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS inspector_phone text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS inspector_address text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS work_pressure text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS test_pressure text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS approved_pressure text;

NOTIFY pgrst, 'reload schema';
