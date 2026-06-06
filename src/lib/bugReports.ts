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
 * Insert a single row into `bug_reports`. Auto-attaches the signed-in
 * user, email, and a device-context snapshot. Returns the inserted row
 * id (or null on failure — we never crash the host caller).
 */
export async function submitBugReport(input: SubmitBugInput): Promise<{
  id: string | null;
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

    const { data, error } = await supabase
      .from('bug_reports')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.warn('[bugReports] insert failed', error.message);
      return { id: null, error: error.message };
    }
    return { id: data?.id ?? null, error: null };
  } catch (e: any) {
    console.warn('[bugReports] submit threw', e?.message ?? e);
    return { id: null, error: e?.message ?? 'unknown' };
  }
}
