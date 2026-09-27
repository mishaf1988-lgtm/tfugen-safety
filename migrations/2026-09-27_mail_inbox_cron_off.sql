-- mail-inbox switched off (Michael, 27/09: "נבטל את זה"): the Tapugan tenant
-- needs admin consent for Mail.Read. Stops the 5-minute job only; the
-- function private.mail_inbox_tick() and /api/mail-inbox stay, dormant.
-- To switch back on after an admin grants Mail.Read: re-run
-- 2026-09-27_mail_inbox_cron.sql and restore Mail.Read in SCOPES.
select cron.unschedule(jobid) from cron.job where jobname = 'mail-inbox';
