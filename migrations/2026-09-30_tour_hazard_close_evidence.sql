-- Upgrade review 13 (30/09/2026): evidence for closing a tour hazard. Before
-- this a closed hazard had only a date: no "after" photo, no one who closed it,
-- nothing on what was done (39 closed, 16 of them high, on 30/09/2026).
--
-- Michael, 30/09/2026 in the questionnaire: the "after" photo is optional,
-- always; no re-check after closing for now; and the department report gets a
-- "mark as handled" link per hazard (functions/api/close-hazard.js), like the
-- trustees' alert mail.
--
--   closed_by        who closed it: the signed-in user in the tour screen, or
--                    the name typed on the link's page
--   close_note       what was done (free text, optional)
--   after_photo_url  the "after" photo (optional), bucket incidents-photos
--
-- Reopening clears the three. Not destructive: new nullable columns only; the
-- existing policies (admin/manager all, viewer no update) cover them as they
-- are. The link writes with the service key.
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS closed_by text;
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS close_note text;
ALTER TABLE public.tour_hazards ADD COLUMN IF NOT EXISTS after_photo_url text;

-- Verify:
--   SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
--     AND table_name = 'tour_hazards' AND column_name IN ('closed_by', 'close_note', 'after_photo_url');  -- 3
-- Rollback (Michael's OK first):
--   ALTER TABLE public.tour_hazards DROP COLUMN closed_by, DROP COLUMN close_note, DROP COLUMN after_photo_url;
