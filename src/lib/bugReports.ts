import { supabase } from './supabase';
import { getDeviceContext } from './deviceContext';
import type { BugSeverity, BugSource } from '../types';

interface SubmitBugInput {
  description: string;
  severity?: BugSeverity;
  source?: BugSource;
  screen_name?: string | null;
  stack_trace?: string | null;
  // override the snapshot — useful for the error reporter
  device_override?: Partial<ReturnType<typeof getDeviceContext>>;
}

/**
 * Insert a single row into `bug_reports`. Auto-attaches the signed-in user,
 * email, and a device-context snapshot.
 *
 * IMPORTANT (TYC-166): this does a plain INSERT with NO `.select()`/RETURNING.
 * The SELECT RLS policy on `bug_reports` only lets devs + program sponsors read
 * rows, so an `insert().select()` forces a RETURNING that the regular pilot
 * family (a non-sponsor participant) — and any anonymous user — cannot satisfy.
 * That made the whole insert fail RLS and silently roll back: only sponsor/dev
 * accounts ever persisted reports. Inserting without RETURNING lets every
 * authenticated user (and anonymous submissions via the migration-008 anon
 * policy) write their own report. We return `{ ok }` instead of a row id since
 * the caller never needs the id and we cannot read it back under RLS anyway.
 */
export async function submitBugReport(input: SubmitBugInput): Promise<{
  ok: boolean;
  error: string | null;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    const ctx = { ...getDeviceContext(), ...(input.device_override ?? {}) };

    const row = {
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      description: input.description.slice(0, 4000),
      severity: input.severity ?? 'annoying',
      source: input.source ?? 'manual',
      screen_name: input.screen_name ?? null,
      stack_trace: input.stack_trace ? input.stack_trace.slice(0, 8000) : null,
      device_model: ctx.device_model,
      os_platform: ctx.os_platform,
      os_version: ctx.os_version,
      app_version: ctx.app_version,
      app_build: ctx.app_build,
    };

    // No `.select()` — see the note above. We only need the error.
    const { error } = await supabase.from('bug_reports').insert(row);

    if (error) {
      // Visibility: log loudly (console.error, not warn) with enough context to
      // diagnose silent drops, and surface a clearer message for RLS rejections.
      const isRls =
        /row-level security|violates row-level/i.test(error.message) ||
        error.code === '42501';
      console.error('[bugReports] insert failed', {
        message: error.message,
        code: (error as any).code ?? null,
        authed: !!user,
        source: row.source,
        screen: row.screen_name,
      });
      const friendly = isRls
        ? 'Your report could not be saved (permission). Please sign in and try again.'
        : error.message;
      return { ok: false, error: friendly };
    }
    return { ok: true, error: null };
  } catch (e: any) {
    console.error('[bugReports] submit threw', e?.message ?? e);
    return { ok: false, error: e?.message ?? 'unknown' };
  }
}
