-- תיעוד בלבד: ההגנה כבר קיימת במסד החי, הקובץ לא הורץ (12/10/2026).
-- רטרו 12/10/2026 (א) הציע טריגר שחוסם DELETE/TRUNCATE על ncr, ncr_ai, trustee_reports, ומיכאל
-- בחר "בצע: הכפתורים שלי עובדים". בדיקה ב-pg_trigger הראתה שההגנה כבר שם (private.protect_delete,
-- בלי קובץ ב-repo; הוזכרה רק בשורה בארכיון של 30/09/2026). זה הנוסח שנקרא מהמסד, כדי ש-grep ימצא אותו.
--
-- מה היא עושה:
--   TRUNCATE: נחסם תמיד.
--   DELETE: מותר רק לאדמין או מנהל מחובר באפליקציה (private.is_admin_manager), כלומר כפתור
--   המחיקה עם סיסמת המחיקה. נחסם: מפתח השרת (service_role), משתמש רגיל, אנונימי, SQL ישיר ו-MCP.
--
-- אומת 12/10/2026 דרך Supabase MCP, על טבלה זמנית עם אותה פונקציה (לא על הטבלאות עצמן):
--   SQL ישיר: blocked. משתמש מחובר שאינו אדמין: blocked. admin@tfugen.local: deleted.
--   שלוש הטבלאות: protect_delete_row (BEFORE DELETE FOR EACH ROW, tgtype 11) ו-
--   protect_delete_stmt (BEFORE TRUNCATE, tgtype 34).
--
-- להקמה מחדש (פרויקט חדש), אחרי private.is_admin_manager():

create or replace function private.protect_delete()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'protect_delete: TRUNCATE of % is blocked', tg_table_name;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and private.is_admin_manager() then
    return old;
  end if;
  raise exception 'protect_delete: deleting from % is allowed only to an app admin', tg_table_name;
end
$function$;

create or replace trigger protect_delete_row before delete on public.ncr for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.ncr for each statement execute function private.protect_delete();
create or replace trigger protect_delete_row before delete on public.ncr_ai for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.ncr_ai for each statement execute function private.protect_delete();
create or replace trigger protect_delete_row before delete on public.trustee_reports for each row execute function private.protect_delete();
create or replace trigger protect_delete_stmt before truncate on public.trustee_reports for each statement execute function private.protect_delete();
