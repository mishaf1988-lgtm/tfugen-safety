-- 2026-09-23 — toolbox: columns for the Vitre weekly-refresher import.
--
-- Managers keep submitting "טופס ביצוע ריענון בטיחות שבועיות" in Vitre (Michael,
-- 23/09: no change to their routine). Every submission is pulled into our
-- toolbox (שיחת בטיחות) table: date, presenter, ticked departments, photo.
--   dep    text  departments ticked on the form, comma-separated names
--   ext_id text  Vitre task id; the import matches on it so a re-run never
--                duplicates a row (same pattern as emp.ext_id)
--
-- Applied 2026-09-23 via Supabase MCP (apply_migration "toolbox_dep_ext_id_vitre").
-- Idempotent: safe to re-run.

ALTER TABLE public.toolbox ADD COLUMN IF NOT EXISTS dep text;
ALTER TABLE public.toolbox ADD COLUMN IF NOT EXISTS ext_id text;
CREATE INDEX IF NOT EXISTS toolbox_ext_id_idx ON public.toolbox (ext_id) WHERE ext_id IS NOT NULL;

-- Rollback (manual, only if needed):
-- DROP INDEX IF EXISTS toolbox_ext_id_idx;
-- ALTER TABLE public.toolbox DROP COLUMN IF EXISTS ext_id;
-- ALTER TABLE public.toolbox DROP COLUMN IF EXISTS dep;
