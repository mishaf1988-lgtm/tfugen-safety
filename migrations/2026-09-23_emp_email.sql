-- 2026-09-23 — email column on emp, for the Vitre → emp employee import.
--
-- Vitre's GET /Employee returns phone + email per employee. emp had ph but no
-- email column, so the import (index.html: _vitreImportPreview / _vitreImportApply)
-- writes email into emp.em. Same one-letter style as n / r / dep / ph.
--
-- Applied 2026-09-23 via Supabase MCP (apply_migration "emp_email_vitre_import")
-- and verified in information_schema.columns. Idempotent: safe to re-run.

ALTER TABLE public.emp ADD COLUMN IF NOT EXISTS em text;

-- Rollback (manual, only if needed):
-- ALTER TABLE public.emp DROP COLUMN IF EXISTS em;
