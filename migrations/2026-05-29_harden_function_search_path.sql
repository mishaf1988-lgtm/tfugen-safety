-- Security audit hardening — 2026-05-29
--
-- Supabase linter 0011 (function_search_path_mutable): three trigger
-- functions had no pinned search_path. Pinning prevents search_path
-- hijacking and is a Supabase best practice. None are SECURITY DEFINER,
-- so the practical risk was low, but this clears the advisor warnings.
--
-- APPLIED + VERIFIED live on prod 2026-05-29 (proconfig now shows the
-- pinned value on all three). Idempotent, safe to re-run.

ALTER FUNCTION public.cancel_orphan_tasks_on_equip_delete() SET search_path = public, pg_temp;
ALTER FUNCTION public.equip_inspections_alias_sync()        SET search_path = public, pg_temp;
ALTER FUNCTION public.pgrst_watch()                         SET search_path = public, pg_temp;
