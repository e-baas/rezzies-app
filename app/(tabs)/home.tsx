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
  const { habits, monthlyBonuses, loadHabits, loadBonuses, currentProgram, loadProgram } = useProgramStore();
  const { todayChecks, bonusProgress, loadTodayChecks, loadBonusProgress } = useHabitStore();
  const [programId, setProgramId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakLongest, setStreakLongest] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: participant } = await supabase
      .from('participants')
      .select('id, program_id, current_streak, streak_longest')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single();

    if (!participant) return;
    setProgramId(participant.program_id);
    setParticipantId(participant.id);
    setStreak(participant.current_streak || 0);
    setStreakLongest(participant.streak_longest || 0);

    await Promise.all([
      loadProgram(participant.program_id),
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
    // Refetch streak
    if (participantId) {
      const { data: p } = await supabase
        .from('participants')
        .select('current_streak, streak_longest')
        .eq('id', participantId)
        .single();
      if (p) {
        setStreak(p.current_streak || 0);
        setStreakLongest(p.streak_longest || 0);
      }
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
      {/* Program name + Streak header */}
      <View style={styles.header}>
        {currentProgram && (
          <Text style={styles.programName}>{currentProgram.name}</Text>
        )}
        <View style={styles.streakRow}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak} day streak</Text>
          </View>
          {streakLongest > streak && (
            <Text style={styles.streakBest}>Best: {streakLongest} days</Text>
          )}
        </View>
      </View>

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
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  programName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  streakBest: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
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
