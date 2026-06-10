import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DailyCheck, BonusProgress, LeaderboardEntry } from '../types';

interface HabitState {
  todayChecks: DailyCheck[];
  bonusProgress: BonusProgress[];
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  loadTodayChecks: (participantId: string, habitIds: string[]) => Promise<void>;
  toggleHabit: (participantId: string, habitId: string, date: string) => Promise<void>;
  loadBonusProgress: (participantId: string, bonusIds: string[]) => Promise<void>;
  updateBonusProgress: (participantId: string, bonusId: string, current: number, target: number, award: number) => Promise<void>;
  loadLeaderboard: (programId: string) => Promise<void>;
}

/**
 * Calculate streak: consecutive days (including today) with at least 1 checked habit.
 * If grace_period is true, allows 1 gap day without breaking the streak.
 */
async function recalculateStreak(
  participantId: string,
  programId: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  // Get all checked dates for this participant, ordered newest first
  const { data: allChecks } = await supabase
    .from('daily_checks')
    .select('date')
    .eq('participant_id', participantId)
    .eq('checked', true)
    .order('date', { ascending: false });

  if (!allChecks || allChecks.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique check dates (group by date, count checks per day)
  const checkDays = new Set<string>();
  for (const c of allChecks) {
    checkDays.add(c.date);
  }
  const sortedDays = Array.from(checkDays).sort().reverse(); // newest first

  // Check if today has any checked habits
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  // Current streak: count consecutive days backward from today
  let streak = 0;
  let graceUsed = false;

  // Get streak_grace_period from program
  const { data: program } = await supabase
    .from('programs')
    .select('streak_grace_period')
    .eq('id', programId)
    .single();
  const gracePeriod = program?.streak_grace_period ?? false;

  // Check each day starting from today, going backward
  const checkDate = new Date(today);
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hadCheck = sortedDays.includes(dateStr);

    if (hadCheck) {
      streak++;
      graceUsed = false; // reset grace on a checked day
    } else {
      if (gracePeriod && !graceUsed && streak > 0) {
        // Skip one day (grace day), but only if we already have at least 1 streak day
        graceUsed = true;
      } else {
        break; // streak ends
      }
    }

    checkDate.setDate(checkDate.getDate() - 1);

    // Safety: don't loop forever
    if (streak > 366) break;
  }

  // Get current longest from DB
  const { data: participant } = await supabase
    .from('participants')
    .select('streak_longest')
    .eq('id', participantId)
    .single();
  const prevLongest = participant?.streak_longest ?? 0;
  const longestStreak = Math.max(prevLongest, streak);

  // Update participant
  await supabase
    .from('participants')
    .update({ current_streak: streak, streak_longest: longestStreak })
    .eq('id', participantId);

  return { currentStreak: streak, longestStreak };
}

/**
 * Recalculate total_habits and total_points for a participant from daily_checks.
 */
async function recalculateTotals(participantId: string, habitPointsMap: Record<string, number>) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Get all time checked habits
  const { data: allChecks } = await supabase
    .from('daily_checks')
    .select('habit_id')
    .eq('participant_id', participantId)
    .eq('checked', true);

  const totalHabits = allChecks?.length ?? 0;
  let totalPoints = 0;
  for (const c of allChecks ?? []) {
    totalPoints += habitPointsMap[c.habit_id] || 0;
  }

  await supabase
    .from('participants')
    .update({ total_habits: totalHabits, total_points: totalPoints })
    .eq('id', participantId);

  return { totalHabits, totalPoints };
}

