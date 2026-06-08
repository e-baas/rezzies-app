-- Rezzies Notification System Migration
-- Adds notification preferences to profiles + push token storage

-- === Notification preferences on profiles ===
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS notify_morning BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_midday BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_evening BOOLEAN DEFAULT true;

-- === Push token registry (one token per device per user) ===
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Index for scheduler queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- RLS: users can only manage their own tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Push tokens manageable by owner" ON push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- === View for scheduler: users eligible for a notification window ===
-- Computes local time per user based on their stored timezone.
-- The scheduler queries this with the target hour and checks daily_checks separately.
CREATE OR REPLACE VIEW notification_eligible_users AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.display_name,
  p.reminder_time,
  p.timezone,
  p.notify_morning,
  p.notify_midday,
  p.notify_evening,
  part.id AS participant_id,
  part.current_streak,
  part.streak_longest,
  part.program_id,
  (SELECT COUNT(*) FROM habit_definitions hd WHERE hd.program_id = part.program_id) AS total_habits
FROM profiles p
JOIN participants part ON part.user_id = p.id
WHERE p.timezone IS NOT NULL;
