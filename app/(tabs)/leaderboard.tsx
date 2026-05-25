import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useHabitStore } from '../../src/stores/habitStore';
import { LeaderboardRow } from '../../src/components/LeaderboardRow';
import { supabase } from '../../src/lib/supabase';

export default function LeaderboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { leaderboard, loading, loadLeaderboard } = useHabitStore();
  const [programId, setProgramId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: participant } = await supabase
      .from('participants')
      .select('program_id')
      .eq('user_id', user.id)
      .single();
    if (participant) {
      setProgramId(participant.program_id);
      await loadLeaderboard(participant.program_id);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, []));

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Ranked by total habits completed</Text>
      </View>

      {/* Column header */}
      <View style={styles.colHeader}>
        <Text style={[styles.colHeaderText, { width: 36 }]}>#</Text>
        <Text style={[styles.colHeaderText, { flex: 1, marginLeft: 44 }]}>Name</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  colHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 4,
  },
  colHeaderText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'center' },
  empty: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
});
