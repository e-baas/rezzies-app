// ProgressRing — 5-segment animated ring per V2 Mockup Doc (cmq4pc61f0023s6012xi1uoh9).
// Visually distinct from Apple Fitness (continuous arc) and Strava — five rounded
// arc segments separated by 10° gaps; completed segments fill with orange
// (`primary`, post-checkpoint TYC-137) and pop in 80ms-staggered springs.
// Aggregate-progress semantic: ring + streak + monthly bonus all in orange;
// teal stays as per-row / per-tab secondary signal.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { c, ring as ringTokens, motion, text as textTokens } from '../theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  points?: number;
  showPoints?: boolean;
}

// Polar -> Cartesian, where 0° is 12 o'clock (top) and angle increases clockwise.
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

interface SegmentProps {
  d: string;
  stroke: string;
  strokeWidth: number;
  on: boolean;
  delay: number;
}

function AnimatedSegment({ d, stroke, strokeWidth, on, delay }: SegmentProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(on ? 1 : 0, motion.ringFill));
  }, [on, delay]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: progress.value,
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

export function ProgressRing({
  completed,
  total,
  size = ringTokens.size,
  strokeWidth = ringTokens.stroke,
  points,
  showPoints = true,
}: Props) {
  const segments = total > 0 ? total : ringTokens.segments;
  const gapDeg = ringTokens.gapDeg;
  const segDeg = (360 - gapDeg * segments) / segments;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2 - 2;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const segs = [];
  for (let i = 0; i < segments; i++) {
    const startDeg = i * (segDeg + gapDeg) + gapDeg / 2;
    const endDeg = startDeg + segDeg;
    segs.push({
      d: arcPath(cx, cy, r, startDeg, endDeg),
      on: i < completed,
    });
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track segments */}
        {segs.map((seg, i) => (
          <Path
            key={`track-${i}`}
            d={seg.d}
            stroke={ringTokens.trackColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {/* Fill segments — animated */}
        {segs.map((seg, i) => (
          <AnimatedSegment
            key={`fill-${i}`}
            d={seg.d}
            stroke={ringTokens.fillColor}
            strokeWidth={strokeWidth}
            on={seg.on}
            delay={i * 80}
          />
        ))}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.label}>
          {completed}/{total}
        </Text>
        {showPoints && points !== undefined && (
          <Text style={styles.points}>+{points} pts</Text>
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
    inset: 0 as any,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  pct: {
    fontSize: 40,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...textTokens.caption,
    color: c.text2,
    marginTop: 2,
  },
  points: {
    fontSize: 17,
    fontWeight: '700',
    color: c.primary, // orange — aligns with ring fill (aggregate-progress signal)
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
});
