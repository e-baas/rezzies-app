import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { Program, HabitDefinition, MonthlyBonus, Participant } from '../types';

// Persisted key for the user's chosen "active" program (bug #17).
const ACTIVE_PROGRAM_KEY = 'rezzies.activeProgramId';

/** One program the signed-in user belongs to (for the switcher). */
export interface Membership {
  participantId: string;
  programId: string;
  programName: string;
  role: string;
  joinedAt: string;
}

interface ProgramState {
  currentProgram: Program | null;
  habits: HabitDefinition[];
  monthlyBonuses: MonthlyBonus[];
  participants: Participant[];
  loading: boolean;

  // Multi-program membership + active selection (bug #17 — program switching).
  memberships: Membership[];
  activeProgramId: string | null;

  createProgram: (data: {
    name: string; description: string; groupName: string;
    startDate: string; endDate: string;
    prizePoolAmount: number; prizeStructure: string;
    streakGracePeriod: boolean;
    habits: { name: string; points: number; emoji?: string }[];
    monthlyBonuses: { name: string; description: string; target: number; award: number; unit: string; periodId: string }[];
  }) => Promise<{ programId?: string; inviteCode?: string; error?: string }>;

  joinProgram: (inviteCode: string) => Promise<{ programId?: string; programName?: string; error?: string }>;
  loadProgram: (programId: string) => Promise<void>;
  loadHabits: (programId: string) => Promise<void>;
  loadBonuses: (programId: string) => Promise<void>;
  loadParticipants: (programId: string) => Promise<void>;

  /** Load all programs the signed-in user belongs to + restore the active one. */
  loadMyPrograms: () => Promise<Membership[]>;
  /** Persist + switch the active program (bug #17). */
  setActiveProgram: (programId: string) => Promise<void>;
}

