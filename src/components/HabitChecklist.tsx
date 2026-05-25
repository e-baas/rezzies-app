import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { HabitDefinition, DailyCheck } from '../types';
import { useHabitStore } from '../stores/habitStore';

interface Props {
  habits: HabitDefinition[];
  checks: DailyCheck[];
  participantId: string;
}

export function HabitChecklist({ habits, checks, participantId }: Props) {
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const today = new Date().toISOString().split('T')[0];

  const checkedMap: Record<string, boolean> = {};
  checks.forEach((c) => { checkedMap[c.habit_id] = c.checked; });

  const checkedCount = habits.filter((h) => checkedMap[h.id]).length;
  const totalPoints = habits
    .filter((h) => checkedMap[h.id])
    .reduce((sum, h) => sum + h.points, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Habits</Text>
        <Text style={styles.subtitle}>
          {checkedCount}/{habits.length} · {totalPoints} pts
        </Text>
      </View>

      {habits.map((habit) => {
        const checked = checkedMap[habit.id] || false;
        return (
          <TouchableOpacity
            key={habit.id}
            style={[styles.row, checked && styles.rowChecked]}
            onPress={() => toggleHabit(participantId, habit.id, today)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.habitInfo}>
              <Text style={styles.habitName}>
                {habit.emoji ? `${habit.emoji} ` : ''}{habit.name}
              </Text>
            </View>
            <Text style={[styles.points, checked && styles.pointsChecked]}>
              +{habit.points}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  rowChecked: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  points: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pointsChecked: {
    color: '#6366F1',
  },
});
