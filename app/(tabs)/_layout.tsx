import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { c } from '../../src/theme/tokens';

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
          headerTitle: 'Rezzies',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>●</Text>,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          headerTitle: 'Rezzies',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>▲</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          headerTitle: 'Rezzies',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◆</Text>,
        }}
      />
    </Tabs>
  );
}