export const useHabitStore = create<HabitState>((set, get) => ({
  todayChecks: [], bonusProgress: [], leaderboard: [], loading: false,

  loadTodayChecks: async (participantId, habitIds) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('daily_checks').select('*').eq('participant_id', participantId).eq('date', today);
    const existing = data || [];
    set({ todayChecks: habitIds.map((habitId) => {
      const found = existing.find((c: any) => c.habit_id === habitId);
      return found || { id: '', participant_id: participantId, habit_id: habitId, date: today, checked: false, created_at: today };
    })});
  },

  toggleHabit: async (participantId, habitId, date) => {
    const checks = get().todayChecks;
    const existing = checks.find((c) => c.habit_id === habitId);
    const newChecked = !existing?.checked;

    // Upsert the daily_check row
    if (existing?.id) {
      await supabase.from('daily_checks').update({ checked: newChecked }).eq('id', existing.id);
      set({ todayChecks: checks.map((c) => c.habit_id === habitId ? { ...c, checked: newChecked } : c) });
    } else {
      const { data } = await supabase.from('daily_checks').insert({ participant_id: participantId, habit_id: habitId, date, checked: newChecked }).select().single();
      if (data) set({ todayChecks: checks.map((c) => c.habit_id === habitId ? data as DailyCheck : c) });
    }

    // Determine program_id for this participant
    const { data: participant } = await supabase
      .from('participants')
      .select('program_id')
      .eq('id', participantId)
      .single();
    const programId = participant?.program_id;
    if (!programId) return;

    // Load habit definitions for point values
    const { data: habits } = await supabase
      .from('habit_definitions')
      .select('id, points')
      .eq('program_id', programId);
    const habitPointsMap: Record<string, number> = {};
    (habits || []).forEach((h: any) => { habitPointsMap[h.id] = h.points; });

    // Recalculate streak and totals (fire-and-forget, but we could show the result)
    await Promise.all([
      recalculateStreak(participantId, programId),
      recalculateTotals(participantId, habitPointsMap),
    ]);
  },

  loadBonusProgress: async (participantId, bonusIds) => {
    const { data } = await supabase.from('bonus_progress').select('*').eq('participant_id', participantId);
    const existing = data || [];
    set({ bonusProgress: bonusIds.map((bonusId) => {
      const found = existing.find((p: any) => p.bonus_id === bonusId);
      return found || { id: '', participant_id: participantId, bonus_id: bonusId, current: 0, completed: false, updated_at: new Date().toISOString() };
    })});
  },

  updateBonusProgress: async (participantId, bonusId, current, target, award) => {
    const completed = current >= target;
    const progress = get().bonusProgress;
    const existing = progress.find((p) => p.bonus_id === bonusId);
    if (existing?.id) {
      await supabase.from('bonus_progress').update({ current, completed }).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('bonus_progress').insert({ participant_id: participantId, bonus_id: bonusId, current, completed }).select().single();
      if (data) { set({ bonusProgress: [...progress.filter((p) => p.bonus_id !== bonusId), data as BonusProgress] }); return; }
    }
    set({ bonusProgress: progress.map((p) => p.bonus_id === bonusId ? { ...p, current, completed } : p) });
  },

  loadLeaderboard: async (programId) => {
    set({ loading: true });
    const { data: participants } = await supabase.from('participants').select('id, user_id, total_points, total_habits, current_streak, streak_longest').eq('program_id', programId).order('total_points', { ascending: false });
    if (!participants) { set({ loading: false }); return; }
    const userIds = participants.map((p: any) => p.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.display_name; });
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const { data: monthChecks } = await supabase.from('daily_checks').select('participant_id').eq('checked', true).gte('date', monthStart).in('participant_id', participants.map((p: any) => p.id));
    const monthCounts: Record<string, number> = {};
    (monthChecks || []).forEach((c: any) => { monthCounts[c.participant_id] = (monthCounts[c.participant_id] || 0) + 1; });
    const entries: LeaderboardEntry[] = participants
      .map((p: any) => ({ user_id: p.user_id, display_name: profileMap[p.user_id] || 'Unknown', habits_month: monthCounts[p.id] || 0, habits_year: p.total_habits, total_points: p.total_points, current_streak: p.current_streak || 0, streak_longest: p.streak_longest || 0, rank: 0 }))
      .sort((a, b) => { if (b.total_points !== a.total_points) return b.total_points - a.total_points; if (b.habits_year !== a.habits_year) return b.habits_year - a.habits_year; if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak; return a.display_name.localeCompare(b.display_name); })
      .map((e, i) => ({ ...e, rank: i + 1 }));
    set({ leaderboard: entries, loading: false });
  },
}));
