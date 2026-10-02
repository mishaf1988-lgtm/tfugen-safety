-- BACKLOG 5.12 (02/10/2026): כלל Supabase security-rls-performance. פונקציה בתוך policy
-- נעטפת ב-(select ...) כדי שתרוץ פעם אחת לשאילתה ולא לכל שורה. אותה משמעות, אותן הרשאות.
-- נמדד במסד החי לפני ההרצה: 9 policies ב-public ו-5 ב-storage.objects עם קריאה לא עטופה
-- ל-private.is_admin_manager() או auth.jwt(). ה-pwchange_required וכל השאר כבר היו עטופות.
-- גיבוי: backup_20261002.policies_before_wrap (pg_policies של public ו-storage לפני השינוי, 372 שורות).
-- הורץ דרך Supabase MCP (apply_migration rls_wrap_select) ב-02/10/2026 ואומת: 0 לא עטופות אחרי, 372 policies.
create schema if not exists backup_20261002;
create table if not exists backup_20261002.policies_before_wrap as
  select now() as taken_at, * from pg_policies where schemaname in ('public','storage');

-- public
alter policy audit_log_admin_manager_select on public.audit_log
  using ((select private.is_admin_manager()));
alter policy mgmt_reviews_admin_manager_all on public.mgmt_reviews
  using ((select private.is_admin_manager())) with check ((select private.is_admin_manager()));
alter policy ncr_comments_admin_manager_all on public.ncr_comments
  using ((select private.is_admin_manager())) with check ((select private.is_admin_manager()));
alter policy ncr_patterns_admin_manager_all on public.ncr_patterns
  using ((select private.is_admin_manager())) with check ((select private.is_admin_manager()));
alter policy auth_can_read_reset_request on public.password_reset_requests
  using ((select private.is_admin_manager()));
alter policy auth_can_update_reset_request on public.password_reset_requests
  using ((select private.is_admin_manager())) with check ((select private.is_admin_manager()));
alter policy record_history_insert on public.record_history
  with check ((select private.is_admin_manager()));
alter policy record_history_read on public.record_history
  using ((select private.is_admin_manager()));
alter policy app_users_read on public.app_users
  using ((select private.is_admin_manager()) or (((select auth.jwt()) ->> 'email') = (id || '@tfugen.local')));

-- storage.objects
alter policy incidents_photos_delete_named_user on storage.objects
  using (bucket_id = 'incidents-photos'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> ''
    and (select private.is_admin_manager()));
alter policy incidents_photos_insert_named_user on storage.objects
  with check (bucket_id = 'incidents-photos'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> '');
alter policy incidents_photos_select_named_user on storage.objects
  using (bucket_id = 'incidents-photos'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> '');
alter policy incidents_photos_update_named_user on storage.objects
  using (bucket_id = 'incidents-photos'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> ''
    and (select private.is_admin_manager()))
  with check (bucket_id = 'incidents-photos'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> ''
    and (select private.is_admin_manager()));
alter policy tapugan_auth_read_backups on storage.objects
  using (bucket_id = 'backups'
    and coalesce((((select auth.jwt()) ->> 'is_anonymous'))::boolean, true) = false
    and coalesce(((select auth.jwt()) ->> 'email'), '') <> ''
    and (select private.is_admin_manager()));
