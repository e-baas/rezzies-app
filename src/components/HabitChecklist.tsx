// HabitChecklist — daily habit pills per V2 Mockup Doc.
// Completed state: whole-box teal fill, white check icon, no strikethrough,
// no shame. Press scales 0.97 with spring. Animated teal layer fades in
// underneath the row content for the completed transition.

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { HabitDefinition, DailyCheck } from '../types';
import { useHabitStore } from '../stores/habitStore';
import { c, radii, motion, text as textTokens, space } from '../theme/tokens';

interface Props {
  habits: HabitDefinition[];
  checks: DailyCheck[];
  participantId: string;
}

function CheckIcon() {
  return (
    <Svg viewBox="0 0 14 14" width={14} height={14}>
      <Path
        d="M2 7 L6 11 L12 3"
        stroke={c.secondary2}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface RowProps {
  habit: HabitDefinition;
  checked: boolean;
  onToggle: () => void;
}

function HabitRow({ habit, checked, onToggle }: RowProps) {
  const fill = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    fill.value = withSpring(checked ? 1 : 0, motion.ringFill);
  }, [checked]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.rowWrap, scaleStyle]}>
      <Pressable
        onPress={onToggle}
        onPressIn={() => { scale.value = withSpring(0.97, motion.press); }}
        onPressOut={() => { scale.value = withSpring(1, motion.press); }}
        style={styles.row}
      >
        {/* Animated teal fill layer */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.fillLayer, fillStyle]}
        />
        {/* Content */}
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <CheckIcon />}
        </View>
        <Text style={[styles.habitName, checked && styles.habitNameOn]}>
          {habit.emoji ? `${habit.emoji} ` : ''}{habit.name}
        </Text>
        <Text style={[styles.points, checked && styles.pointsOn]}>
          +{habit.points}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function HabitChecklist({ habits, checks, participantId }: Props) {
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const today = new Date().toISOString().split('T')[0];

  const checkedMap: Record<string, boolean> = {};
  checks.forEach((ch) => { checkedMap[ch.habit_id] = ch.checked; });

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

      {habits.map((habit) => (
        <HabitRow
          key={habit.id}
          habit={habit}
          checked={checkedMap[habit.id] || false}
          onToggle={() => toggleHabit(participantId, habit.id, today)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
    marginTop: space.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: c.secondary,
    fontVariant: ['tabular-nums'],
  },
  rowWrap: {
    marginBottom: 10,
    borderRadius: radii.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  fillLayer: {
    backgroundColor: c.secondary,
    borderRadius: radii.md,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.text3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  checkboxOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  habitName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  habitNameOn: {
    color: '#FFFFFF',
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text3,
    fontVariant: ['tabular-nums'],
  },
  pointsOn: {
    color: '#FFFFFF',
  },
});
