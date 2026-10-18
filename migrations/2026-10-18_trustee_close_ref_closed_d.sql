-- A trustee finding closed by its "after" photo got s = 'נסגר' and no closed_d (18/10/2026).
-- Found by the weekly-talk Routine: 6 of 9 closed findings had no closing date, so "אמרתם, עשינו"
-- (closed_d this week) and the closing-time measure never saw them.
-- 1. trustee_reports_close_ref also writes closed_d: the closing row's day (NEW.d).
-- 2. Backfill: each of those rows gets the day of the row that closed it (ref).
-- The app (index.html) now writes closed_d too when a finding is closed on insert.
-- Run one statement per execute_sql call (tfugen-db 8). Backup first:
--   create table backup_ops_20260918.trustee_reports_20261018 as select * from public.trustee_reports
-- The trigger calls private.trustee_reports_close_ref. A first run on 18/10/2026 created, by mistake,
-- public.trustee_reports_close_ref (same body, no trigger uses it); its EXECUTE was revoked from
-- public, anon and authenticated. Dropping it waits for Michael (CLAUDE.md, Supabase MCP 2).
-- Ran and verified 18/10/2026: backup 21/21; the 6 closed findings without closed_d got the day of
-- their closing row; insert + close inside BEGIN ... ROLLBACK gave closed_d = the closing day.

create or replace function private.trustee_reports_close_ref() returns trigger
language plpgsql security definer set search_path = '' as $f$
BEGIN
  IF NEW.t = 8 AND NEW.ref IS NOT NULL AND NEW.ref <> '' THEN
    UPDATE public.trustee_reports
       SET s = 'נסגר', closed_d = COALESCE(closed_d, NEW.d)
     WHERE id = NEW.ref
       AND ok = false
       AND t BETWEEN 1 AND 20 AND t <> 8
       AND s <> 'נסגר'
       AND u IS NOT DISTINCT FROM NEW.u;
  END IF;
  RETURN NEW;
END
$f$;

update public.trustee_reports r
   set closed_d = c.d
  from (select distinct on (ref) ref, d from public.trustee_reports where t = 8 and ref is not null and ref <> '' order by ref, ts) c
 where c.ref = r.id and r.s = 'נסגר' and r.closed_d is null and r.ok = false;
