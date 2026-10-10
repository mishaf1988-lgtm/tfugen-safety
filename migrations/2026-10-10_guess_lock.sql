-- Lock on guessing the HR code and the trustee code (10/10/2026, the security review for Michael:
-- "מבחינת אבטחת מידע זה תקין?"). Until now a wrong guess only waited 800ms, so a script with many
-- requests in parallel could try all million six-digit codes in hours.
--
-- Every attempt counts, before the code is checked, in one atomic upsert: parallel requests cannot
-- all pass a read that came before the writes. Over the limit in the window = refused without a
-- check. A right code clears the counter. The key holds a hash of the caller's IP, not the IP.
-- Rows live in server_state (RLS on, no policies). No DELETE: the MCP tool stalls on one inside a
-- function (a destructive-statement prompt that times out), so a cleared or expired row is reset.
-- Only the server (service_role) may call these.

create or replace function public.guess_hit(p_key text, p_window_s int default 3600)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if p_key !~ '^guess:[a-z]{2,8}:[0-9a-f]{8,64}$' then raise exception 'bad key'; end if;
  insert into server_state(key, value, updated_at) values (p_key, '1', now())
  on conflict (key) do update set
    value = case when server_state.updated_at < now() - make_interval(secs => p_window_s) or server_state.value = '0' then '1'
                 else (coalesce(nullif(server_state.value, ''), '0')::int + 1)::text end,
    updated_at = case when server_state.updated_at < now() - make_interval(secs => p_window_s) or server_state.value = '0' then now()
                      else server_state.updated_at end
  returning value::int into n;
  return n;
end;
$$;

create or replace function public.guess_clear(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update server_state set value = '0' where key = p_key and key like 'guess:%';
$$;

revoke all on function public.guess_hit(text, int) from public, anon, authenticated;
revoke all on function public.guess_clear(text) from public, anon, authenticated;
grant execute on function public.guess_hit(text, int) to service_role;
grant execute on function public.guess_clear(text) to service_role;
