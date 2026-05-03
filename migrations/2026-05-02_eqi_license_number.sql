-- Migration: license_number on equip_inspections + history
-- Date: 2026-05-02
-- Israeli inspection PDFs for forklifts and engineering equipment carry a
-- "מס׳ רישוי" / "מס׳ ציוד הנדסי" — the equivalent of a license plate, stable
-- across reports and unique per physical unit. Capturing it gives the matcher
-- a deterministic per-unit identifier, far stronger than name+vendor.

ALTER TABLE equip_inspections        ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS license_number text;
NOTIFY pgrst, 'reload schema';
