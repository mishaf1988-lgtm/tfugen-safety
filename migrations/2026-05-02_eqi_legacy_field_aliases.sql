-- Migration: legacy field aliases for equip_inspections
-- Date: 2026-05-02
-- Reason: Older versions of the PDF inspection flow wrote 'status' and
-- 'last_inspection_date' columns instead of the canonical 's' and 'd'.
-- Service-worker caching makes it hard to be sure every client has the
-- new code. Adding alias columns + trigger ensures old-code writes still
-- succeed AND the data ends up on the canonical columns.

ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE equip_inspections ADD COLUMN IF NOT EXISTS last_inspection_date date;

CREATE OR REPLACE FUNCTION equip_inspections_alias_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT NULL AND (NEW.s IS NULL OR NEW.s = '') THEN NEW.s := NEW.status; END IF;
  IF NEW.last_inspection_date IS NOT NULL AND NEW.d IS NULL THEN NEW.d := NEW.last_inspection_date; END IF;
  -- Keep alias columns NULL after copying so they don't drift from canonical.
  NEW.status := NULL;
  NEW.last_inspection_date := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_eqi_alias_sync ON equip_inspections;
CREATE TRIGGER trg_eqi_alias_sync
  BEFORE INSERT OR UPDATE ON equip_inspections
  FOR EACH ROW EXECUTE FUNCTION equip_inspections_alias_sync();

NOTIFY pgrst, 'reload schema';

-- Rollback (if needed):
-- DROP TRIGGER IF EXISTS trg_eqi_alias_sync ON equip_inspections;
-- DROP FUNCTION IF EXISTS equip_inspections_alias_sync();
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS status;
-- ALTER TABLE equip_inspections DROP COLUMN IF EXISTS last_inspection_date;
