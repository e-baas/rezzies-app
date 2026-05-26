-- Rezzies MVP Schema
-- Supabase PostgreSQL migration
-- Mirrors the canonical Program Data Model (2019–2026 Schema)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === Profiles (extends Supabase auth.users) ===
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  health_data_consent BOOLEAN NOT NULL DEFAULT false, -- v2 wearable stub
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Programs ===
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  group_name TEXT DEFAULT '',
  sponsor_id UUID NOT NULL REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'MONTHLY',
  group_size INT DEFAULT 0,
  prize_structure TEXT NOT NULL DEFAULT 'PLACEMENT',
  prize_pool_amount INT DEFAULT 0,
  prize_config JSONB DEFAULT '{}',
  min_participation_threshold INT,
  scoring_model TEXT NOT NULL DEFAULT 'DAILY_HABITS',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  invite_code TEXT NOT NULL UNIQUE,
  streak_grace_period BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Periods (tree structure via parent_period_id) ===
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  parent_period_id UUID REFERENCES periods(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Participants ===
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'PARTICIPANT', -- SPONSOR, ADMIN, PARTICIPANT, VIEWER
  group_role TEXT NOT NULL DEFAULT 'MEMBER', -- OWNER, MEMBER
  total_points INT NOT NULL DEFAULT 0,
  total_habits INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  streak_longest INT NOT NULL DEFAULT 0, -- all-time best streak
  health_data_consent BOOLEAN NOT NULL DEFAULT false, -- v2 wearable stub
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- === Habit Definitions (daily checklist template per program) ===
CREATE TABLE habit_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points INT NOT NULL DEFAULT 5,
  emoji TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- === Monthly Bonus Challenges ===
CREATE TABLE monthly_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  target INT NOT NULL,
  award INT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'count'
);

-- === Daily Checks (per participant, per habit, per day) ===
-- Schema identical to what Terra/Vital webhook would write in v2
CREATE TABLE daily_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habit_definitions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_id, habit_id, date)
);

-- === Bonus Progress (per participant, per bonus) ===
CREATE TABLE bonus_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  bonus_id UUID NOT NULL REFERENCES monthly_bonuses(id) ON DELETE CASCADE,
  current INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_id, bonus_id)
);

-- === Indexes ===
CREATE INDEX idx_participants_program ON participants(program_id);
CREATE INDEX idx_participants_user ON participants(user_id);
CREATE INDEX idx_daily_checks_participant_date ON daily_checks(participant_id, date);
CREATE INDEX idx_daily_checks_date ON daily_checks(date);
CREATE INDEX idx_bonus_progress_participant ON bonus_progress(participant_id);
CREATE INDEX idx_habit_definitions_program ON habit_definitions(program_id);
CREATE INDEX idx_monthly_bonuses_program ON monthly_bonuses(program_id);
CREATE INDEX idx_periods_program ON periods(program_id);
CREATE INDEX idx_programs_sponsor ON programs(sponsor_id);
CREATE INDEX idx_programs_invite ON programs(invite_code);

-- === RLS Policies ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_progress ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read any profile, update only their own
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Programs: viewable by participants, insert by authenticated
CREATE POLICY "Programs viewable by participants" ON programs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE program_id = id AND user_id = auth.uid())
    OR sponsor_id = auth.uid()
  );
CREATE POLICY "Programs insertable by authenticated" ON programs
  FOR INSERT TO authenticated WITH CHECK (sponsor_id = auth.uid());

-- Participants: viewable within same program
CREATE POLICY "Participants viewable within program" ON participants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants p2 WHERE p2.program_id = program_id AND p2.user_id = auth.uid())
  );
CREATE POLICY "Participants insertable by authenticated" ON participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Habit definitions: viewable by program participants
CREATE POLICY "Habits viewable by participants" ON habit_definitions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE program_id = habit_definitions.program_id AND user_id = auth.uid())
  );

-- Monthly bonuses: viewable by program participants
CREATE POLICY "Bonuses viewable by participants" ON monthly_bonuses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE program_id = monthly_bonuses.program_id AND user_id = auth.uid())
  );

-- Daily checks: participants manage their own
CREATE POLICY "Daily checks viewable by participant" ON daily_checks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );
CREATE POLICY "Daily checks insertable by participant" ON daily_checks
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );
CREATE POLICY "Daily checks updatable by participant" ON daily_checks
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );

-- Bonus progress: participants manage their own
CREATE POLICY "Bonus progress viewable by participant" ON bonus_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );
CREATE POLICY "Bonus progress insertable by participant" ON bonus_progress
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );
CREATE POLICY "Bonus progress updatable by participant" ON bonus_progress
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE id = participant_id AND user_id = auth.uid())
  );

-- Periods: viewable by program participants
CREATE POLICY "Periods viewable by participants" ON periods
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM participants WHERE program_id = periods.program_id AND user_id = auth.uid())
  );
