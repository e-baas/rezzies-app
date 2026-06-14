import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BugReportModal } from './BugReportModal';
import { IS_BETA_BUILD } from '../lib/buildEnv';
import { c } from '../theme/tokens';

/**
 * Beta-only overlay (bugs #11 / #12).
 *
 * Wraps the whole app in a capturable view and floats a small, unobtrusive bug
 * button in the bottom-right corner. Tapping it:
 *   1. captures the CURRENT screen (the floating button + modal live OUTSIDE the
 *      captured subtree, so they never appear in the screenshot),
 *   2. opens the bug report modal as an overlay (no navigation away),
 *   3. on submit, uploads the shot to Supabase and saves the report to OUR DB —
 *      so beta feedback stops leaking to App Store Connect.
 *
 * Gated behind `IS_BETA_BUILD`: it is a pass-through in the production build, so
 * nothing ships to the App Store.
 */
export function BetaBugOverlay({ children }: { children: React.ReactNode }) {
  // Production build: render children untouched, zero overhead, no button.
  if (!IS_BETA_BUILD) {
    return <>{children}</>;
  }
  return <BetaBugOverlayInner>{children}</BetaBugOverlayInner>;
}

function BetaBugOverlayInner({ children }: { children: React.ReactNode }) {
  const shotRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [capturing, setCapturing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(null);

  const handlePress = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    let base64: string | null = null;
    try {
      base64 = await captureRef(shotRef, {
        format: 'png',
        quality: 0.8,
        result: 'base64',
      });
    } catch (e: any) {
      // Capture can fail on some simulators / first frame — still let the user
      // file a text-only report rather than blocking them.
      console.warn('[BetaBugOverlay] capture failed', e?.message ?? e);
      base64 = null;
    }
    setShot(base64);
    setCapturing(false);
    setModalOpen(true);
  }, [capturing]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setShot(null);
  }, []);

  // Sit above the tab bar + home indicator so the button never covers content.
  const bottom = (insets.bottom || 0) + 84;

  return (
    <View style={styles.root}>
      {/* Captured subtree — the app itself. */}
      <View ref={shotRef} collapsable={false} style={styles.fill}>
        {children}
      </View>

      {/* Floating button — sibling of the captured subtree, so excluded from the shot. */}
      <TouchableOpacity
        accessibilityLabel="Report a bug"
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.fab, { bottom, right: 16 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {capturing ? (
          <ActivityIndicator color="#06302B" size="small" />
        ) : (
          <Text style={styles.fabIcon}>🐞</Text>
        )}
      </TouchableOpacity>

      <BugReportModal
        visible={modalOpen}
        screenshotBase64={shot}
        screenName={pathname ?? null}
        onClose={handleClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  fab: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.secondary, // teal #14B8A6
    opacity: 0.62, // unobtrusive until tapped
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  fabIcon: { fontSize: 22 },
});
