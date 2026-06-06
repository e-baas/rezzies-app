-- Bug reports + crash captures table for in-app "Report a Bug" + Dev review Doc (TYC-43)
-- Idempotent: safe to re-run.

-- Severity helpers
DO $$ BEGIN
  CREATE TYPE bug_severity AS ENUM ('low', 'annoying', 'blocks');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bug_source AS ENUM ('manual', 'js_error', 'native_crash', 'unhandled_promise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bug_status AS ENUM ('open', 'triaged', 'fixed', 'wontfix');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  description TEXT NOT NULL,
  severity bug_severity NOT NULL DEFAULT 'annoying',
  source bug_source NOT NULL DEFAULT 'manual',
  screen_name TEXT,
  device_model TEXT,
  os_platform TEXT,
  os_version TEXT,
  app_version TEXT,
  app_build TEXT,
  stack_trace TEXT,
  status bug_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triaged_at TIMESTAMPTZ,
  fixed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created ON bug_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_source ON bug_reports(source);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- INSERT: any signed-in user can write a bug report tagged to themselves (or anonymous)
DROP POLICY IF EXISTS "Bug reports insertable by self" ON bug_reports;
CREATE POLICY "Bug reports insertable by self" ON bug_reports
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

-- SELECT: chairman (DEV_EMAILS) + program sponsors of programs this reporter belongs to
DROP POLICY IF EXISTS "Bug reports viewable by devs and sponsors" ON bug_reports;
CREATE POLICY "Bug reports viewable by devs and sponsors" ON bug_reports
  FOR SELECT TO authenticated USING (
    (auth.jwt() ->> 'email') IN ('dan@amaze.net')
    OR EXISTS (
      SELECT 1 FROM participants p
      JOIN programs pr ON pr.id = p.program_id
      WHERE p.user_id = bug_reports.user_id
        AND pr.sponsor_id = auth.uid()
    )
  );

-- UPDATE: dev allowlist only (triage)
DROP POLICY IF EXISTS "Bug reports updatable by devs" ON bug_reports;
CREATE POLICY "Bug reports updatable by devs" ON bug_reports
  FOR UPDATE TO authenticated USING (
    (auth.jwt() ->> 'email') IN ('dan@amaze.net')
  );
