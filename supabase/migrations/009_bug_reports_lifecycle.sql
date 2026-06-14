-- Bug tracking lifecycle upgrade (TYC-171)
-- Moves bug_reports from a 4-state enum to a richer TEXT-based lifecycle with
-- priority, assignment, fix-commit, and per-stage timestamps. Idempotent:
-- safe to re-run.
--
-- Lifecycle states: open -> triaged -> in_progress -> fixed_untested ->
--                   fixed_tested -> closed   (or wont_fix at any point)
-- Priority: P0 (drop everything) .. P3 (someday). Default P2; chairman triages.

-- 1) Convert status enum -> TEXT so the lifecycle can grow without enum migrations.
--    Must drop the enum default before the type change, remap legacy values,
--    then re-establish the default + a CHECK guard.
ALTER TABLE bug_reports ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bug_reports ALTER COLUMN status TYPE TEXT USING status::text;

-- Remap legacy enum values onto the new vocabulary (no-op on second run).
UPDATE bug_reports SET status = 'fixed_tested' WHERE status = 'fixed';
UPDATE bug_reports SET status = 'wont_fix'     WHERE status = 'wontfix';

ALTER TABLE bug_reports ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE bug_reports ALTER COLUMN status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_status_check
    CHECK (status IN ('open','triaged','in_progress','fixed_untested','fixed_tested','closed','wont_fix'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) New lifecycle columns.
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS priority    TEXT DEFAULT 'P2';
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS tested_at   TIMESTAMPTZ;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS closed_at   TIMESTAMPTZ;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS fix_commit  TEXT;
-- fixed_at + triaged_at already exist from migration 002.

DO $$ BEGIN
  ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_priority_check
    CHECK (priority IS NULL OR priority IN ('P0','P1','P2','P3'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Auto-stamp lifecycle timestamps when status transitions. Keeps the
--    fixed/tested/closed/triaged dates accurate no matter who flips the status
--    (chairman triage, worker fix, QA pass) without app-side bookkeeping.
CREATE OR REPLACE FUNCTION set_bug_lifecycle_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'triaged'        AND NEW.triaged_at IS NULL THEN NEW.triaged_at := now(); END IF;
    IF NEW.status = 'fixed_untested' AND NEW.fixed_at   IS NULL THEN NEW.fixed_at   := now(); END IF;
    IF NEW.status = 'fixed_tested'   AND NEW.tested_at  IS NULL THEN NEW.tested_at  := now(); END IF;
    -- A bug can reach fixed_tested directly; make sure fixed_at is also set.
    IF NEW.status = 'fixed_tested'   AND NEW.fixed_at   IS NULL THEN NEW.fixed_at   := now(); END IF;
    IF NEW.status IN ('closed','wont_fix') AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bug_lifecycle ON bug_reports;
CREATE TRIGGER trg_bug_lifecycle
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION set_bug_lifecycle_timestamps();

-- 4) Helpful index for the priority-aware dev review sort.
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
