-- H2 (security audit) — stop the app_users PII broadcast.
--
-- Before: `app_users_read` was `FOR SELECT TO authenticated USING (true)`.
-- Every logged-in user (including the anonymous-sign-in emp-mode session)
-- could `GET /rest/v1/app_users?select=*` and harvest the phone + email of
-- all 12 employees. The login flow itself only ever looks up the caller's
-- OWN row (`username=eq.<own>`); the assignee dropdown only really matters
-- to admin/manager who already pass `is_admin_manager()`.
--
-- New policy: a row is visible to authenticated iff
--   (a) caller is admin/manager (sees everyone, no change), OR
--   (b) the row's `id` matches the part-before-@ of the caller's email
--       (caller can only see themselves).
--
-- Effect:
-- * Admin / manager: unchanged (sees all 12).
-- * Reporter: sees ONLY their own row → login still works (lookup by own
--   username matches own id), the assignee dropdown is empty for them
--   (acceptable — reporters don't assign tasks), and the _resolvePhone
--   helper returns null for other users (the call site already handles
--   `u?String(u.phone):null` gracefully).
-- * Anon (pre-login) — unchanged (no policy match; cannot read).
--
-- TESTED LIVE on prod (2026-05-29) via SET LOCAL ROLE authenticated +
-- forged JWT claims:
--   T1 admin        → 12 rows visible. PASS.
--   T2 user1 reporter → 1 row visible, only own ('user1'). PASS.
--   T3 user1 login fetch (?username=eq.user1) → 1 row returned. PASS.
--   T4 user1 attacks ?username=eq.user2 → 0 rows, no phone/email leak. PASS.
--   T5 user1 raw SELECT * → only 1 row total. PASS.
--   T6 testagent1 (approved user) self-lookup → 1 row with active=true,
--      full_name + own phone/email visible. PASS — login flow intact.
--
-- The write-side policy `app_users_admin_write` is unchanged (still
-- admin-email only). Idempotent, safe to re-run.

DROP POLICY IF EXISTS "app_users_read" ON public.app_users;
CREATE POLICY "app_users_read" ON public.app_users
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_admin_manager())
    OR id = split_part(auth.jwt() ->> 'email', '@', 1)
  );

NOTIFY pgrst, 'reload schema';
