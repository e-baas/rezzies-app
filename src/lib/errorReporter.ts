/**
 * Expo built-in error reporting.
 *
 * What this captures:
 *  - JS-level uncaught errors via ErrorUtils.setGlobalHandler
 *  - Unhandled promise rejections via require('promise/setimmediate/rejection-tracking')
 *  - Component-tree errors via the <ErrorBoundary /> wrapper
 *
 * Each captured error is inserted into `bug_reports` with
 * `source = 'js_error' | 'unhandled_promise'`. The user's session bears the
 * auth, so RLS lets them insert their own row. We never throw from the
 * reporter — if the network is dead, we drop the report.
 */
import { submitBugReport } from './bugReports';

declare const ErrorUtils: {
  setGlobalHandler: (cb: (err: Error, isFatal?: boolean) => void) => void;
  getGlobalHandler: () => (err: Error, isFatal?: boolean) => void;
};

let installed = false;
let currentScreen: string | null = null;

/**
 * Set the screen name that subsequent reports should be tagged with.
 * Wired in HomeScreen/Profile/etc. via useFocusEffect.
 */
export function setCurrentScreen(name: string | null): void {
  currentScreen = name;
}

export function getCurrentScreen(): string | null {
  return currentScreen;
}

/**
 * Install global hooks. Idempotent — safe to call from any module init path.
 */
export function installErrorReporter(): void {
  if (installed) return;
  installed = true;

  // 1) Uncaught JS errors
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    void submitBugReport({
      description:
        `[auto] ${err?.message ?? String(err)}` +
        (isFatal ? ' (fatal)' : ''),
      severity: isFatal ? 'blocks' : 'annoying',
      source: 'js_error',
      screen_name: currentScreen,
      stack_trace: err?.stack ?? null,
    });
    // Always forward to the original handler so RN's red box / crash flow still fires.
    prev(err, isFatal);
  });

  // 2) Unhandled promise rejections
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: any) => {
        const err: Error =
          error instanceof Error ? error : new Error(String(error));
        void submitBugReport({
          description: `[auto] unhandled rejection: ${err.message}`,
          severity: 'annoying',
          source: 'unhandled_promise',
          screen_name: currentScreen,
          stack_trace: err.stack ?? null,
        });
        // Log so devs still see it in Metro
        console.warn('Unhandled promise rejection', id, err);
      },
      onHandled: () => {},
    });
  } catch {
    // promise/rejection-tracking may not be available on web; skip silently.
  }
}
