import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useHabitStore } from '../../src/stores/habitStore';
import { useProgramStore } from '../../src/stores/programStore';
import { LeaderboardRow } from '../../src/components/LeaderboardRow';
import { c, radii, space } from '../../src/theme/tokens';

// Visual polish v2 (TYC-137): dark canvas, orange RefreshControl tint
// (orange = aggregate-progress signal — pulling for fresh standings is
// inherently an aggregate-progress action), column headers in muted
// uppercase, tabular nums in stat values via LeaderboardRow.

export default function LeaderboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { leaderboard, loading, loadLeaderboard } = useHabitStore();
  const activeProgramId = useProgramStore((s) => s.activeProgramId);
  const loadMyPrograms = useProgramStore((s) => s.loadMyPrograms);
  const [programId, setProgramId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    // Bug #17: a user can be in multiple programs (the old `.single()` lookup
    // errored for them). Use the shared ACTIVE program so the leaderboard
    // matches the program shown on Home.
    const mems = await loadMyPrograms();
    const active = useProgramStore.getState().activeProgramId;
    const target = active || mems[0]?.programId || null;
    if (target) {
      setProgramId(target);
      await loadLeaderboard(target);
    } else {
      setProgramId(null);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, []));
  // Re-run when the user switches programs from Home.
  useEffect(() => { load(); }, [activeProgramId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!programId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🏅</Text>
        <Text style={styles.emptyTitle}>No Leaderboard</Text>
        <Text style={styles.emptyText}>Join a program to see the leaderboard</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={c.primary}
          colors={[c.primary]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Ranked by total habits completed</Text>
      </View>

      {/* Column header */}
      <View style={styles.colHeader}>
        <Text style={[styles.colHeaderText, { width: 36 }]}>#</Text>
        <Text style={[styles.colHeaderText, { flex: 1, marginLeft: 44, textAlign: 'left' }]}>Name</Text>
        <Text style={[styles.colHeaderText, { width: 52 }]}>Month</Text>
        <Text style={[styles.colHeaderText, { width: 52 }]}>Year</Text>
        <Text style={[styles.colHeaderText, { width: 52 }]}>Pts</Text>
      </View>

      {leaderboard.map((entry) => (
        <LeaderboardRow
          key={entry.user_id}
          entry={entry}
          isCurrentUser={entry.user_id === user?.id}
        />
      ))}

      {leaderboard.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No participants yet. Invite your group!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: space.lg, paddingBottom: space.huge },
  header: { marginBottom: space.lg },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: c.text2,
    marginTop: space.xs,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  colHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.text3,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  empty: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxxl,
  },
  emptyEmoji: { fontSize: 64, marginBottom: space.lg },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    marginBottom: space.sm,
  },
  emptyText: {
    fontSize: 14,
    color: c.text2,
    textAlign: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: space.huge },
});
