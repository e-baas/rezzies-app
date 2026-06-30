import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useProgramStore } from '../../src/stores/programStore';
import { useHabitStore } from '../../src/stores/habitStore';
import { ProgressRing } from '../../src/components/ProgressRing';
import { HabitChecklist } from '../../src/components/HabitChecklist';
import { BonusProgressList } from '../../src/components/BonusProgress';
import { ProgramSwitcher } from '../../src/components/ProgramSwitcher';
import { supabase } from '../../src/lib/supabase';
import { calculateDailyPoints } from '../../src/engine/scoring';
import { localDateString, addLocalDays, formatDayLabel } from '../../src/lib/dates';
import { c, radii, space } from '../../src/theme/tokens';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { habits, monthlyBonuses, loadHabits, loadBonuses, currentProgram, loadProgram } = useProgramStore();
  const memberships = useProgramStore((s) => s.memberships);
  const activeProgramId = useProgramStore((s) => s.activeProgramId);
  const loadMyPrograms = useProgramStore((s) => s.loadMyPrograms);
  const { todayChecks, bonusProgress, loadTodayChecks, loadBonusProgress } = useHabitStore();
  const [programId, setProgramId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakLongest, setStreakLongest] = useState(0);
  const [monthPoints, setMonthPoints] = useState(0);
  const [groupRank, setGroupRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false); // bug #17
  // Bug #20: the day currently being viewed/edited (YYYY-MM-DD). Defaults to
  // today; the user can step back to adjust a day they forgot to log.
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateString());
  const todayStr = localDateString();
  const isToday = selectedDate === todayStr;
  const goPrevDay = () => setSelectedDate((d) => addLocalDays(d, -1));
  const goNextDay = () => setSelectedDate((d) => (d >= todayStr ? d : addLocalDays(d, 1)));
  const jumpToToday = () => setSelectedDate(todayStr);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Bug #17: a user can belong to multiple programs. Resolve the membership
    // list, then operate on the user's chosen ACTIVE program (persisted) rather
    // than always grabbing the most-recent join.
    const mems = await loadMyPrograms();
    const active = useProgramStore.getState().activeProgramId;
    const membership = mems.find((m) => m.programId === active) || mems[0];

    if (!membership) {
      setProgramId(null);
      setParticipantId(null);
      return;
    }
    setProgramId(membership.programId);
    setParticipantId(membership.participantId);

    const { data: participant } = await supabase
      .from('participants')
      .select('id, current_streak, streak_longest, total_points')
      .eq('id', membership.participantId)
      .single();
    if (participant) {
      setStreak(participant.current_streak || 0);
      setStreakLongest(participant.streak_longest || 0);
      setMonthPoints(participant.total_points || 0);
    }

    await Promise.all([
      loadProgram(membership.programId),
      loadHabits(membership.programId),
      loadBonuses(membership.programId),
    ]);

    // Best-effort group rank: rank among participants in the same program by total_points desc.
    try {
      const { data: peers } = await supabase
        .from('participants')
        .select('id, total_points')
        .eq('program_id', membership.programId)
        .order('total_points', { ascending: false });
      if (peers) {
        const idx = peers.findIndex((p: any) => p.id === membership.participantId);
        setGroupRank(idx >= 0 ? idx + 1 : null);
      }
    } catch {
      // Rank is decorative; failures are silent.
    }
  }, [user]);

  // Re-run when the user switches programs (activeProgramId changes).
  useEffect(() => { loadData(); }, [loadData, activeProgramId]);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Reload the checklist whenever the participant, habit set, or the selected
  // day changes (bug #20 — stepping to a previous day loads that day's checks).
  useEffect(() => {
    if (participantId && habits.length > 0) {
      loadTodayChecks(participantId, habits.map((h) => h.id), selectedDate);
      loadBonusProgress(participantId, monthlyBonuses.map((b) => b.id));
    }
  }, [participantId, habits.length, monthlyBonuses.length, selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (participantId && habits.length > 0) {
      await loadTodayChecks(participantId, habits.map((h) => h.id), selectedDate);
    }
    setRefreshing(false);
  };

  const checkedCount = todayChecks.filter((ck) => ck.checked).length;
  const totalHabits = habits.length;
  const dailyPoints = calculateDailyPoints(
    todayChecks.filter((ck) => ck.checked).map((ck) => ck.habit_id),
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.secondary} />
      }
    >
      {/* Program name + streak pill. Tapping the name opens the switcher when
          the user belongs to more than one program (bug #17). */}
      <View style={styles.programHeader}>
        {currentProgram && (
          <TouchableOpacity
            style={styles.programNameWrap}
            activeOpacity={memberships.length > 1 ? 0.6 : 1}
            disabled={memberships.length <= 1}
            onPress={() => setSwitcherOpen(true)}
          >
            <Text style={styles.programName} numberOfLines={1}>{currentProgram.name}</Text>
            {memberships.length > 1 && <Text style={styles.programChevron}> ⌄</Text>}
          </TouchableOpacity>
        )}
        <View style={styles.streakPill}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
        </View>
      </View>

      <ProgramSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      {/* Day selector (bug #20) — step back to a previous day to adjust
          reporting. The ring + checklist below reflect the selected day; you
          can't go past today. Tap the date to jump back to today. */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          onPress={goPrevDay}
          style={styles.dateArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateLabelWrap}
          onPress={jumpToToday}
          disabled={isToday}
          activeOpacity={0.7}
        >
          <Text style={styles.dateLabel}>{formatDayLabel(selectedDate)}</Text>
          {!isToday && <Text style={styles.dateSub}>Tap to return to today</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goNextDay}
          style={styles.dateArrow}
          disabled={isToday}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.dateArrowText, isToday && styles.dateArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Ring card */}
      <View style={styles.ringCard}>
        <ProgressRing
          completed={checkedCount}
          total={totalHabits}
          points={dailyPoints.points}
        />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>+{dailyPoints.points}</Text>
            <Text style={styles.statLabel}>{isToday ? 'today' : 'that day'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{monthPoints.toLocaleString()}</Text>
            <Text style={styles.statLabel}>this month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {groupRank !== null ? `#${groupRank}` : '—'}
            </Text>
            <Text style={styles.statLabel}>group rank</Text>
          </View>
        </View>
      </View>

      {/* Daily habits — scoped to the selected day (bug #20) */}
      <HabitChecklist
        habits={habits}
        checks={todayChecks}
        participantId={participantId!}
        date={selectedDate}
        dayLabel={formatDayLabel(selectedDate)}
      />

      <View style={styles.divider} />

      {/* Monthly bonus */}
      <BonusProgressList
        bonuses={monthlyBonuses}
        progress={bonusProgress}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: 40 },
  programHeader: {
    paddingHorizontal: space.lg,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  programNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  programName: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  programChevron: {
    fontSize: 17,
    fontWeight: '800',
    color: c.text2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primary,
  },
  streakEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  streakNum: {
    fontSize: 14,
    fontWeight: '800',
    color: c.primary,
    fontVariant: ['tabular-nums'],
  },
  // Day selector (bug #20)
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space.lg,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  dateArrow: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowText: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    lineHeight: 28,
  },
  dateArrowDisabled: {
    color: c.text3,
    opacity: 0.4,
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  dateSub: {
    fontSize: 11,
    color: c.primary,
    marginTop: 1,
    fontWeight: '600',
  },
  ringCard: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: 24,
    paddingBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 28,
    paddingHorizontal: space.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    color: c.text3,
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: c.border,
  },
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: 16,
    marginHorizontal: space.lg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: c.text2, textAlign: 'center', marginBottom: 24 },
  ctaButton: {
    backgroundColor: c.primary,
    borderRadius: radii.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
  },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  ctaOutline: {
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: radii.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  ctaOutlineText: { color: c.primary, fontSize: 16, fontWeight: '600' },
});
