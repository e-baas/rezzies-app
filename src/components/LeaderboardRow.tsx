import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LeaderboardEntry } from '../types';
import { c, radii, space } from '../theme/tokens';

// Visual polish v2 (TYC-137):
// - Row card on c.surface + c.border (no more white-on-light)
// - Current-user self-row highlighted with teal-soft (matches home
//   row-fill teal — consistent completion/self-state semantic)
// - Streak text in orange (c.primary): streak IS aggregate progress
// - Stat values tabular-nums so columns visually align across rows
// - Style spec doc cmpze514302chs6013gkajwqr §4

interface Props {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardRow({ entry, isCurrentUser }: Props) {
  const numericRank = !rankEmojis[entry.rank];
  return (
    <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
      <View style={styles.rankCol}>
        <Text
          style={[
            styles.rankText,
            numericRank && styles.rankNumeric,
          ]}
        >
          {rankEmojis[entry.rank] || entry.rank}
        </Text>
      </View>

      <View style={styles.nameCol}>
        <Text style={[styles.name, isCurrentUser && styles.nameHighlight]}>
          {entry.display_name}
        </Text>
        {entry.current_streak > 0 && (
          <Text style={styles.streak}>
            🔥 {entry.current_streak} day streak
          </Text>
        )}
      </View>

      <View style={styles.statCol}>
        <Text style={styles.statValue}>{entry.habits_month}</Text>
        <Text style={styles.statLabel}>Month</Text>
      </View>

      <View style={styles.statCol}>
        <Text style={styles.statValue}>{entry.habits_year}</Text>
        <Text style={styles.statLabel}>Year</Text>
      </View>

      <View style={styles.statCol}>
        <Text style={styles.statValue}>{entry.total_points}</Text>
        <Text style={styles.statLabel}>Pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: space.md,
    marginBottom: 6,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  rowHighlight: {
    backgroundColor: c.secondarySoft,
    borderColor: c.secondary,
  },
  rankCol: {
    width: 36,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
  },
  rankNumeric: {
    color: c.text2,
    fontVariant: ['tabular-nums'],
  },
  nameCol: {
    flex: 1,
    marginLeft: space.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  nameHighlight: {
    color: c.secondary,
  },
  streak: {
    fontSize: 12,
    color: c.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  statCol: {
    width: 52,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: c.text3,
    textTransform: 'uppercase',
    marginTop: 1,
    letterSpacing: 0.4,
  },
});
