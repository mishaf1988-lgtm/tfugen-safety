-- Trustee reports log written to OneDrive by the server (Michael, 2026-09-27).
--
-- 1. public.server_state: a tiny key/value store the Pages Functions keep
--    between calls (the last uploaded signature, time and error). Service-role
--    only: RLS on, no policies, so the browser can neither read nor write it.
-- 2. A STATEMENT-level trigger on trustee_reports that asks /api/trustee-log to
--    rebuild the file. Statement-level, so a trustee tour that saves several
--    rows makes one call, not one per row. pg_net sends after COMMIT, so the
--    function reads committed data. Same secret header as trustee-notify.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.server_state (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.server_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_state FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.trustee_reports_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE s text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
    PERFORM net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/trustee-log',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 20000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;   -- the log must never block a trustee's report
  END;
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS trustee_reports_log ON public.trustee_reports;
CREATE TRIGGER trustee_reports_log
  AFTER INSERT OR UPDATE ON public.trustee_reports
  FOR EACH STATEMENT EXECUTE FUNCTION private.trustee_reports_log();
