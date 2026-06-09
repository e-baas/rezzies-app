/**
 * Rezzies Notification System — Client Module
 *
 * Handles:
 * - Push token registration with Expo Notifications
 * - Storing/updating tokens in Supabase push_tokens table
 * - Foreground notification presentation
 * - Notification tap → deep link to home screen
 * - Notification preference sync (timezone, reminder_time, toggles)
 */
import * as Notifications from 'expo-notifications';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

// ── Token Management ────────────────────────────────────────

/**
 * Register for push notifications and persist the Expo push token.
 * Safe to call multiple times — idempotent token upsert.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!isDevice) {
    console.log('[notifications] Not a physical device — skipping push registration');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission denied');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();

  const token = tokenData.data;
  console.log('[notifications] Expo push token:', token.slice(0, 12) + '...');

  // Persist to Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[notifications] No authenticated user — cannot persist token');
    return token;
  }

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  );

  if (error) {
    console.warn('[notifications] Failed to persist push token:', error.message);
  }

  return token;
}

/**
 * Remove the push token on sign-out (so the scheduler stops sending).
 */
export async function unregisterPushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.warn('[notifications] Failed to remove push tokens:', error.message);
  }
}

// ── Notification Handler Setup ───────────────────────────────

/**
 * Configure how notifications behave when the app is in the foreground.
 * Must be called once at app startup, before any notification arrives.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Wire up tap-to-navigate: when user taps a notification, go to home tab.
 * The daily check-in screen is the primary landing for all notification types.
 */
export function setupNotificationTapHandler(): void {
  // Handle taps that opened the app from a killed state
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleNotificationTap(response);
    }
  });

  // Handle taps while app is backgrounded (not killed)
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response);
  });
}

function handleNotificationTap(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as
    | { trigger?: string; target?: string; celebrate?: boolean; milestone?: number }
    | undefined;

  console.log('[notifications] Tapped notification:', data);

  // All notification types deep-link to the home tab (daily check-in is the
  // primary action). Milestone taps additionally carry a `celebrate` flag in the
  // payload so the home screen can later replay the ring-pulse / particle burst
  // (overlay wiring lands with the visual-polish task); routing stays on the
  // plain home route to keep typed-routes happy.
  void data;

  // Use setTimeout to ensure navigation stack is ready
  setTimeout(() => {
    try {
      router.replace('/(tabs)/home');
    } catch (e) {
      // Fallback: try navigating to root tabs
      try {
        router.replace('/(tabs)');
      } catch (_) {
        console.warn('[notifications] Could not navigate after notification tap');
      }
    }
  }, 500);
}

// ── Notification Preferences ──────────────────────────────────

export interface NotificationPreferences {
  notifications_enabled: boolean; // master switch
  reminder_time: string;      // 'HH:MM:SS' in user's local time
  timezone: string;           // IANA timezone, e.g. 'America/New_York'
  notify_morning: boolean;
  notify_midday: boolean;
  notify_evening: boolean;
  notify_milestone: boolean;  // streak-milestone celebrations
  notifications_paused_until: string | null; // ISO timestamp; null = not paused
}

const DEFAULT_PREFS: NotificationPreferences = {
  notifications_enabled: true,
  reminder_time: '08:00:00',
  timezone: 'America/New_York',
  notify_morning: true,
  notify_midday: true,
  notify_evening: true,
  notify_milestone: true,
  notifications_paused_until: null,
};

/**
 * Detect device timezone. Falls back to UTC on failure.
 */
export function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/**
 * Load notification preferences from profiles table.
 */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_PREFS };

  const { data: profile } = await supabase
    .from('profiles')
    .select('notifications_enabled, reminder_time, timezone, notify_morning, notify_midday, notify_evening, notify_milestone, notifications_paused_until')
    .eq('id', user.id)
    .single();

  if (!profile) return { ...DEFAULT_PREFS };

  return {
    notifications_enabled: profile.notifications_enabled ?? DEFAULT_PREFS.notifications_enabled,
    reminder_time: profile.reminder_time ?? DEFAULT_PREFS.reminder_time,
    timezone: profile.timezone ?? detectTimezone(),
    notify_morning: profile.notify_morning ?? DEFAULT_PREFS.notify_morning,
    notify_midday: profile.notify_midday ?? DEFAULT_PREFS.notify_midday,
    notify_evening: profile.notify_evening ?? DEFAULT_PREFS.notify_evening,
    notify_milestone: profile.notify_milestone ?? DEFAULT_PREFS.notify_milestone,
    notifications_paused_until: profile.notifications_paused_until ?? null,
  };
}

/**
 * Save notification preferences to profiles table.
 * Also auto-detects timezone if the stored one is empty/default.
 */
export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Auto-detect timezone on first save if not explicitly set
  const updates: Record<string, unknown> = { ...prefs };
  if (!prefs.timezone || prefs.timezone === 'America/New_York') {
    const current = await loadNotificationPreferences();
    if (current.timezone === 'America/New_York') {
      updates.timezone = detectTimezone();
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.warn('[notifications] Failed to save preferences:', error.message);
    throw error;
  }
}

/**
 * Sync device timezone to profile on app launch (idempotent).
 */
export async function syncTimezone(): Promise<void> {
  const detected = detectTimezone();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  // Only update if the stored timezone doesn't match the device
  if (profile && profile.timezone !== detected) {
    await supabase
      .from('profiles')
      .update({ timezone: detected })
      .eq('id', user.id);
  }
}
