import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  points?: number;
}

export function ProgressRing({
  completed,
  total,
  size = 160,
  strokeWidth = 12,
  color = '#6366F1',
  points,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const progress = circumference * (1 - pct);
  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
        <Text style={styles.label}>
          {completed}/{total}
        </Text>
        {points !== undefined && (
          <Text style={styles.points}>{points} pts</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  pct: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  points: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 4,
  },
});
