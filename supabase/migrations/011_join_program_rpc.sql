-- Join Program by invite code — SECURITY DEFINER RPC (TYC-174, bug #15)
--
-- Root cause of "Join program codes don't work":
--   The `programs` SELECT policy (003_fix_rls_recursion.sql) only lets a user
--   read a program row if they are already the sponsor or already a
--   participant:
--     USING (sponsor_id = auth.uid() OR id IN (SELECT user_program_ids(auth.uid())))
--   A user joining by invite code is NEITHER yet, so the client-side lookup
--     supabase.from('programs').select('*').eq('invite_code', CODE).single()
--   returns zero rows under RLS and joinProgram() reported "Invalid invite
--   code" for every valid code. Reproduced live: a freshly-created
--   authenticated non-member cannot SELECT the program row by invite_code.
--
-- Fix: a SECURITY DEFINER function that performs the lookup + membership
--   insert with the definer's rights (bypassing RLS for this one controlled
--   operation), instead of weakening the programs SELECT policy (which would
--   expose every program row to every authenticated user). The function only
--   ever returns the matched program's id + name, never the full row, and only
--   inserts a participant tied to the caller's own auth.uid().
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.join_program_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_program programs%ROWTYPE;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF p_code IS NULL OR length(btrim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter an invite code');
  END IF;

  -- Case-insensitive match on the invite code (codes are stored uppercase).
  SELECT * INTO v_program
    FROM programs
   WHERE upper(invite_code) = upper(btrim(p_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid invite code');
  END IF;

  -- Already a member? Treat as success (idempotent join).
  SELECT EXISTS (
    SELECT 1 FROM participants
     WHERE user_id = v_uid AND program_id = v_program.id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_member', true,
      'program_id', v_program.id, 'program_name', v_program.name
    );
  END IF;

  INSERT INTO participants (
    user_id, program_id, role, group_role,
    total_points, total_habits, current_streak, streak_longest, health_data_consent
  ) VALUES (
    v_uid, v_program.id, 'PARTICIPANT', 'MEMBER',
    0, 0, 0, 0, false
  );

  RETURN jsonb_build_object(
    'ok', true, 'already_member', false,
    'program_id', v_program.id, 'program_name', v_program.name
  );
END;
$$;

-- Lock down execution: only authenticated users may call it. anon cannot
-- (they have no auth.uid() to attach a membership to).
REVOKE ALL ON FUNCTION public.join_program_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_program_by_code(text) TO authenticated;
