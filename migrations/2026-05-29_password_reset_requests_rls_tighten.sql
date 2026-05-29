-- Security audit fix (finding M2) — 2026-05-29
--
-- The original 2026-05-09 migration left SELECT and UPDATE on
-- password_reset_requests as `TO authenticated USING (true)`. That let ANY
-- logged-in user — including a low-privilege "מדווח" (reporter) and an
-- anonymous-sign-in emp-mode session — do two bad things via direct REST:
--   1. SELECT every row → enumerate which usernames are mid password-reset
--      (+ timing). Username/PII enumeration.
--   2. UPDATE any row → mark another user's request completed/denied →
--      denial-of-service on the password-reset flow.
--
-- The real self-recovery flow runs server-side in functions/api/self-recovery.js
-- with the SERVICE ROLE key, which bypasses RLS entirely — so tightening these
-- policies does NOT affect it. The admin inbox UI (_pwReqLoad) is already gated
-- behind _isAdminUser() and only fires for admin, who passes is_admin_manager().
--
-- Net effect: admin inbox keeps working; reporters/managers can no longer
-- read or tamper with reset rows over the REST API. anon INSERT is left as-is
-- (INSERT-only, documented design for the pre-login forgot-password path).
--
-- NOTE: the role gate function lives in the `private` schema as
-- `private.is_admin_manager()` (SECURITY DEFINER, search_path=public). There
-- is NO `public.is_admin_manager()`. Verified live 2026-05-29.
--
-- Idempotent, safe to re-run.

DROP POLICY IF EXISTS "auth_can_read_reset_request" ON public.password_reset_requests;
CREATE POLICY "auth_can_read_reset_request"
  ON public.password_reset_requests
  FOR SELECT
  TO authenticated
  USING (private.is_admin_manager());

DROP POLICY IF EXISTS "auth_can_update_reset_request" ON public.password_reset_requests;
CREATE POLICY "auth_can_update_reset_request"
  ON public.password_reset_requests
  FOR UPDATE
  TO authenticated
  USING (private.is_admin_manager())
  WITH CHECK (private.is_admin_manager());

NOTIFY pgrst, 'reload schema';
