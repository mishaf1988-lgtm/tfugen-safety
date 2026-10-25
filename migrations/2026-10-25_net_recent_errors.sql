-- הסיבה בתוך מייל השומר (25/10/2026, מיכאל: "בצע את שתי ההצעות לשדרוג השומר").
-- ב-25/10/2026 מ-20:15 בקשות של pg_cron לשרת נעצרו אצל Cloudflare עם 503 "error code: 1102"
-- (חריגת זיכרון או מעבד), והשומר כתב רק "לא התעדכן". השגיאה לא מגיעה לקוד שלנו, היא נשמרת רק
-- ב-net._http_response. הפונקציה מחזירה סיכום של השעה האחרונה: קוד, כמה, מתי האחרונה.
-- קריאה בלבד, רק service_role (השרת). בטוח להרצה חוזרת.
create or replace function public.net_recent_errors(minutes int default 60)
returns table(code text, n bigint, last timestamptz)
language sql
security definer
set search_path to ''
as $$
  select coalesce(substring(r.content from 'error code: (\d+)'), r.status_code::text, 'none') as code,
         count(*) as n, max(r.created) as last
  from net._http_response r
  where r.created > now() - make_interval(mins => least(greatest(minutes, 5), 1440))
    and (r.status_code is null or r.status_code >= 500)
  group by 1
  order by 2 desc
  limit 5;
$$;
revoke all on function public.net_recent_errors(int) from public, anon, authenticated;
grant execute on function public.net_recent_errors(int) to service_role;
