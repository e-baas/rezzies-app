/**
 * Sentry initialization for native crash + JS error capture.
 *
 * Reads the DSN from Constants.expoConfig.extra.sentryDsn (EAS builds) or
 * EXPO_PUBLIC_SENTRY_DSN (Metro / local dev). If neither is set, native crash
 * capture is disabled but JS-level reporting still works through our built-in
 * errorReporter -> bug_reports pipeline.
 *
 * NOTE (TYC-139): the legacy `sentry-expo` package is deprecated and
 * incompatible with Expo SDK 52, which broke the EAS JS bundle. Since no DSN
 * is configured yet, Sentry is currently inert, so this module lazy-loads
 * `@sentry/react-native` (the correct SDK 52+ package) only when a DSN exists.
 * To fully enable native crash capture: add `@sentry/react-native` + its Expo
 * config plugin to the project, then set `extra.sentryDsn`. Until then,
 * TestFlight's native crash logs + the in-app bug report pipeline cover us.
 */
import Constants from 'expo-constants';

const dsn =
  (Constants.expoConfig?.extra as any)?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  null;

export function initSentry(): void {
  if (!dsn) {
    console.log('[Sentry] No DSN configured — native crash capture disabled.');
    return;
  }
  try {
    // Lazy require so the app bundles even when the native Sentry package
    // is not installed. Enable by adding @sentry/react-native.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native');
    Sentry.init({ dsn, debug: false, tracesSampleRate: 0.25 });
    console.log('[Sentry] Initialized — native crash capture active');
  } catch (e: any) {
    console.log(
      '[Sentry] @sentry/react-native not installed — crash capture disabled.',
      e?.message,
    );
  }
}
