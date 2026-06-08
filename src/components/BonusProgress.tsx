// BonusProgress — Monthly bonus card on dark, with orange progress fill.
// Replaces the legacy amber-on-light treatment.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MonthlyBonus, BonusProgress as BonusProgressType } from '../types';
import { c, radii, text as textTokens, space } from '../theme/tokens';

interface Props {
  bonuses: MonthlyBonus[];
  progress: BonusProgressType[];
}

export function BonusProgressList({ bonuses, progress }: Props) {
  const progressMap: Record<string, BonusProgressType> = {};
  progress.forEach((p) => { progressMap[p.bonus_id] = p; });

  const now = new Date();
  const currentMonth = now.getMonth();
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
  const completed = !!bp?.completed;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Bonus</Text>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.bonusName}>{currentBonus.name}</Text>
          {completed && <Text style={styles.completePill}>✓ Done</Text>}
        </View>
        <Text style={styles.bonusDesc}>{currentBonus.description}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>

        <View style={styles.stats}>
          <Text style={styles.statValue}>
            {current} / {currentBonus.target} {currentBonus.unit}
          </Text>
          <Text style={styles.statAward}>+{currentBonus.award} pts</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  empty: {
    fontSize: 14,
    color: c.text3,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bonusName: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  completePill: {
    color: c.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  bonusDesc: {
    fontSize: 13,
    color: c.text2,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: c.elev,
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.primary,
    borderRadius: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text2,
    fontVariant: ['tabular-nums'],
  },
  statAward: {
    fontSize: 14,
    fontWeight: '700',
    color: c.primary,
    fontVariant: ['tabular-nums'],
  },
});
