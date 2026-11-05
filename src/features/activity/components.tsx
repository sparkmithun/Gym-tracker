import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { T } from '@/components/ui';
import { colors } from '@/theme';

/** Circular progress, e.g. steps toward the daily goal. */
export function Ring({ value, goal, size = 120, stroke = 12, children }: { value: number; goal: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const done = goal > 0 && value >= goal;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={done ? colors.success : colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Thin horizontal progress bar. */
export function Meter({ value, max, color = colors.primary }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: value > max ? colors.danger : color }} />
    </View>
  );
}

export function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T v="h3" color={color}>{Math.round(grams)}g</T>
      <T v="tiny" muted>{label.toUpperCase()}</T>
    </View>
  );
}
