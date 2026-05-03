-- Migration: split license_number from internal_number
-- Date: 2026-05-02
-- License-plate-like numbers are only meaningful for forklifts and other
-- engineering equipment that the State actually licenses. For other items
-- (boilers, lifting accessories, ...) the column-I "מס׳ פנימי" we were
-- shoving into license_number is just an internal factory serial — useful
-- to keep, but mislabeled.
--
-- Add internal_number; move non-forklift license_number values into it;
-- strip the "מס׳ רישוי: " prefix from forklift license_number values
-- (a leftover from earlier AI extraction that produced double labels).

ALTER TABLE equip_inspections        ADD COLUMN IF NOT EXISTS internal_number text;
ALTER TABLE equip_inspection_history ADD COLUMN IF NOT EXISTS internal_number text;

UPDATE equip_inspections
SET internal_number = license_number,
    license_number  = NULL
WHERE license_number IS NOT NULL
  AND COALESCE(inspection_type,'') NOT LIKE '%מלגזה%';

UPDATE equip_inspections
SET license_number = TRIM(REGEXP_REPLACE(license_number, '^מס[״''׳]? רישוי[:\s]*', '', 'i'))
WHERE license_number ~ '^מס';

NOTIFY pgrst, 'reload schema';
