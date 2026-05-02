-- ===========================================================================
-- EQI RESET + HISTORY MIGRATION (2026-05-02)
-- ===========================================================================
-- Adds the columns needed for the rewritten PDF AI flow and creates a
-- separate `equip_inspection_history` table so each inspection report ever
-- applied to a piece of equipment is preserved (ISO 45001 audit trail).
--
-- Idempotent: safe to re-run.
-- ===========================================================================

-- 1. New columns on equip_inspections
-- file_url + report_number already exist (migrations 2026-05-02_eqi_file_url
-- + 2026-05-02_eqi_report_number).
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS cycle_months int;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS inspector text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS inspection_type text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS next_inspection_date date;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS deficiencies text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS client_name text;

-- 2. History table (one row per inspection ever uploaded — never overwritten)
CREATE TABLE IF NOT EXISTS equip_inspection_history (
  id text PRIMARY KEY,
  equip_id text REFERENCES equip_inspections(id) ON DELETE SET NULL,
  inspection_date date,
  expiry_date date,
  next_inspection_date date,
  inspector text,
  report_number text,
  inspection_type text,
  status text,
  deficiencies text,
  notes text,
  file_url text,
  cycle_months int,
  client_name text,
  vendor text,
  loc text,
  raw_json jsonb,
  ts timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equip_inspection_history_equip_id_idx
  ON equip_inspection_history(equip_id);
CREATE INDEX IF NOT EXISTS equip_inspection_history_report_number_idx
  ON equip_inspection_history(report_number) WHERE report_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS equip_inspection_history_ts_idx
  ON equip_inspection_history(ts DESC);

-- 3. RLS — same admin/manager policy as the rest of the app
ALTER TABLE equip_inspection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equip_inspection_history_admin_manager_all
  ON equip_inspection_history;

CREATE POLICY equip_inspection_history_admin_manager_all
  ON equip_inspection_history
  FOR ALL
  TO authenticated
  USING (public.is_admin_manager())
  WITH CHECK (public.is_admin_manager());
