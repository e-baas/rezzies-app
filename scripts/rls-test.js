#!/usr/bin/env node
/**
 * RLS isolation test for The Rezzies (TYC-43 acceptance criterion).
 *
 * Creates two test programs (A and B), each with its own sponsor user
 * and one participant. Then signs in as participant_A and asserts:
 *   - Can read program A's participants
 *   - Can NOT read program B's participants
 *   - Can NOT read program B's daily_checks
 *   - Can NOT read program B's bug_reports
 *
 * Tears down after itself (delete cascade).
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/rls-test.js
 *
 * Exit 0 = all asserts passed; exit 1 = at least one isolation breach.
 */
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const ts = Date.now();
const pwd = 'TestPassword!123';
const users = {
  sponsorA: { email: `rls-spa-${ts}@therezzies.test` },
  sponsorB: { email: `rls-spb-${ts}@therezzies.test` },
  memberA:  { email: `rls-ma-${ts}@therezzies.test` },
  memberB:  { email: `rls-mb-${ts}@therezzies.test` },
};
const programs = {
  A: { name: `RLS Test A ${ts}`, invite: `RLS-A-${ts}` },
  B: { name: `RLS Test B ${ts}`, invite: `RLS-B-${ts}` },
};

let failures = 0;
function assert(label, cond, detail) {
  if (cond) console.log(`  ✔ ${label}`);
  else {
    console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`);
    failures++;
  }
}

async function createUser(u) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: pwd,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
  u.id = data.user.id;
  // Insert profile row (server-side via service key)
  const { error: pErr } = await admin
    .from('profiles')
    .insert({ id: u.id, email: u.email, display_name: u.email.split('@')[0] });
  if (pErr) throw new Error(`profile insert ${u.email}: ${pErr.message}`);
}

async function deleteUserSafe(u) {
  if (!u.id) return;
  // Cascade through programs/participants etc. will catch most rows; we also
  // wipe the profile so the FK doesn't hold.
  await admin.auth.admin.deleteUser(u.id).catch(() => {});
}

async function createProgram(p, sponsorId) {
  const { data, error } = await admin.from('programs').insert({
    name: p.name,
    sponsor_id: sponsorId,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    period_type: 'MONTHLY',
    invite_code: p.invite,
  }).select('id').single();
  if (error) throw new Error(`program ${p.name}: ${error.message}`);
  p.id = data.id;
}

async function addParticipant(programId, userId) {
  const { data, error } = await admin.from('participants').insert({
    program_id: programId,
    user_id: userId,
  }).select('id').single();
  if (error) throw new Error(`participant: ${error.message}`);
  return data.id;
}

async function addHabit(programId, name) {
  const { data, error } = await admin
    .from('habit_definitions')
    .insert({ program_id: programId, name, points: 5 })
    .select('id').single();
  if (error) throw new Error(`habit: ${error.message}`);
  return data.id;
}

async function addDailyCheck(participantId, habitId, date) {
  const { error } = await admin
    .from('daily_checks')
    .insert({ participant_id: participantId, habit_id: habitId, date, checked: true });
  if (error) throw new Error(`daily_check: ${error.message}`);
}

async function signInAs(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pwd });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

async function main() {
  console.log('=== RLS isolation test ===');

  try {
    console.log('Seeding…');
    for (const u of Object.values(users)) await createUser(u);
    await createProgram(programs.A, users.sponsorA.id);
    await createProgram(programs.B, users.sponsorB.id);
    const partA = await addParticipant(programs.A.id, users.memberA.id);
    const partB = await addParticipant(programs.B.id, users.memberB.id);
    // also add the sponsors as participants in their own programs (typical)
    await addParticipant(programs.A.id, users.sponsorA.id);
    await addParticipant(programs.B.id, users.sponsorB.id);
    const habA = await addHabit(programs.A.id, 'Hydrate');
    const habB = await addHabit(programs.B.id, 'Stretch');
    await addDailyCheck(partA, habA, '2026-06-06');
    await addDailyCheck(partB, habB, '2026-06-06');

    // Insert a bug_report tied to memberB (via service role bypassing RLS)
    const { error: brErr } = await admin.from('bug_reports').insert({
      user_id: users.memberB.id,
      user_email: users.memberB.email,
      description: 'RLS test bug from member B',
      severity: 'low',
      source: 'manual',
    });
    if (brErr) throw new Error(`bug_reports seed: ${brErr.message}`);

    console.log('\nSigning in as memberA…');
    const aClient = await signInAs(users.memberA.email);

    console.log('\n--- Group isolation asserts ---');

    // memberA reads participants — should see A's rows, not B's
    const { data: pA } = await aClient.from('participants').select('id, program_id, user_id');
    const ids = (pA ?? []).map((r) => r.program_id);
    assert(
      'memberA sees only program A participants',
      ids.length > 0 && ids.every((id) => id === programs.A.id),
      `got program_ids=${JSON.stringify([...new Set(ids)])}`
    );
    assert('memberA cannot see program B participants', !ids.includes(programs.B.id));

    // memberA reads programs
    const { data: progs } = await aClient.from('programs').select('id, name');
    const progIds = (progs ?? []).map((r) => r.id);
    assert(
      'memberA can see program A',
      progIds.includes(programs.A.id)
    );
    assert(
      'memberA cannot see program B',
      !progIds.includes(programs.B.id),
      `progs=${JSON.stringify(progIds)}`
    );

    // memberA reads daily_checks
    const { data: dcA } = await aClient.from('daily_checks').select('id, participant_id');
    const dcIds = (dcA ?? []).map((r) => r.participant_id);
    assert('memberA cannot see program B daily_checks', !dcIds.includes(partB));

    // memberA reads bug_reports — should see zero (not in DEV_EMAILS, not sponsor of B)
    const { data: br } = await aClient.from('bug_reports').select('id, user_email');
    assert(
      'non-dev/non-sponsor cannot read bug_reports',
      (br ?? []).length === 0,
      `got ${br?.length ?? 0} rows`
    );

    // memberA can insert their own bug_report
    const { error: insErr } = await aClient.from('bug_reports').insert({
      user_id: users.memberA.id,
      user_email: users.memberA.email,
      description: 'RLS test self-insert from member A',
      severity: 'low',
      source: 'manual',
    });
    assert(
      'memberA can insert their own bug_report',
      !insErr,
      insErr?.message
    );

    // memberA cannot insert a bug_report tagged as memberB
    const { error: spoofErr } = await aClient.from('bug_reports').insert({
      user_id: users.memberB.id,
      user_email: users.memberB.email,
      description: 'RLS test spoof — should fail',
      severity: 'low',
      source: 'manual',
    });
    assert(
      'memberA cannot spoof bug_report as memberB',
      !!spoofErr,
      spoofErr ? '' : 'no error returned'
    );

    await aClient.auth.signOut();
  } finally {
    console.log('\nCleanup…');
    // Programs cascade-delete participants, habits, checks. bug_reports user_id is nullable on profile delete.
    if (programs.A.id) await admin.from('programs').delete().eq('id', programs.A.id);
    if (programs.B.id) await admin.from('programs').delete().eq('id', programs.B.id);
    await admin.from('bug_reports').delete().like('description', 'RLS test %');
    for (const u of Object.values(users)) {
      if (u.id) {
        try { await admin.from('profiles').delete().eq('id', u.id); } catch {}
      }
      await deleteUserSafe(u);
    }
  }

  console.log(`\n${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
