import React from 'react';
import { Stack } from 'expo-router';
import { c } from '../../src/theme/tokens';

// Visual polish v2 (TYC-137): auth canvas matches the rest of the
// first-7-day surfaces (dark) rather than the legacy slate (#0F172A).
export default function AuthLayout() {
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
