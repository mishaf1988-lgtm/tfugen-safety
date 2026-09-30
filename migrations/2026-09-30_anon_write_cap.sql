-- Upgrade review 18 (30/09/2026, Michael chose the numbers in the questionnaire):
-- a ceiling on rows an ANONYMOUS session (the trustee / employee screen, no
-- password) may insert. Before this, anyone holding the public key could open
-- sessions at will (1,121 anonymous users existed on 30/09/2026) and push
-- unlimited fake hazards into the folder-13 file, the committee deck, and
-- Michael's WhatsApp and mail.
--
--   20 rows per hour from one session, 50 per hour from all anonymous sessions
--   together. Real use so far: 7 trustee reports in all, at most 2 in a day.
--
-- A refused row is answered 429 (SQLSTATE PT429, PostgREST maps it). The app's
-- outbox keeps every op that did not get a 2xx and sends it again on the next
-- drain, so a real trustee over the ceiling loses nothing: the row waits on
-- the phone and goes in once the hour has moved on.
--
-- Named users (admin, manager, reporter, viewer) and the service role are not
-- touched. Not destructive: a new table in `private`, a new function, new
-- triggers; no existing policy or row changes. The rollback is at the bottom.
-- The daily cap on notifications (15, then one summary) is in
-- functions/api/trustee-notify.js, not here.

CREATE TABLE IF NOT EXISTS private.anon_writes (
  uid uuid        NOT NULL,
  tbl text        NOT NULL,
  at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anon_writes_at_idx     ON private.anon_writes (at);
CREATE INDEX IF NOT EXISTS anon_writes_uid_at_idx ON private.anon_writes (uid, at);
ALTER TABLE private.anon_writes ENABLE ROW LEVEL SECURITY;  -- no policy: only this function (definer) reads or writes it
REVOKE ALL ON private.anon_writes FROM PUBLIC, anon, authenticated;

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
  -- One at a time, so a burst of parallel inserts cannot all read 49 and all pass.
  PERFORM pg_advisory_xact_lock(hashtext('private.anon_write_cap'));
  -- Counters older than two hours are no longer read by anything.
  DELETE FROM private.anon_writes WHERE at < now() - interval '2 hours';
  SELECT count(*) FILTER (WHERE a.uid = v_uid), count(*)
    INTO n_me, n_all
    FROM private.anon_writes a
   WHERE a.at > now() - interval '1 hour';
  IF n_me >= 20 OR n_all >= 50 THEN
    RAISE SQLSTATE 'PT429' USING
      MESSAGE = 'יותר מדי דיווחים בשעה האחרונה. הדיווח נשמר בטלפון ויישלח שוב אוטומטית.',
      DETAIL  = CASE WHEN n_me >= 20 THEN 'anon cap: session 20/hour' ELSE 'anon cap: all sessions 50/hour' END;
  END IF;
  INSERT INTO private.anon_writes (uid, tbl) VALUES (v_uid, TG_TABLE_NAME);
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION private.anon_write_cap() FROM PUBLIC, anon, authenticated;

-- Every table an anonymous session may insert into (the emp_insert policies).
-- The name starts with "a_" so it runs before the other BEFORE triggers.
DROP TRIGGER IF EXISTS a_anon_write_cap ON public.trustee_reports;
CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.trustee_reports   FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();
DROP TRIGGER IF EXISTS a_anon_write_cap ON public.near_miss;
CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.near_miss         FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();
DROP TRIGGER IF EXISTS a_anon_write_cap ON public.rounds;
CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.rounds            FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();
DROP TRIGGER IF EXISTS a_anon_write_cap ON public.tr;
CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.tr                FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();
DROP TRIGGER IF EXISTS a_anon_write_cap ON public.equip_inspections;
CREATE TRIGGER a_anon_write_cap BEFORE INSERT ON public.equip_inspections FOR EACH ROW EXECUTE FUNCTION private.anon_write_cap();

-- Rollback
-- DROP TRIGGER IF EXISTS a_anon_write_cap ON public.trustee_reports;
-- DROP TRIGGER IF EXISTS a_anon_write_cap ON public.near_miss;
-- DROP TRIGGER IF EXISTS a_anon_write_cap ON public.rounds;
-- DROP TRIGGER IF EXISTS a_anon_write_cap ON public.tr;
-- DROP TRIGGER IF EXISTS a_anon_write_cap ON public.equip_inspections;
-- DROP FUNCTION IF EXISTS private.anon_write_cap();
-- DROP TABLE IF EXISTS private.anon_writes;
