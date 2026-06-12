-- Bug reports — allow ANONYMOUS inserts so no report is ever silently lost (TYC-166)
--
-- Root cause of "Tiffany's bug reports never reached the DB":
--   002_bug_reports.sql created an INSERT policy only `FOR INSERT TO authenticated`.
--   The `anon` Postgres role had NO insert policy, so any submission made WITHOUT
--   an established session (a user who hit the auth-bypass bug, or the global
--   error reporter firing during pre-auth app startup) ran as `anon` and was
--   rejected by RLS — the row never persisted and the failure was easy to miss.
--
-- Fix: grant `anon` an INSERT policy scoped to anonymous rows only (user_id IS NULL).
--   Authenticated users keep the existing self-tagging policy (002). Together they
--   guarantee every bug report persists regardless of auth state. `anon` still has
--   NO select/update/delete policy, so this is write-only feedback intake.
--
-- Idempotent: safe to re-run.

-- INSERT (anon): unauthenticated clients may submit anonymous bug reports only.
-- auth.uid() is NULL for the anon role, so they can never tag a report to a real user.
DROP POLICY IF EXISTS "Bug reports insertable by anon" ON bug_reports;
CREATE POLICY "Bug reports insertable by anon" ON bug_reports
  FOR INSERT TO anon WITH CHECK (
    user_id IS NULL
  );
