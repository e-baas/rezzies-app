import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { isDevUser } from '../../src/lib/devEmails';
import { submitBugReport } from '../../src/lib/bugReports';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const isDev = isDevUser(user?.email);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const throwJsError = () => {
    // Triggers the global ErrorUtils handler -> bug_reports row with source=js_error
    setTimeout(() => {
      throw new Error('[dev] deliberate JS error from Profile → Throw JS Error');
    }, 0);
  };

  const throwRenderCrash = async () => {
    // Logs a deliberate "native_crash" row first so the chain is provable even if
    // the subsequent throw prevents the auto-reporter from flushing on weak networks,
    // then throws synchronously so the React ErrorBoundary catches it.
    await submitBugReport({
      description: '[dev] deliberate crash test triggered from Profile → Throw Render Crash',
      severity: 'low',
      source: 'native_crash',
      screen_name: 'profile',
      stack_trace: new Error('manual crash marker').stack ?? null,
    });
    throw new Error('[dev] deliberate render crash from Profile → Throw Render Crash');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.display_name || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.display_name || 'User'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/create-program')}>
          <Text style={styles.menuEmoji}>🎯</Text>
          <Text style={styles.menuText}>Create New Program</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/join-program')}>
          <Text style={styles.menuEmoji}>🔗</Text>
          <Text style={styles.menuText}>Join Program</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications')}>
          <Text style={styles.menuEmoji}>🔔</Text>
          <Text style={styles.menuText}>Notifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/report-bug')}>
          <Text style={styles.menuEmoji}>🐞</Text>
          <Text style={styles.menuText}>Report a Bug</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} disabled={loggingOut}>
          <Text style={styles.menuEmoji}>🚪</Text>
          <Text style={[styles.menuText, styles.logoutText]}>
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </View>

      {isDev && (
        <View style={styles.section}>
          <View style={styles.devHeader}>
            <Text style={styles.devHeaderText}>🛠 Developer</Text>
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={throwJsError}>
            <Text style={styles.menuEmoji}>⚠️</Text>
            <Text style={styles.menuText}>Throw JS Error</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              throwRenderCrash().catch(() => {});
            }}
          >
            <Text style={styles.menuEmoji}>💥</Text>
            <Text style={styles.menuText}>Throw Render Crash</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.version}>The Rezzies v1.0.0</Text>
      <Text style={styles.attribution}>
        made with <Text style={styles.attributionLink}>Tycoon.us</Text> · superagent
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16 },
  profileCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: '#F3F4F6',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#6366F1',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: 'white' },
  name: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  section: {
    backgroundColor: 'white', borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  menuEmoji: { fontSize: 20, marginRight: 12 },
  menuText: { fontSize: 16, fontWeight: '500', color: '#1F2937', flex: 1 },
  logoutText: { color: '#EF4444' },
  devHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  devHeaderText: { fontSize: 12, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 8 },
  attribution: { textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  attributionLink: { color: '#6366F1', textDecorationLine: 'underline' },
});
