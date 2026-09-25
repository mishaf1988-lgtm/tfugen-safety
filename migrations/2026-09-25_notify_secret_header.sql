-- 2026-09-25 — the two notify webhooks send x-notify-secret, read from Vault.
-- Applied through the Supabase MCP on 2026-09-25 and verified (both functions
-- carry the header, vault.decrypted_secrets returns the value).
--
-- The value itself is NOT in this file: it lives in Vault (name
-- trustee_notify_secret) and in Cloudflare Pages env TRUSTEE_NOTIFY_SECRET.
-- To rotate: vault.update_secret(<id>, '<new>') here, the env var there,
-- then a redeploy. The function reads the secret at call time, so a rotation
-- needs no function change.
--
-- select vault.create_secret('<value>', 'trustee_notify_secret', 'shared with Cloudflare Pages env TRUSTEE_NOTIFY_SECRET');

CREATE OR REPLACE FUNCTION private.trustee_reports_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s text;
BEGIN
  IF NEW.ok = false THEN
    BEGIN
      SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
      PERFORM net.http_post(
        url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
        body := jsonb_build_object('id', NEW.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
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

CREATE OR REPLACE FUNCTION private.near_miss_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'trustee_notify_secret' LIMIT 1;
    PERFORM net.http_post(
      url := 'https://tapugan-safety.pages.dev/api/trustee-notify',
      body := jsonb_build_object('id', NEW.id, 'src', 'near_miss'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(s, '')),
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.near_miss_notify() FROM PUBLIC, anon, authenticated;
