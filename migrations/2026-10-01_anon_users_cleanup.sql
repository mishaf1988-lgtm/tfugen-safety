-- Recommendation 33 (security review 30/09/2026): clean out old anonymous users.
-- Michael, 01/10/2026, questionnaire: "yes, once + every week".
--
-- Every trustee kiosk sign-in is an anonymous row in auth.users (1,125 on
-- 01/10/2026, 860 older than 30 days). Nothing outside the auth schema has a
-- foreign key to auth.users (checked 01/10/2026), so trustee_reports and every
-- other table keep their rows. A user is removed only when ALL of these hold:
--   * anonymous, created more than 30 days ago
--   * no session used (created / refreshed) in the last 30 days, so a phone
--     that is still in use keeps its session
--   * owns no file in storage.objects
-- Approval: Michael, questionnaire 01/10/2026, explicit (a DELETE on auth.users).
-- Rollback: a deleted anonymous user cannot be brought back, and needs no backup:
-- no row anywhere points at it, and a phone without a session signs in anew.
-- Safe to re-run. Undo the weekly part: select cron.unschedule('anon-users-cleanup');

create schema if not exists private;

create or replace function private.anon_users_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and not exists (
      select 1 from auth.sessions s
      where s.user_id = u.id
        and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '30 days')
    and not exists (
      select 1 from storage.objects o
      where o.owner = u.id or o.owner_id = u.id::text);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.anon_users_cleanup() from public, anon, authenticated;

-- Sunday 02:13 UTC (05:13 Jerusalem in summer), away from the other jobs.
select cron.unschedule('anon-users-cleanup')
where exists (select 1 from cron.job where jobname = 'anon-users-cleanup');
select cron.schedule('anon-users-cleanup', '13 2 * * 0', 'select private.anon_users_cleanup()');

-- The first run, now.
select private.anon_users_cleanup() as removed;
