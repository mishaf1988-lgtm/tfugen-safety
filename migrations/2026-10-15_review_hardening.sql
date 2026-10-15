-- 15/10/2026, deep review. Michael in the questionnaire: "בצע: 60 לטלפון, 200 לכולם", "בצע: שעת קבלה בשרת",
-- "בצע: לסגור את שניהם". Additive only: no drop, no delete. Backup of trustee_reports and near_miss first.

-- 0. Backup of the two tables that get a column (rows only, the schema of backups is plain tables).
CREATE SCHEMA IF NOT EXISTS backup_20261015;
CREATE TABLE IF NOT EXISTS backup_20261015.trustee_reports AS SELECT * FROM public.trustee_reports;
CREATE TABLE IF NOT EXISTS backup_20261015.near_miss AS SELECT * FROM public.near_miss;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261015 FROM anon, authenticated;

-- 1. NOT RUN YET (15/10/2026): apply_migration stops on the confirmation the DELETE line asks for, which
--    nobody answers in a cloud session. Michael runs this block in the SQL editor, or approves the prompt.
--    The anonymous write cap: one real tour of a diligent trustee is 17-19 rows, and three trustees in
--    the same hour at the end of the month passed 50 for all. Live peak in 30 days: 3 an hour.
CREATE OR REPLACE FUNCTION private.anon_write_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  n_me   int;
  n_all  int;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('private.anon_write_cap'));
  DELETE FROM private.anon_writes WHERE at < now() - interval '2 hours';
  SELECT count(*) FILTER (WHERE a.uid = v_uid), count(*)
    INTO n_me, n_all
    FROM private.anon_writes a
   WHERE a.at > now() - interval '1 hour';
  IF n_me >= 60 OR n_all >= 200 THEN
    RAISE SQLSTATE 'PT429' USING
      MESSAGE = 'יותר מדי דיווחים בשעה האחרונה. הדיווח נשמר בטלפון ויישלח שוב אוטומטית.',
      DETAIL  = CASE WHEN n_me >= 60 THEN 'anon cap: session 60/hour' ELSE 'anon cap: all sessions 200/hour' END;
  END IF;
  INSERT INTO private.anon_writes (uid, tbl) VALUES (v_uid, TG_TABLE_NAME);
  RETURN NEW;
END
$function$;

-- 2. When the server received a report. ts is the phone's clock: a report that waited in the phone's
--    queue more than 48 hours, or a phone with a wrong clock, was saved but never alerted the manager.
ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now();
ALTER TABLE public.near_miss ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now();
-- 2b. The rows already there took now() as their default: set back to the phone's time, so the notify
--     sweep (48 hours by received_at) does not see 24 old reports as new.
UPDATE public.trustee_reports SET received_at = ts WHERE ts IS NOT NULL AND received_at > ts;
UPDATE public.near_miss SET received_at = ts WHERE ts IS NOT NULL AND received_at > ts;

-- 3. The audit log: any anonymous session (the trustee kiosk) could insert rows with any user, source
--    or op it chose, with no cap. The app no longer sends audit rows from the kiosk (#1550), and the
--    database audits the trustee tables itself (private.audit_row). A RESTRICTIVE policy, added, not
--    a change of the existing one.
CREATE POLICY audit_log_no_anon_insert ON public.audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (coalesce(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

-- 4. The photo bucket took any file of any size. The app's own largest upload is a training video of
--    50 MB (_TBT_VID_MAX). The documents screen and the attachments take any file a manager picks
--    (a .msg, a .zip, a drawing; the browser sends application/octet-stream for a type it does not
--    know), so the types are by family: everything but HTML and other text a browser would run.
UPDATE storage.buckets
   SET file_size_limit = 52428800,
       allowed_mime_types = ARRAY['image/*','video/*','audio/*','application/*','text/plain','text/csv','message/rfc822']
 WHERE id = 'incidents-photos';
