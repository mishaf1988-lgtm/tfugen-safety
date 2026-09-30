-- Trustee task 9: electrical panels and faults (30/09/2026)
--
-- A trustee told Michael electrical faults kept coming up in his reports;
-- Michael (questionnaire, 30/09/2026): a ninth monthly task, 10 points like
-- the others, the finding goes to the department manager and to electrical.
--
-- Until now "a finding" meant task 1..7 everywhere, because 8 was the last
-- task and it is the closing one. The rule is now "any task except 8", up to
-- 20 so a typo cannot store t=800. Safe to re-run.


ALTER TABLE public.trustee_reports
  DROP CONSTRAINT IF EXISTS trustee_reports_t_check,
  ADD CONSTRAINT trustee_reports_t_check CHECK (t BETWEEN 1 AND 20);

-- #968: the fixed finding number, now for task 9 too.
CREATE OR REPLACE FUNCTION private.trustee_reports_num()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.num := OLD.num;
  ELSE
    NEW.num := NULL;
  END IF;
  IF NEW.num IS NULL AND NEW.ok = false AND NEW.t BETWEEN 1 AND 20 AND NEW.t <> 8 THEN
    PERFORM pg_advisory_xact_lock(hashtext('trustee_reports.num'));
    SELECT coalesce(max(num), 0) + 1 INTO NEW.num FROM public.trustee_reports;
  END IF;
  RETURN NEW;
END
$function$;

-- The "after" photo (t=8) closes a finding of any task but 8.
CREATE OR REPLACE FUNCTION private.trustee_reports_close_ref()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.t = 8 AND NEW.ref IS NOT NULL AND NEW.ref <> '' THEN
    UPDATE public.trustee_reports
       SET s = 'נסגר'
     WHERE id = NEW.ref
       AND ok = false
       AND t BETWEEN 1 AND 20 AND t <> 8
       AND s <> 'נסגר'
       AND u IS NOT DISTINCT FROM NEW.u;
  END IF;
  RETURN NEW;
END
$function$;

INSERT INTO public.trustee_tasks (id, n, icon, t, how, active)
VALUES ('tsk_09', 9, '⚡', 'לוחות חשמל וליקויי חשמל',
  'עוברים על לוחות החשמל, השקעים והכבלים באזור: לוח סגור ומסומן, גישה פנויה ללוח, אין כבלים חשופים או פגועים, אין מפצלים מחוברים זה לזה, תאורה תקינה. ליקוי חשמל: לא נוגעים, מצלמים ומדווחים.',
  true)
ON CONFLICT (n) DO NOTHING;


-- Verify:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'trustee_reports_t_check';  -- t >= 1 AND t <= 20
--   SELECT n, t FROM public.trustee_tasks WHERE n = 9;                                            -- 1 row
--   SELECT prosrc ~ 't <> 8' FROM pg_proc WHERE proname IN ('trustee_reports_num','trustee_reports_close_ref');  -- true, true
