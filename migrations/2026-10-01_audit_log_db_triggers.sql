-- 2026-10-01: יומן השינויים נכתב במסד הנתונים, לא בדפדפן (BACKLOG 9.20)
--
-- מיכאל אישר 01/10/2026 (בשאלון): הטבלאות = "הראיות לביקורת", ובכל שינוי
-- נשמר "אילו שדות השתנו" (בלי ערכים).
--
-- ## למה
-- נמדד 01/10/2026: 547 שורות ביומן, כולן מהדפדפן. 53 מפגעי סיור השתנו ב-30 יום
-- (סנכרון Excel, סגירה מקישור במייל) ורק 15 שורות יומן עליהם; ל-41 התאונות
-- אין אף שורה. ובשורה שהדפדפן שולח, הוא עצמו קובע את user_email ואת ts.
--
-- ## מה
-- 1. שתי עמודות חדשות ב-audit_log: source ('app' / 'server' / 'db') ו-changed
--    (שמות השדות שהשתנו בעדכון).
-- 2. private.audit_row(): AFTER INSERT/UPDATE/DELETE על 11 טבלאות. הזהות
--    מה-JWT של החיבור: אימייל המשתמש, 'anonymous' לנאמן, 'server' למפתח השירות
--    (Pages Functions), 'db' ל-SQL ידני. השעה = now() של השרת.
--    עדכון שלא שינה שום שדה (חוץ מ-ts / notified_at) לא נרשם, כדי שסנכרון
--    שכותב שוב את אותו ערך לא ימלא את היומן.
-- 3. private.audit_log_stamp(): BEFORE INSERT על audit_log. שורה מהדפדפן מקבלת
--    ts, user_email ו-source מהשרת (אי אפשר לרשום בשם אדם אחר). שורה מהדפדפן
--    על אחת מ-11 הטבלאות נזרקת, כי הטריגר כבר רשם אותה (בלי כפילות; האפליקציה
--    לא משתנה).
--
-- לא הרסני: עמודות, פונקציות וטריגרים חדשים. אף policy לא משתנה, אף שורה לא נמחקת.
--
-- ## חזרה לאחור
--   DROP TRIGGER IF EXISTS zz_audit_row ON public.<table>;   -- לכל אחת מ-11
--   DROP TRIGGER IF EXISTS audit_log_stamp ON public.audit_log;
--   DROP FUNCTION IF EXISTS private.audit_row(); DROP FUNCTION IF EXISTS private.audit_log_stamp();
--   (העמודות נשארות; הן ריקות בשורות הישנות.)

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS changed text[];

-- The tables whose rows are evidence. One list, read by both functions.
CREATE OR REPLACE FUNCTION private.audit_tables()
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path TO ''
AS $$ SELECT ARRAY['tour_hazards','trustee_reports','inc','ncr','near_miss','tasks',
                   'equip_inspections','docs','tr','mgmt_reviews','leg']::text[] $$;
REVOKE ALL ON FUNCTION private.audit_tables() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  j jsonb := auth.jwt();
  who text; src text; o jsonb; n jsonb; r jsonb; ch text[];
BEGIN
  IF j IS NULL THEN who := 'db'; src := 'db';
  ELSIF j->>'role' = 'service_role' THEN who := 'server'; src := 'server';
  ELSE who := coalesce(nullif(j->>'email', ''), 'anonymous'); src := 'app';
  END IF;

  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  r := coalesce(n, o);

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO ch
      FROM jsonb_object_keys(n) k
     WHERE k NOT IN ('ts', 'notified_at') AND (o->k) IS DISTINCT FROM (n->k);
    IF ch IS NULL THEN RETURN NULL; END IF;   -- nothing real changed
  END IF;

  INSERT INTO public.audit_log (user_email, table_name, record_id, op, title, source, changed)
  VALUES (who, TG_TABLE_NAME, r->>'id',
          CASE TG_OP WHEN 'INSERT' THEN 'ins' WHEN 'UPDATE' THEN 'upd' ELSE 'del' END,
          left(coalesce(r->>'title', r->>'topic', r->>'descr', r->>'f', r->>'num', r->>'n',
                        r->>'period', r->>'d'), 80),
          src, ch);
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.audit_row() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.audit_log_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE j jsonb := auth.jwt();
BEGIN
  -- A row written by private.audit_row() arrives from inside another trigger
  -- (depth 2) and passes untouched. (current_user cannot tell: in a SECURITY
  -- DEFINER function it is always the owner.) The server and manual SQL are
  -- not stamped either; only a signed-in client is.
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF j IS NULL OR j->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.table_name = ANY (private.audit_tables()) THEN RETURN NULL; END IF;
  NEW.ts := now();
  NEW.user_email := coalesce(nullif(j->>'email', ''), 'anonymous');
  NEW.source := 'app';
  NEW.changed := NULL;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.audit_log_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_log_stamp ON public.audit_log;
CREATE TRIGGER audit_log_stamp BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION private.audit_log_stamp();

-- zz_: after every other AFTER trigger on the table (they run in name order).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY private.audit_tables() LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_audit_row ON public.%I', t);
    EXECUTE format('CREATE TRIGGER zz_audit_row AFTER INSERT OR UPDATE OR DELETE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION private.audit_row()', t);
  END LOOP;
END $$;
