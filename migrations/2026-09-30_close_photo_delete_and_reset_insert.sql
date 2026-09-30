-- Upgrade review 19 (30/09/2026, Michael approved in the questionnaire:
-- "yes, close both"). Two permissions that were wider than the app needs.
--
-- 1. Any signed-in user, a reporter too, could delete or replace a photo in
--    incidents-photos: the evidence of an incident or a hazard. Now only
--    admin / manager (private.is_admin_manager()). Uploading a new photo is
--    unchanged (incidents_photos_insert_named_user). The app never deletes a
--    photo from the browser; server functions use the service role.
-- 2. anon could insert rows into password_reset_requests directly, around
--    /api/self-recovery and its one-request-per-window limit, and a flood of
--    fake requests could get one approved by mistake. The server inserts with
--    the service role, so the anon policy is dropped.
--
-- Rollback (the definitions as they were before this migration):
--   DROP POLICY IF EXISTS incidents_photos_delete_named_user ON storage.objects;
--   CREATE POLICY incidents_photos_delete_named_user ON storage.objects FOR DELETE TO authenticated
--     USING (bucket_id = 'incidents-photos' AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false AND COALESCE(auth.jwt() ->> 'email', '') <> '');
--   DROP POLICY IF EXISTS incidents_photos_update_named_user ON storage.objects;
--   CREATE POLICY incidents_photos_update_named_user ON storage.objects FOR UPDATE TO authenticated
--     USING (bucket_id = 'incidents-photos' AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false AND COALESCE(auth.jwt() ->> 'email', '') <> '')
--     WITH CHECK (bucket_id = 'incidents-photos' AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false AND COALESCE(auth.jwt() ->> 'email', '') <> '');
--   CREATE POLICY anon_can_insert_reset_request ON public.password_reset_requests FOR INSERT TO anon WITH CHECK (true);


DROP POLICY IF EXISTS incidents_photos_delete_named_user ON storage.objects;
CREATE POLICY incidents_photos_delete_named_user ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incidents-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND (SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS incidents_photos_update_named_user ON storage.objects;
CREATE POLICY incidents_photos_update_named_user ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'incidents-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND (SELECT private.is_admin_manager()))
  WITH CHECK (bucket_id = 'incidents-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND (SELECT private.is_admin_manager()));

DROP POLICY IF EXISTS anon_can_insert_reset_request ON public.password_reset_requests;

