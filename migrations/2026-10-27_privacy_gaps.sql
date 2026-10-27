-- 27/10/2026 (privacy map, project-files/privacy-map.md; Michael in the questionnaire: "do it: close both").
-- (1) The viewer role ("צופה") could read medical checks and hearing tests (policy viewer_read). No active viewer
--     existed that day, so nothing was exposed; this closes it before the first one. Admin and manager keep
--     med_admin_manager_all / hearing_tests_admin_manager_all. To restore (only with Michael's word):
--       create policy viewer_read on public.med as permissive for select to authenticated using ((select private.is_viewer()));
--       create policy viewer_read on public.hearing_tests as permissive for select to authenticated using ((select private.is_viewer()));
-- (2) trustees is read by the anonymous trustee kiosk (index.html _truPull, for the name picker), so its policy
--     stays open; the phone column is the only personal field there beyond the name. The app has no field for it and
--     0 rows held one that day (live 8, staging 1), so it may stay empty: a phone is never stored where the kiosk reads.
drop policy if exists viewer_read on public.med;
drop policy if exists viewer_read on public.hearing_tests;
alter table public.trustees add constraint trustees_no_phone check (ph is null or ph = '');
