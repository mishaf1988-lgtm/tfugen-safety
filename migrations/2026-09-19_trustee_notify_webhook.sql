-- Trustee hazard → server notification (2026-09-19)
--
-- When a trustee saves a ליקוי (trustee_reports.ok = false) the database
-- itself calls the app's Cloudflare function, which sends WhatsApp / email
-- to the safety officer. Works with the app closed on every device.
--
--   INSERT trustee_reports (ok=false)
--     → AFTER INSERT trigger → pg_net POST https://tapugan-safety.pages.dev/api/trustee-notify {"id":…}
--       → the function re-reads the row with the service key, claims
--         notified_at once, and sends to the recipients saved in
--         notification_prefs[admin].prefs.trustee_hazard.
--
-- pg_net is the extension Supabase uses for Database Webhooks (async HTTP
-- from Postgres). It was enabled once before for a one-off job and removed;
-- this time it stays, it is what the webhook runs on.
--
-- Optional hardening (not required): set TRUSTEE_NOTIFY_SECRET in the Pages
-- env and change the headers below to include "x-notify-secret".
--
-- Idempotent: IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS.

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.trustee_reports ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION private.trustee_reports_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ok = false THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
        body := jsonb_build_object('id', NEW.id),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;   -- a webhook hiccup must never block the trustee's report
    END;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.trustee_reports_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trustee_reports_notify ON public.trustee_reports;
CREATE TRIGGER trustee_reports_notify
  AFTER INSERT ON public.trustee_reports
  FOR EACH ROW EXECUTE FUNCTION private.trustee_reports_notify();

-- Verify (as postgres, a few seconds after inserting a hazard):
--   SELECT id, status_code, left(content, 120) FROM net._http_response ORDER BY id DESC LIMIT 3;
--   Expected: status_code 200 from the function.
-- Rollback:
--   DROP TRIGGER IF EXISTS trustee_reports_notify ON public.trustee_reports;
--   DROP FUNCTION IF EXISTS private.trustee_reports_notify();
--   ALTER TABLE public.trustee_reports DROP COLUMN IF EXISTS notified_at;
