-- נעילת מחיקה במסד על ncr, ncr_ai, trustee_reports (רטרו 12/10/2026, הצעה א').
-- מיכאל בשאלון 12/10/2026: "בצע: רק מנהל באפליקציה".
-- למה: ה-hook guard-sql רואה רק פקודות שסוכן מריץ. מחיקה דרך REST, פונקציית שרת (service_role),
-- חיבור ישיר או גוף פונקציה עוברת בלעדיו. כאן המסד עצמו דוחה.
-- מה מותר: DELETE רק ממשתמש מחובר (role authenticated) ש-private.is_admin_manager() מאשר,
-- כלומר כפתורי "מחק דיווח" ו-askDel באפליקציה. TRUNCATE חסום תמיד.
-- הוספה בלבד: פונקציה וטריגרים חדשים, בלי שינוי בנתונים או ב-RLS.
create or replace function private.protect_delete() returns trigger
language plpgsql security definer set search_path = ''
as $f$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'protect_delete: TRUNCATE of % is blocked', tg_table_name;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and private.is_admin_manager() then
    return old;
  end if;
  raise exception 'protect_delete: deleting from % is allowed only to an app admin', tg_table_name;
end
$f$;
revoke all on function private.protect_delete() from public, anon, authenticated;

create or replace trigger protect_delete_row before delete on public.ncr for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.ncr for each statement execute function private.protect_delete();

create or replace trigger protect_delete_row before delete on public.ncr_ai for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.ncr_ai for each statement execute function private.protect_delete();

create or replace trigger protect_delete_row before delete on public.trustee_reports for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.trustee_reports for each statement execute function private.protect_delete();
