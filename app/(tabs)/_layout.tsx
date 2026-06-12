import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Text } from 'react-native';
import { c } from '../../src/theme/tokens';
import Logo from '../../src/components/brand/Logo';
import { useAuthStore } from '../../src/stores/authStore';

// Tab-bar header brand: small "rings + Rezzies" mark (no tagline) per TYC-151.
const HeaderLogo = () => <Logo variant="mark" theme="dark" width={104} />;

export default function TabLayout() {
  // Auth gate (Bug #1): program content (the tabs) must never render for an
  // unauthenticated user, even via a stale deep-link or direct navigation.
  // Bounce to sign-in if there is no signed-in user.
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg, shadowOpacity: 0, elevation: 0 },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800', letterSpacing: -0.4, fontSize: 18 },
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: c.secondary,
        tabBarInactiveTintColor: c.text3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Today',
          headerTitle: HeaderLogo,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>●</Text>,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          headerTitle: HeaderLogo,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>▲</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          headerTitle: HeaderLogo,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◆</Text>,
        }}
      />
    </Tabs>
  );
}
