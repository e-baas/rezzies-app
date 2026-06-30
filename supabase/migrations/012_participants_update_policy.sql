-- Rezzies — participants UPDATE RLS policy (bugs #22, #23 root cause)
--
-- The `participants` table had RLS enabled with SELECT + INSERT policies but
-- NO UPDATE policy. The client recomputes a participant's aggregate columns
-- (total_points, total_habits, current_streak, streak_longest) after every
-- habit toggle via `recalculateTotals` / `recalculateStreak` in
-- src/stores/habitStore.ts, which issue:
--     supabase.from('participants').update({...}).eq('id', participantId)
--
-- With no UPDATE policy, PostgREST/RLS silently matched 0 rows (no client
-- error), so total_points/total_habits/current_streak stayed 0 for every
-- participant even after dozens of checked habits. Symptoms reported:
--   • Bug #22 — "My points are not appearing on the leaderboard."
--   • Bug #23 — "the leaderboard is counting up months instead of points
--                 when I check off a daily task."
--     (habits_month is computed live from daily_checks, so the Month column
--      incremented; the Pts column reads the never-updated total_points.)
--
-- Fix: allow a user to UPDATE their OWN participant row. This mirrors the
-- daily_checks UPDATE policy (self-scoped by user_id) and the trust model
-- already in place for client-managed daily_checks.
--
-- Idempotent (guarded by pg_policies existence check).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'participants'
      and policyname = 'Participants updatable by self'
  ) then
    create policy "Participants updatable by self" on participants
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end$$;
