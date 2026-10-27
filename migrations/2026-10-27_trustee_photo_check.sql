-- 27/10/2026 (security scan of the outside-input paths; Michael in the questionnaire: "do it: yes, with a backup
-- first"). trustee_reports is written by an anonymous session, and the server once signed with the service key
-- any storage path it found in photo_url (the owner's signature in backups included). The server now checks the
-- path (PR #2078); this is the second layer: the row itself can only point at a kiosk photo in incidents-photos,
-- or at the offline placeholder ("pending:...", index.html _PH_PREFIX) that the sync replaces later.
-- Measured before: 24 rows, 22 with a photo, 0 that fail the rule.
create schema if not exists backup_20261027;
create table if not exists backup_20261027.trustee_reports as table public.trustee_reports;
-- Plain statements (a DO block hangs the MCP, tfugen-db 8). Run once: a second run fails on the existing name.
alter table public.trustee_reports add constraint trustee_reports_photo_url_check check (
  photo_url is null
  or photo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/incidents-photos/tru-[A-Za-z0-9._-]{1,250}$'
  or (photo_url ~ '^pending:' and length(photo_url) <= 300)
);
