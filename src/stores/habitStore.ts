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
    if (existing?.id) {
      await supabase.from('daily_checks').update({ checked: newChecked }).eq('id', existing.id);
      set({ todayChecks: checks.map((c) => c.habit_id === habitId ? { ...c, checked: newChecked } : c) });
    } else {
      const { data } = await supabase.from('daily_checks').insert({ participant_id: participantId, habit_id: habitId, date, checked: newChecked }).select().single();
      if (data) set({ todayChecks: checks.map((c) => c.habit_id === habitId ? data as DailyCheck : c) });
    }
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
    const { data: participants } = await supabase.from('participants').select('id, user_id, total_points, total_habits, current_streak').eq('program_id', programId).order('total_habits', { ascending: false });
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
      .map((p: any) => ({ user_id: p.user_id, display_name: profileMap[p.user_id] || 'Unknown', habits_month: monthCounts[p.id] || 0, habits_year: p.total_habits, total_points: p.total_points, current_streak: p.current_streak, rank: 0 }))
      .sort((a, b) => { if (b.habits_year !== a.habits_year) return b.habits_year - a.habits_year; if (b.total_points !== a.total_points) return b.total_points - a.total_points; if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak; return a.display_name.localeCompare(b.display_name); })
      .map((e, i) => ({ ...e, rank: i + 1 }));
    set({ leaderboard: entries, loading: false });
  },
}));
