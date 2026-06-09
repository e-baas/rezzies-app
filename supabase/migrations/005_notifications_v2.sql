-- Rezzies Notification System — v2 (chairman-approved UX, TYC-138)
-- Builds on 004_notifications.sql. Fully idempotent so it is safe to run
-- whether or not 004 has already been applied to the hosted project.
--
-- Adds the columns + log table the approved frequency philosophy needs:
--   • master switch + vacation pause            (Settings UX: "Pause for 7 days")
--   • milestone-celebration opt-out toggle       (Q2 approved: 5th trigger in v1)
--   • notification_log                           (idempotency, 2/day hard cap,
--                                                 copy rotation, once-ever milestones)
-- and re-creates the scheduler view to expose profile.created_at (48h honeymoon)
-- and the new preference columns.

-- === Preference columns (idempotent; 004 may already have added the first set) ===
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS notify_morning BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_midday BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_evening BOOLEAN DEFAULT true,
  -- v2 additions:
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,      -- master switch
  ADD COLUMN IF NOT EXISTS notify_milestone BOOLEAN DEFAULT true,           -- streak-milestone celebrations
  ADD COLUMN IF NOT EXISTS notifications_paused_until TIMESTAMPTZ;          -- vacation pause (NULL = not paused)

-- === Push token registry (idempotent — owned by 004, re-asserted for safety) ===
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens' AND policyname = 'Push tokens manageable by owner'
  ) THEN
    CREATE POLICY "Push tokens manageable by owner" ON push_tokens
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- === Notification log ===
-- One row per (user, local-date, category). Drives three rules at once:
--   1. Idempotency  — UNIQUE(user_id, sent_date, category) means a 15-min
--      re-tick inside the ±7-min window cannot double-send.
--   2. 2/day cap    — scheduler counts rows for (user_id, sent_date) before sending.
--   3. Copy rotation — variant_index lets the scheduler avoid repeating the
--      same string two days in a row.
-- Milestone rows use category = 'milestone:7' | 'milestone:30' | ... so each
-- milestone fires once, ever (no sent_date dedup collision across days).
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_date DATE NOT NULL,                 -- user's LOCAL date when sent
  category TEXT NOT NULL,                   -- 'morning' | 'midday' | 'evening' | 'milestone:<N>'
  variant_index INT,                        -- which copy variant was used (for rotation)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, sent_date, category)
);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_date
  ON notification_log(user_id, sent_date);
-- Fast "did we ever send this milestone?" lookup.
CREATE INDEX IF NOT EXISTS idx_notification_log_user_category
  ON notification_log(user_id, category);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- Owner may read their own log (useful for the in-app "why did I get this?" debug);
-- only the service_role (scheduler) writes, so no INSERT policy for authenticated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_log' AND policyname = 'Notification log readable by owner'
  ) THEN
    CREATE POLICY "Notification log readable by owner" ON notification_log
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END$$;

-- === Scheduler view ===
-- Re-created to expose profile.created_at (48h honeymoon gate) and the new
-- preference columns. One row per participant; the scheduler aggregates to one
-- push per user.
--
-- NOTE: we DROP then CREATE rather than CREATE OR REPLACE. Migration 004 already
-- shipped this view with a different column set/order (it had `profile_id` and
-- lacked `profile_created_at` + the v2 preference columns). Postgres
-- `CREATE OR REPLACE VIEW` cannot drop or reorder existing columns, so replacing
-- the 004 view in place errors out. DROP VIEW IF EXISTS makes this safe whether
-- the project is on 004's view, 005's view, or has no view at all.
DROP VIEW IF EXISTS notification_eligible_users;
CREATE VIEW notification_eligible_users AS
SELECT
  p.id                         AS user_id,
  p.display_name,
  p.created_at                 AS profile_created_at,
  p.reminder_time,
  p.timezone,
  p.notifications_enabled,
  p.notify_morning,
  p.notify_midday,
  p.notify_evening,
  p.notify_milestone,
  p.notifications_paused_until,
  part.id                      AS participant_id,
  part.current_streak,
  part.streak_longest,
  part.program_id,
  (SELECT COUNT(*) FROM habit_definitions hd WHERE hd.program_id = part.program_id) AS total_habits
FROM profiles p
JOIN participants part ON part.user_id = p.id
WHERE p.timezone IS NOT NULL;
