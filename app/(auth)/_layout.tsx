import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { c } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';

// Visual polish v2 (TYC-137): auth canvas matches the rest of the
// first-7-day surfaces (dark) rather than the legacy slate (#0F172A).
export default function AuthLayout() {
  // Once a user signs in (auth state flips), don't keep them on the auth
  // stack — send them into the program (Bug #1 sign-in transition).
  const user = useAuthStore((s) => s.user);
  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
