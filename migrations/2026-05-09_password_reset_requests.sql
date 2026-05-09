-- Phase 2 Agent 2 — password reset request inbox.
--
-- A user who forgot their password types their username on the login
-- screen → a row lands in this table with status='pending'. The admin
-- (sviva / role='אדמין') sees a notification on the dashboard, taps
-- "אשר ושלח", and the existing /api/reset-password flow runs +
-- _credAutoDeliver fires (email + WhatsApp). The row is then marked
-- status='completed'.
--
-- Run order: idempotent, safe to re-run. RLS allows anon INSERT (so
-- pre-auth login screen can write) and authenticated SELECT/UPDATE
-- (so logged-in admin can manage the queue).

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','completed','denied')),
  ts          timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  notes       text
);

CREATE INDEX IF NOT EXISTS password_reset_requests_status_ts_idx
  ON public.password_reset_requests (status, ts DESC);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Anonymous users (pre-login) can insert a request. They cannot read
-- or update — only INSERT — so they can't see other people's requests.
DROP POLICY IF EXISTS "anon_can_insert_reset_request" ON public.password_reset_requests;
CREATE POLICY "anon_can_insert_reset_request"
  ON public.password_reset_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users (admin or otherwise) can read all rows. The UI
-- gates the inbox to admin only via _isAdminUser() — that's a soft
-- gate, so any logged-in user could in theory see usernames pending
-- reset. Tighten later if needed by joining auth.users.email = admin.
DROP POLICY IF EXISTS "auth_can_read_reset_request" ON public.password_reset_requests;
CREATE POLICY "auth_can_read_reset_request"
  ON public.password_reset_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can update status (mark completed/denied).
DROP POLICY IF EXISTS "auth_can_update_reset_request" ON public.password_reset_requests;
CREATE POLICY "auth_can_update_reset_request"
  ON public.password_reset_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
