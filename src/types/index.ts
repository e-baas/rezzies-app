// === Rezzies Type Definitions ===
// Mirrors the canonical Program Data Model (2019–2026 Schema)

export type ScoringType =
  | 'DAILY_HABIT'
  | 'MONTHLY_BONUS'
  | 'COMPETITIVE'
  | 'TOURNAMENT'
  | 'HURDLE'
  | 'HURDLE_PLUS_BONUS'
  | 'PERSONAL_GOAL'
  | 'WEARABLE_AUTO'; // v2 stub

export type PeriodType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM' | 'DAILY';
export type ScoringModel = 'CLASSIC' | 'DAILY_HABITS' | 'HYBRID';
export type ProgramStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type PrizeStructure = 'PLACEMENT' | 'TIERED' | 'POOL_PERCENTAGE' | 'FIXED_PER_WINNER';
export type ParticipantRole = 'SPONSOR' | 'ADMIN' | 'PARTICIPANT' | 'VIEWER';
export type GroupRole = 'OWNER' | 'MEMBER';

// === Program ===
export interface Program {
  id: string;
  name: string;
  description: string;
  sponsor_id: string;
  group_name: string;
  start_date: string;
  end_date: string;
  period_type: PeriodType;
  group_size: number;
  prize_structure: PrizeStructure;
  prize_pool_amount: number;
  prize_config: Record<string, unknown>; // JSON — flexible prize config
  min_participation_threshold: number | null;
  scoring_model: ScoringModel;
  status: ProgramStatus;
  invite_code: string; // unique join code
  streak_grace_period: boolean; // sponsor toggle: 1 missed day doesn't break streak
  created_at: string;
  updated_at: string;
}

// === Habit Definition (daily checklist template) ===
export interface HabitDefinition {
  id: string;
  program_id: string;
  name: string;
  points: number;
  emoji?: string;
  sort_order: number;
}

// === Monthly Bonus Challenge ===
export interface MonthlyBonus {
  id: string;
  program_id: string;
  period_id: string; // which month
  name: string;
  description: string;
  target: number;
  award: number; // fixed points on completion
  unit: string;
}

// === Period ===
export interface Period {
  id: string;
  program_id: string;
  parent_period_id: string | null;
  name: string;
  type: PeriodType;
  start_date: string;
  end_date: string;
  sort_order: number;
}

// === Participant ===
export interface Participant {
  id: string;
  user_id: string;
  program_id: string;
  role: ParticipantRole;
  group_role: GroupRole;
  total_points: number;
  total_habits: number;
  current_streak: number;
  streak_longest: number; // all-time best streak
  health_data_consent: boolean; // v2 wearable stub
  joined_at: string;
}

// === Daily Check (2026 model) ===
export interface DailyCheck {
  id: string;
  participant_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  checked: boolean;
  created_at: string;
}

// === Monthly Bonus Progress ===
export interface BonusProgress {
  id: string;
  participant_id: string;
  bonus_id: string;
  current: number;
  completed: boolean;
  updated_at: string;
}

// === User Profile ===
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  health_data_consent: boolean; // v2 stub
  created_at: string;
}

// === Leaderboard Entry ===
export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  habits_month: number;
  habits_year: number;
  total_points: number;
  current_streak: number;
  streak_longest: number;
  rank: number;
}

// === Scoring Engine Input (abstracted) ===
export interface ScoringInput {
  type: ScoringType;
  participant_id: string;
  program_id: string;
  payload: Record<string, unknown>; // flexible: habit IDs, numeric results, etc.
}

// === Scoring Result ===
export interface ScoringResult {
  points: number;
  habit_count: number;
  details: Record<string, unknown>;
}

// === Bug Reports / Crash Captures ===
export type BugSeverity = 'low' | 'annoying' | 'blocks';
export type BugSource = 'manual' | 'js_error' | 'native_crash' | 'unhandled_promise';
export type BugStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'fixed_untested'
  | 'fixed_tested'
  | 'closed'
  | 'wont_fix';
export type BugPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface BugReport {
  id: string;
  user_id: string | null;
  user_email: string | null;
  description: string;
  severity: BugSeverity;
  source: BugSource;
  screen_name: string | null;
  screenshot_url: string | null;
  device_model: string | null;
  os_platform: string | null;
  os_version: string | null;
  app_version: string | null;
  app_build: string | null;
  stack_trace: string | null;
  status: BugStatus;
  priority: BugPriority | null;
  assigned_to: string | null;
  fix_commit: string | null;
  created_at: string;
  triaged_at: string | null;
  fixed_at: string | null;
  tested_at: string | null;
  closed_at: string | null;
}

// === Navigation ===
export type RootStackParamList = {
  '(auth)/sign-in': undefined;
  '(auth)/sign-up': undefined;
  '(tabs)': undefined;
  'create-program': undefined;
  'join-program': undefined;
  'program/[id]': { id: string };
  'report-bug': undefined;
};
