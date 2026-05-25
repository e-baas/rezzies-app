import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MonthlyBonus, BonusProgress as BonusProgressType } from '../types';

interface Props {
  bonuses: MonthlyBonus[];
  progress: BonusProgressType[];
}

export function BonusProgressList({ bonuses, progress }: Props) {
  const progressMap: Record<string, BonusProgressType> = {};
  progress.forEach((p) => { progressMap[p.bonus_id] = p; });

  // Show only current month's bonus
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // For simplicity, show the bonus matching the current month index
  const currentBonus = bonuses[currentMonth];
  if (!currentBonus) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Monthly Bonus</Text>
        <Text style={styles.empty}>No bonus challenge this month</Text>
      </View>
    );
  }

  const bp = progressMap[currentBonus.id];
  const current = bp?.current || 0;
  const pct = Math.min(1, current / currentBonus.target);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Bonus</Text>
      <View style={styles.card}>
        <Text style={styles.bonusName}>{currentBonus.name}</Text>
        <Text style={styles.bonusDesc}>{currentBonus.description}</Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>

        <View style={styles.stats}>
          <Text style={styles.statValue}>
            {current} / {currentBonus.target} {currentBonus.unit}
          </Text>
          <Text style={styles.statAward}>
            {bp?.completed ? '✓ Completed! ' : ''}+{currentBonus.award} pts
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bonusName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  bonusDesc: {
    fontSize: 13,
    color: '#A16207',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  statAward: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
  },
});
