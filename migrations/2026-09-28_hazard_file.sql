-- The folder-13 hazard workbook, kept up to date by the server (28/09).
-- functions/api/hazard-file.js rewrites the "מאגר מפגעים" rows of the existing
-- ניהול סיורי מפגעים.xlsm (and its .xlsx twin) in sviva's OneDrive.
-- It is called:
--   * after every statement on tour_hazards (the manager's tours) and on
--     trustee_reports (the trustees' findings are in the same register);
--   * every 15 minutes (pg_cron), so a file that was open in Excel (423) is
--     written as soon as it is closed. Unchanged data = nothing written.
-- Same secret as trustee-log (Vault trustee_notify_secret). A failure here can
-- never block a save: every call is inside an exception block. Safe to re-run.

create or replace function private.hazard_file_ping()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare s text;
begin
  begin
    select decrypted_secret into s from vault.decrypted_secrets where name = 'trustee_notify_secret' limit 1;
    perform net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/hazard-file',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 30000
    );
  exception when others then
    null;
  end;
end
$$;
revoke all on function private.hazard_file_ping() from public, anon, authenticated;

create or replace function private.hazard_file_trg()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.hazard_file_ping();
  return null;
end
$$;
revoke all on function private.hazard_file_trg() from public, anon, authenticated;

drop trigger if exists tour_hazards_file on public.tour_hazards;
create trigger tour_hazards_file
  after insert or update or delete on public.tour_hazards
  for each statement execute function private.hazard_file_trg();

drop trigger if exists trustee_reports_file on public.trustee_reports;
create trigger trustee_reports_file
  after insert or update on public.trustee_reports
  for each statement execute function private.hazard_file_trg();

select cron.unschedule(jobid) from cron.job where jobname = 'hazard-file-retry';
select cron.schedule('hazard-file-retry', '*/15 * * * *', 'select private.hazard_file_ping()');

-- Verify:
-- select tgname from pg_trigger where tgname in ('tour_hazards_file','trustee_reports_file');  -- 2
-- select jobname, schedule from cron.job where jobname = 'hazard-file-retry';                  -- */15
-- Rollback (Michael's OK first): drop the two triggers, cron.unschedule('hazard-file-retry'),
-- drop function private.hazard_file_trg(), private.hazard_file_ping().
