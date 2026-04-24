-- Migration: add missing rc + ts columns to ncr
-- Date: 2026-04-24
--
-- Context: final schema drift fix on the ncr table.
-- Diagnostic SELECT on information_schema.columns confirmed
-- production has 18 columns but is missing:
--   - rc  : root-cause short (svNcr sends it on every save)
--   - ts  : save timestamp (svNcr sends it on every save)
--
-- Previous drift fixes:
--   2026-04-22_ncr_columns.sql   : cd / sd / loc / root_cause / immediate
--   2026-04-24_ncr_notes_column.sql : notes
--
-- After running this, every column that svNcr (index.html:1713-1728)
-- sends will exist, and the outbox can retry pending ins ncr ops
-- cleanly.
--
-- Note: xlParse (Excel importer) also sends `src_date`, which is a
-- naming inconsistency with svNcr's `sd`. NOT fixed here — requires
-- either a code change in xlParse or a separate column. Tracked as
-- future item; does not block task B or normal user flow.
--
-- Safe to re-run: both ALTERs use IF NOT EXISTS.

ALTER TABLE ncr ADD COLUMN IF NOT EXISTS rc  TEXT;
ALTER TABLE ncr ADD COLUMN IF NOT EXISTS ts  TIMESTAMPTZ;

-- Verify:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='ncr'
--    AND column_name IN ('rc','ts')
--  ORDER BY column_name;
-- Expected: 2 rows — rc|text, ts|timestamp with time zone

-- Rollback (destructive):
-- ALTER TABLE ncr DROP COLUMN IF EXISTS rc;
-- ALTER TABLE ncr DROP COLUMN IF EXISTS ts;
