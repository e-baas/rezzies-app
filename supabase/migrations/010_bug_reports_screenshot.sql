-- Bug report screenshot attachments (TYC-173 — bugs #11, #12)
--
-- #11: "Bug reports need screenshot attachment capability"
-- #12: "iOS screenshot share-beta-feedback goes to ASC, not our DB" — the in-app
--      floating bug button auto-captures the screen and routes it to OUR DB,
--      so beta screenshots stop leaking to App Store Connect.
--
-- Adds a `screenshot_url` column and a public `bug-screenshots` storage bucket
-- with write-only intake policies (authenticated + anon) plus public read so
-- the Dev Review doc can render the image links. Idempotent: safe to re-run.

-- 1) Column on the report row holding the uploaded screenshot's public URL.
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- 2) Storage bucket. Public read so screenshot URLs resolve in the dev review
--    surface; 10 MB cap; common image mime types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bug-screenshots',
  'bug-screenshots',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) INSERT (authenticated): signed-in users may upload into this bucket only.
DROP POLICY IF EXISTS "Bug screenshots insertable by authenticated" ON storage.objects;
CREATE POLICY "Bug screenshots insertable by authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bug-screenshots');

-- 4) INSERT (anon): mirror the bug_reports anon-insert policy (migration 008) so
--    a report filed before a session is established still keeps its screenshot.
DROP POLICY IF EXISTS "Bug screenshots insertable by anon" ON storage.objects;
CREATE POLICY "Bug screenshots insertable by anon" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'bug-screenshots');

-- 5) SELECT (public): explicit read policy for the public bucket. Write-only
--    intake + public read — no update/delete policy, so uploads are immutable.
DROP POLICY IF EXISTS "Bug screenshots readable by all" ON storage.objects;
CREATE POLICY "Bug screenshots readable by all" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'bug-screenshots');
