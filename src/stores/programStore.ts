import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Program, HabitDefinition, MonthlyBonus, Participant } from '../types';

interface ProgramState {
  currentProgram: Program | null;
  habits: HabitDefinition[];
  monthlyBonuses: MonthlyBonus[];
  participants: Participant[];
  loading: boolean;

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
}

export const useProgramStore = create<ProgramState>((set) => ({
  currentProgram: null, habits: [], monthlyBonuses: [], participants: [], loading: false,

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
          .map((b, i) => ({
            program_id: program.id,
            period_id: periods[Math.min(i, periods.length - 1)].id,
            name: b.name, description: b.description, target: b.target, award: b.award, unit: b.unit,
          }));
        if (bonusInserts.length > 0) {
          await supabase.from('monthly_bonuses').insert(bonusInserts);
        }
      }
    }
    return { programId: program.id, inviteCode: program.invite_code };
  },

  joinProgram: async (inviteCode) => {
    const user = (await supabase.auth.getSession()).data.session?.user;
    if (!user) return { error: 'Not authenticated' };
    const { data: program, error } = await supabase.from('programs').select('*').eq('invite_code', inviteCode.toUpperCase()).single();
    if (error || !program) return { error: 'Invalid invite code' };
    const { data: existing } = await supabase.from('participants').select('id').eq('user_id', user.id).eq('program_id', program.id).single();
    if (existing) return { programId: program.id, programName: program.name };
    await supabase.from('participants').insert({
      user_id: user.id, program_id: program.id, role: 'PARTICIPANT', group_role: 'MEMBER',
      total_points: 0, total_habits: 0, current_streak: 0, streak_longest: 0, health_data_consent: false,
    });
    return { programId: program.id, programName: program.name };
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
}));
