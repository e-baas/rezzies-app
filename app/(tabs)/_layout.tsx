import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { c } from '../../src/theme/tokens';
import Logo from '../../src/components/brand/Logo';

// Tab-bar header brand: small "rings + Rezzies" mark (no tagline) per TYC-151.
const HeaderLogo = () => <Logo variant="mark" theme="dark" width={104} />;

export default function TabLayout() {
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
