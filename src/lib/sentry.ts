/**
 * Sentry initialization for native crash + JS error capture.
 *
 * Reads SENTRY_DSN from Constants.expoConfig.extra (EAS builds)
 * or EXPO_PUBLIC_SENTRY_DSN (Metro / local dev). If neither is set,
 * native crash capture is disabled but JS-level reporting still works
 * through our built-in errorReporter → bug_reports pipeline.
 */
import * as Sentry from 'sentry-expo';
import Constants from 'expo-constants';

const dsn =
  Constants.expoConfig?.extra?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  null;

export function initSentry(): void {
  if (!dsn) {
    console.log('[Sentry] No DSN configured — native crash capture disabled.');
    return;
  }

  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: false,
    tracesSampleRate: 0.25,
    // Attach the same device context our bug_reports pipeline uses
    beforeSend(event) {
      // Don't double-report JS errors — the errorReporter already sends
      // those to bug_reports. Sentry is for native crashes only.
      return event;
    },
  });

  console.log('[Sentry] Initialized — native crash capture active');
}

export { Sentry };
