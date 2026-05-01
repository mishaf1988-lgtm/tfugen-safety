-- Migration: notification_prefs — per-user notification preferences matrix
-- Date: 2026-05-01
-- Each user defines, per event type, which channels (WhatsApp / Email /
-- In-app) should fire automatic notifications. Inspired by Vitre §11.
--
-- prefs jsonb shape:
--   {
--     "ncr_critical":  { "whatsapp": true,  "email": true,  "inapp": true  },
--     "task_overdue":  { "whatsapp": true,  "email": false, "inapp": true  },
--     "expiry_30days": { "whatsapp": false, "email": true,  "inapp": false },
--     "round_missed":  { "whatsapp": true,  "email": false, "inapp": false },
--     "incident_critical": { "whatsapp": true, "email": true, "inapp": true }
--   }
--
-- Missing keys default to all-off, so a fresh user gets no surprises.
--
-- How to run:
--   1. Open Supabase dashboard → SQL Editor → + New query
--   2. Paste this entire file
--   3. Click Run

-- `id` holds the user email — kept as `id` (not `user_email`) for consistency
-- with the rest of the schema and the sbIns/sbUpd helpers in the client.
CREATE TABLE IF NOT EXISTS notification_prefs (
  id          text        PRIMARY KEY,
  prefs       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ts          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'notification_prefs_own'
  ) THEN
    CREATE POLICY notification_prefs_own ON notification_prefs
      FOR ALL
      TO authenticated
      USING (id = (auth.jwt() ->> 'email'))
      WITH CHECK (id = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- Rollback:
-- DROP TABLE IF EXISTS notification_prefs;
