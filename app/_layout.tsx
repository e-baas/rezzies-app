import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { installErrorReporter } from '../src/lib/errorReporter';

// Wire global JS error + unhandled-promise capture as early as possible.
installErrorReporter();

export default function RootLayout() {
  const { user, loading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

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
        {user ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
        <Stack.Screen name="report-bug" options={{ headerShown: true, title: 'Report a Bug', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  );
}
