import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { installErrorReporter } from '../src/lib/errorReporter';
import { initSentry } from '../src/lib/sentry';
import {
  setupNotificationHandler,
  setupNotificationTapHandler,
  registerForPushNotifications,
  syncTimezone,
} from '../src/lib/notifications';

// Wire global JS error + unhandled-promise capture as early as possible.
installErrorReporter();
// Init Sentry for native crash capture (no-op if DSN not configured).
initSentry();
// Configure notification behavior (foreground presentation).
setupNotificationHandler();

export default function RootLayout() {
  const { user, loading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  // Initialize notifications + timezone sync when user is authenticated
  useEffect(() => {
    if (!user) return;

    // Register for push notifications + sync timezone (fire-and-forget)
    registerForPushNotifications();
    syncTimezone();
    setupNotificationTapHandler();
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Both route groups are always declared so navigation never lands on
            an unregistered screen. Access control lives in each group's
            _layout via a Redirect guard (Bug #1): (auth) bounces signed-in
            users to the program, (tabs) bounces unauthenticated users to
            sign-in. The entry route (index) picks the correct group on launch. */}
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report-bug" options={{ headerShown: true, title: 'Report a Bug', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  );
}
