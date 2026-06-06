-- Fix RLS recursion: the participants SELECT policy used
-- `EXISTS (SELECT 1 FROM participants p2 WHERE ...)` which is itself subject to RLS,
-- so the inner query returned 0 rows and the outer query also returned 0 rows.
-- Net effect: even legitimate users couldn't see their own program / participants.
--
-- The fix: a SECURITY DEFINER helper that bypasses RLS for the "what programs
-- does this user belong to?" lookup. Policies then call the helper instead of
-- self-referencing the participants table.

-- Helper: program ids the user is a participant in (bypasses RLS).
CREATE OR REPLACE FUNCTION public.user_program_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT program_id FROM participants WHERE user_id = uid;
$$;

REVOKE ALL ON FUNCTION public.user_program_ids(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_program_ids(uuid) TO authenticated;

-- Drop and recreate the broken policies.
DROP POLICY IF EXISTS "Participants viewable within program" ON participants;
CREATE POLICY "Participants viewable within program" ON participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR program_id IN (SELECT public.user_program_ids(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM programs pr
      WHERE pr.id = participants.program_id AND pr.sponsor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Programs viewable by participants" ON programs;
CREATE POLICY "Programs viewable by participants" ON programs
  FOR SELECT TO authenticated USING (
    sponsor_id = auth.uid()
    OR id IN (SELECT public.user_program_ids(auth.uid()))
  );

-- Habits + bonuses + periods + daily_checks + bonus_progress: same recursion risk
-- (they all do EXISTS against participants). Replace with the helper.
DROP POLICY IF EXISTS "Habits viewable by participants" ON habit_definitions;
CREATE POLICY "Habits viewable by participants" ON habit_definitions
  FOR SELECT TO authenticated USING (
    program_id IN (SELECT public.user_program_ids(auth.uid()))
    OR EXISTS (SELECT 1 FROM programs pr WHERE pr.id = habit_definitions.program_id AND pr.sponsor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Bonuses viewable by participants" ON monthly_bonuses;
CREATE POLICY "Bonuses viewable by participants" ON monthly_bonuses
  FOR SELECT TO authenticated USING (
    program_id IN (SELECT public.user_program_ids(auth.uid()))
    OR EXISTS (SELECT 1 FROM programs pr WHERE pr.id = monthly_bonuses.program_id AND pr.sponsor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Periods viewable by participants" ON periods;
CREATE POLICY "Periods viewable by participants" ON periods
  FOR SELECT TO authenticated USING (
    program_id IN (SELECT public.user_program_ids(auth.uid()))
    OR EXISTS (SELECT 1 FROM programs pr WHERE pr.id = periods.program_id AND pr.sponsor_id = auth.uid())
  );

-- daily_checks SELECT: keep "your own", but also let sponsors see their program's checks
-- (so the leaderboard / dashboards work for the program owner).
DROP POLICY IF EXISTS "Daily checks viewable by participant" ON daily_checks;
CREATE POLICY "Daily checks viewable by participant" ON daily_checks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = daily_checks.participant_id
        AND (
          p.user_id = auth.uid()
          OR p.program_id IN (SELECT public.user_program_ids(auth.uid()))
          OR EXISTS (SELECT 1 FROM programs pr WHERE pr.id = p.program_id AND pr.sponsor_id = auth.uid())
        )
    )
  );

-- bonus_progress SELECT: same pattern.
DROP POLICY IF EXISTS "Bonus progress viewable by participant" ON bonus_progress;
CREATE POLICY "Bonus progress viewable by participant" ON bonus_progress
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.id = bonus_progress.participant_id
        AND (
          p.user_id = auth.uid()
          OR p.program_id IN (SELECT public.user_program_ids(auth.uid()))
          OR EXISTS (SELECT 1 FROM programs pr WHERE pr.id = p.program_id AND pr.sponsor_id = auth.uid())
        )
    )
  );
