-- 14/10/2026 (Michael: "one shared draft for all departments, whoever fills it picks his department";
-- "each department goes over all its topics anyway"; in the questionnaire: "בצע: טיוטה אחת, הנושא לפי
-- המחלקה", "בצע: טיוטה חדשה כל יום ראשון", "בצע: למחוק ולהשאיר אחת משותפת").
-- talk_week now makes ONE weekly draft (kind null = weekly, no department). Its body has a section per
-- department, "## <department>" and then all of that department's active topics in order; the
-- worker's page shows the section of the department he picks (functions/api/talk.js).
-- The 14 per-department drafts are removed: drafts only, none signed (checked in the WHERE), and
-- backed up this morning in backup_ops_20260918.toolbox_talks_20261014 (2026-10-14_talk_annual.sql).
create or replace function private.talk_week(p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  d date := coalesce(p_day, (now() at time zone 'Asia/Jerusalem')::date);
  nid text := 'w' || to_char(coalesce(p_day, (now() at time zone 'Asia/Jerusalem')::date), 'YYYYMMDD');
  v_body text;
  v_tr text;
  v_q text;
begin
  if exists (select 1 from public.toolbox_talks k where k.id = nid) then
    return '[]'::jsonb;
  end if;
  select string_agg('## ' || x.dept || E'\n' || x.txt, E'\n\n' order by x.dept) into v_body
    from (select t.dept, string_agg(t.title || E'\n' || t.body, E'\n\n' order by t.ord) txt
            from public.talk_topics t where t.active group by t.dept) x;
  if v_body is null then
    return '[]'::jsonb;
  end if;
  select k.trainer, k.trainer_qual into v_tr, v_q from public.toolbox_talks k
    where k.kind is null and k.trainer is not null order by k.ts desc limit 1;
  insert into public.toolbox_talks (id, d, title, body, s, kind, dept, trainer, trainer_qual, created_by, ts)
    values (nid, d, 'הדרכה שבועית ' || to_char(d, 'DD/MM/YYYY'), v_body, 'טיוטה', null, null, v_tr, v_q, 'routine', now());
  insert into public.server_state(key, value, updated_at)
    values ('talk_week', jsonb_build_object('at', now(), 'day', d, 'made', jsonb_build_array(nid))::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return jsonb_build_array(nid);
end
$function$;

delete from public.toolbox_talks k
 where k.id in ('w20261011-2db647','w20261011-43524a','w20261011-dbe22e','w20261011-0c718f','w20261011-002e3a','w20261011-3ef151','w20261011-1ac7c8',
                'wk-achzaka','wk-ariza','wk-chomer-glam','wk-tuganim','wk-maabada','wk-meutzavim','wk-totzag')
   and k.s = 'טיוטה'
   and not exists (select 1 from public.toolbox_reads r where r.talk_id = k.id);

-- This week's shared draft (Sunday 11/10/2026).
select private.talk_week('2026-10-11');
