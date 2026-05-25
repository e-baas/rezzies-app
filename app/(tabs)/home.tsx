import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useProgramStore } from '../../src/stores/programStore';
import { useHabitStore } from '../../src/stores/habitStore';
import { ProgressRing } from '../../src/components/ProgressRing';
import { HabitChecklist } from '../../src/components/HabitChecklist';
import { BonusProgressList } from '../../src/components/BonusProgress';
import { supabase } from '../../src/lib/supabase';
import { calculateDailyPoints } from '../../src/engine/scoring';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { habits, monthlyBonuses, loadHabits, loadBonuses } = useProgramStore();
  const { todayChecks, bonusProgress, loadTodayChecks, loadBonusProgress } = useHabitStore();
  const [programId, setProgramId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    // Get participant's program
    const { data: participant } = await supabase
      .from('participants')
      .select('id, program_id')
      .eq('user_id', user.id)
      .single();

    if (!participant) return;
    setProgramId(participant.program_id);
    setParticipantId(participant.id);

    await Promise.all([
      loadHabits(participant.program_id),
      loadBonuses(participant.program_id),
    ]);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    if (participantId && habits.length > 0) {
      loadTodayChecks(participantId, habits.map((h) => h.id));
      loadBonusProgress(participantId, monthlyBonuses.map((b) => b.id));
    }
  }, [participantId, habits.length, monthlyBonuses.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (participantId && habits.length > 0) {
      await loadTodayChecks(participantId, habits.map((h) => h.id));
    }
    setRefreshing(false);
  };

  const checkedCount = todayChecks.filter((c) => c.checked).length;
  const totalHabits = habits.length;
  const dailyPoints = calculateDailyPoints(
    todayChecks.filter((c) => c.checked).map((c) => c.habit_id),
    habits
  );

  // No program state
  if (!programId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🎯</Text>
        <Text style={styles.emptyTitle}>No Program Yet</Text>
        <Text style={styles.emptyText}>Create a program or join one to get started!</Text>
        <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/create-program')}>
          <Text style={styles.ctaText}>Create Program</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctaOutline} onPress={() => router.push('/join-program')}>
          <Text style={styles.ctaOutlineText}>Join Program</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Progress Ring */}
      <View style={styles.ringContainer}>
        <ProgressRing
          completed={checkedCount}
          total={totalHabits}
          color="#6366F1"
          points={dailyPoints.points}
        />
      </View>

      {/* Daily Habit Checklist */}
      <HabitChecklist
        habits={habits}
        checks={todayChecks}
        participantId={participantId!}
      />

      <View style={styles.divider} />

      {/* Monthly Bonus */}
      <BonusProgressList
        bonuses={monthlyBonuses}
        progress={bonusProgress}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  ringContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12, marginHorizontal: 16 },
  emptyContainer: {
    flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  ctaButton: {
    backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  ctaOutline: {
    borderWidth: 1, borderColor: '#6366F1', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14,
  },
  ctaOutlineText: { color: '#6366F1', fontSize: 16, fontWeight: '600' },
});
