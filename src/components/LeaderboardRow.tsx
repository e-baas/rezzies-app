import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LeaderboardEntry } from '../types';

interface Props {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardRow({ entry, isCurrentUser }: Props) {
  return (
    <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
      <View style={styles.rankCol}>
        <Text style={styles.rankText}>
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
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  rowHighlight: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  rankCol: {
    width: 36,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4B5563',
  },
  nameCol: {
    flex: 1,
    marginLeft: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  nameHighlight: {
    color: '#4338CA',
  },
  streak: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  statCol: {
    width: 52,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
