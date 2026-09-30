-- Upgrade review 23 (30/09/2026): a fixed number for every trustee finding.
-- Until now נ-k was the position of the finding in a list sorted by time,
-- worked out anew by hazard-file.js and by index.html, each on its own. A
-- finding marked "לא רלוונטי" (or deleted) shifted every later one, so the
-- נ-3 in yesterday's mail could be another finding today.
--
-- trustee_reports.num: given once, when a row becomes a finding (ok = false,
-- task 1-7), max + 1. Never changed after that, never set by the client.
-- Michael, 30/09/2026 in the questionnaire: the numbering runs on across
-- years (no restart on 01/01/2027), and a finding marked not relevant keeps
-- its number, so a gap is left (נ-2, then נ-4).
--
-- Backfill: the findings that exist get the number they show today (the
-- same order by ts; none of them is marked not relevant on 30/09/2026).
-- Not destructive: a new column, a new function, new triggers, an index.
-- The rollback is at the bottom.

ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS num integer;

CREATE OR REPLACE FUNCTION private.trustee_reports_num()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.num := OLD.num;  -- fixed once given, whatever the client sends
  ELSE
    NEW.num := NULL;
  END IF;
  IF NEW.num IS NULL AND NEW.ok = false AND NEW.t BETWEEN 1 AND 7 THEN
    -- One number at a time: two findings sent in the same second do not
    -- both read the same max.
    PERFORM pg_advisory_xact_lock(hashtext('trustee_reports.num'));
    SELECT coalesce(max(num), 0) + 1 INTO NEW.num FROM public.trustee_reports;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION private.trustee_reports_num() FROM PUBLIC, anon, authenticated;

-- Named after trustee_reports_before_ins, so it runs after it (BEFORE
-- triggers run in name order) and after a_anon_write_cap: a refused row
-- takes no number.
DROP TRIGGER IF EXISTS trustee_reports_num_ins ON public.trustee_reports;
CREATE TRIGGER trustee_reports_num_ins BEFORE INSERT ON public.trustee_reports
  FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_num();
DROP TRIGGER IF EXISTS trustee_reports_num_upd ON public.trustee_reports;
CREATE TRIGGER trustee_reports_num_upd BEFORE UPDATE ON public.trustee_reports
  FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_num();

-- Backfill, in the order the file and the screen number them today. Runs
-- with the update trigger in place, which would keep num NULL, so it is
-- disabled for this one statement.
ALTER TABLE public.trustee_reports DISABLE TRIGGER trustee_reports_num_upd;
ALTER TABLE public.trustee_reports DISABLE TRIGGER trustee_reports_file;
ALTER TABLE public.trustee_reports DISABLE TRIGGER trustee_reports_log;
UPDATE public.trustee_reports r SET num = x.k
FROM (SELECT id, row_number() OVER (ORDER BY ts, d, id) AS k FROM public.trustee_reports
      WHERE ok = false AND t BETWEEN 1 AND 7 AND num IS NULL) x
WHERE r.id = x.id AND NOT EXISTS (SELECT 1 FROM public.trustee_reports WHERE num IS NOT NULL);
ALTER TABLE public.trustee_reports ENABLE TRIGGER trustee_reports_log;
ALTER TABLE public.trustee_reports ENABLE TRIGGER trustee_reports_file;
ALTER TABLE public.trustee_reports ENABLE TRIGGER trustee_reports_num_upd;

CREATE UNIQUE INDEX IF NOT EXISTS trustee_reports_num_uq ON public.trustee_reports (num) WHERE num IS NOT NULL;

-- Verify:
--   SELECT num, id, ts FROM public.trustee_reports WHERE ok = false ORDER BY ts;
--   -- 1..6 on 30/09/2026, in ts order, the same as the file's נ-1..נ-6
--   SELECT count(*) FROM public.trustee_reports WHERE ok = false AND t BETWEEN 1 AND 7 AND num IS NULL;  -- 0
-- Rollback (Michael's OK first):
--   DROP TRIGGER trustee_reports_num_ins ON public.trustee_reports;
--   DROP TRIGGER trustee_reports_num_upd ON public.trustee_reports;
--   DROP FUNCTION private.trustee_reports_num();
--   ALTER TABLE public.trustee_reports DROP COLUMN num;
