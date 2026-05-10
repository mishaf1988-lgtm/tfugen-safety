-- OAuth refresh-token store for autonomous server-side flows.
--
-- Until 2026-05-10 the server-side credential delivery used Microsoft
-- Graph CLIENT_CREDENTIALS, which requires Mail.Send Application
-- permission + admin consent. Tenant admin was unreachable, so we
-- pivoted to Delegated + refresh_token: sviva signs in once via
-- /api/auth/microsoft-start, the refresh_token lands here, the server
-- refreshes silently for every send.
--
-- Service-role only — no anon/authenticated policies. The refresh_token
-- is a long-lived secret equivalent to "send mail as sviva" capability.
-- Must never be reachable from the browser.

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  provider      text        NOT NULL,
  user_email    text        NOT NULL,
  refresh_token text        NOT NULL,
  access_token  text,
  expires_at    timestamptz,
  scope         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, user_email)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies → table is invisible to the browser.
-- service_role bypasses RLS, so Pages Functions (which use
-- SUPABASE_SERVICE_ROLE_KEY) can read and write freely.
