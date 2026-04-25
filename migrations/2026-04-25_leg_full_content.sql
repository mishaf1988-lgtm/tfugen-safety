-- Migration: extend leg table for full law/regulation content
-- Date: 2026-04-25
--
-- The 'leg' (legal register) table previously had only minimal fields
-- (subject, description, area, compliance status). Expanding it to a
-- proper Israeli safety+environment law database with:
--   topic       - sub-area (e.g. עבודה בגובה, חומרים מסוכנים, רעש)
--   law_type    - חוק / תקנה / תקן ישראלי / הנחיה / נוהל
--   law_num     - identifier (e.g. 'התש"ד-1954' or '5754-1954')
--   src_url     - link to the source (Nevo, knesset.gov.il, gov.il)
--   summary     - 1-3 line summary
--   full_text   - the law's full text (long; for AI Q&A grounding)
--   last_review - when the user last reviewed this entry
--
-- All columns are TEXT/DATE and NULLABLE so existing rows are unaffected.
-- Safe to re-run: every ALTER uses IF NOT EXISTS.

ALTER TABLE leg ADD COLUMN IF NOT EXISTS topic       TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS law_type    TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS law_num     TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS src_url     TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS summary     TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS full_text   TEXT;
ALTER TABLE leg ADD COLUMN IF NOT EXISTS last_review DATE;

CREATE INDEX IF NOT EXISTS leg_topic_idx ON leg(topic);
CREATE INDEX IF NOT EXISTS leg_a_idx     ON leg(a);

-- Verify (run separately):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='leg'
--  ORDER BY ordinal_position;
-- Expected: original columns + 7 new columns above.

-- Rollback:
-- ALTER TABLE leg DROP COLUMN IF EXISTS topic;
-- ALTER TABLE leg DROP COLUMN IF EXISTS law_type;
-- ALTER TABLE leg DROP COLUMN IF EXISTS law_num;
-- ALTER TABLE leg DROP COLUMN IF EXISTS src_url;
-- ALTER TABLE leg DROP COLUMN IF EXISTS summary;
-- ALTER TABLE leg DROP COLUMN IF EXISTS full_text;
-- ALTER TABLE leg DROP COLUMN IF EXISTS last_review;