export const useProgramStore = create<ProgramState>((set, get) => ({
  currentProgram: null, habits: [], monthlyBonuses: [], participants: [], loading: false,
  memberships: [], activeProgramId: null,

  createProgram: async (data) => {
    const user = (await supabase.auth.getSession()).data.session?.user;
    if (!user) return { error: 'Not authenticated' };

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: program, error: programError } = await supabase
      .from('programs').insert({
        name: data.name, description: data.description, group_name: data.groupName,
        sponsor_id: user.id,
        start_date: data.startDate, end_date: data.endDate, period_type: 'MONTHLY',
        scoring_model: 'DAILY_HABITS', status: 'ACTIVE', invite_code: inviteCode,
        prize_structure: data.prizeStructure, prize_pool_amount: data.prizePoolAmount, prize_config: {},
        streak_grace_period: data.streakGracePeriod,
      }).select().single();
    if (programError || !program) return { error: programError?.message || 'Failed to create program' };

    await supabase.from('participants').insert({
      user_id: user.id, program_id: program.id, role: 'SPONSOR', group_role: 'OWNER',
      total_points: 0, total_habits: 0, current_streak: 0, streak_longest: 0, health_data_consent: false,
    });

    if (data.habits.length > 0) {
      await supabase.from('habit_definitions').insert(
        data.habits.map((h, i) => ({ program_id: program.id, name: h.name, points: h.points, emoji: h.emoji || null, sort_order: i }))
      );
    }

    const start = new Date(data.startDate); const end = new Date(data.endDate);
    const periodInserts: any[] = []; let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      periodInserts.push({
        program_id: program.id, parent_period_id: null,
        name: current.toLocaleString('en', { month: 'long', year: 'numeric' }),
        type: 'MONTHLY',
        start_date: new Date(current.getFullYear(), current.getMonth(), 1).toISOString().split('T')[0],
        end_date: new Date(current.getFullYear(), current.getMonth() + 1, 0).toISOString().split('T')[0],
        sort_order: periodInserts.length,
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    if (periodInserts.length > 0) {
      const { data: periods } = await supabase.from('periods').insert(periodInserts).select();
      if (periods && data.monthlyBonuses.length > 0) {
        const bonusInserts = data.monthlyBonuses
          .filter((b) => b.name.trim())
          .map((b, i) => {
            // periodId carries the chosen calendar month index (0-11). Match it to
            // the period for that month so the bonus lands on the month the sponsor
            // actually picked — not just the i-th period.
            const monthIndex = parseInt(b.periodId, 10);
            const matched = Number.isFinite(monthIndex)
              ? periods.find((p) => new Date(p.start_date + 'T00:00:00').getMonth() === monthIndex)
              : undefined;
            const period = matched || periods[Math.min(i, periods.length - 1)];
            return {
              program_id: program.id,
              period_id: period.id,
              name: b.name, description: b.description, target: b.target, award: b.award, unit: b.unit,
            };
          });
        if (bonusInserts.length > 0) {
          await supabase.from('monthly_bonuses').insert(bonusInserts);
        }
      }
    }
    return { programId: program.id, inviteCode: program.invite_code };
  },

  joinProgram: async (inviteCode) => {
    // A user joining by invite code is not yet a participant or sponsor, so RLS
    // blocks a direct `programs` SELECT by invite_code (this was bug #15 — every
    // valid code reported "Invalid invite code"). The join now goes through a
    // SECURITY DEFINER RPC (migration 011) that resolves the code + inserts the
    // membership on the server, scoped to the caller's own auth.uid().
    const code = (inviteCode || '').trim();
    if (!code) return { error: 'Please enter an invite code' };

    const { data, error } = await supabase.rpc('join_program_by_code', { p_code: code });
    if (error) return { error: error.message || 'Could not join program' };
    if (!data || data.ok !== true) {
      return { error: (data && data.error) || 'Invalid invite code' };
    }

    // Make the freshly-joined program the active one + refresh memberships so
    // the home/leaderboard screens land on it immediately.
    if (data.program_id) {
      await get().setActiveProgram(data.program_id);
      await get().loadMyPrograms();
    }
    return { programId: data.program_id, programName: data.program_name };
  },

  loadProgram: async (programId) => {
    set({ loading: true });
    const { data } = await supabase.from('programs').select('*').eq('id', programId).single();
    set({ currentProgram: data as Program | null, loading: false });
  },
  loadHabits: async (programId) => {
    const { data } = await supabase.from('habit_definitions').select('*').eq('program_id', programId).order('sort_order');
    set({ habits: (data || []) as HabitDefinition[] });
  },
  loadBonuses: async (programId) => {
    const { data } = await supabase.from('monthly_bonuses').select('*').eq('program_id', programId).order('period_id');
    set({ monthlyBonuses: (data || []) as MonthlyBonus[] });
  },
  loadParticipants: async (programId) => {
    const { data } = await supabase.from('participants').select('*').eq('program_id', programId).order('total_habits', { ascending: false });
    set({ participants: (data || []) as Participant[] });
  },

  loadMyPrograms: async () => {
    const user = (await supabase.auth.getSession()).data.session?.user;
    if (!user) {
      set({ memberships: [], activeProgramId: null });
      return [];
    }
    // Embed the program name via the participants → programs FK. RLS allows
    // reading these programs because the user is a participant of each.
    const { data } = await supabase
      .from('participants')
      .select('id, program_id, role, joined_at, programs(name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    const memberships: Membership[] = (data || []).map((p: any) => ({
      participantId: p.id,
      programId: p.program_id,
      role: p.role,
      joinedAt: p.joined_at,
      programName: (p.programs && (Array.isArray(p.programs) ? p.programs[0]?.name : p.programs.name)) || 'Program',
    }));

    // Restore the persisted active program; fall back to the most recent join
    // if the stored one is gone (e.g. left the program) or never set.
    let active: string | null = null;
    try { active = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY); } catch { /* ignore */ }
    if (!active || !memberships.some((m) => m.programId === active)) {
      active = memberships[0]?.programId ?? null;
    }

    set({ memberships, activeProgramId: active });
    return memberships;
  },

  setActiveProgram: async (programId) => {
    try { await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, programId); } catch { /* ignore */ }
    set({ activeProgramId: programId });
  },
}));
