import * as Haptics from 'expo-haptics';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, T } from '@/components/ui';
import { TYPE_FIELDS, type ExerciseType } from '@/db/types';
import type { HistorySet } from '@/features/exercises/data';
import { useUnits } from '@/hooks/useUnits';
import { colors, radius, space } from '@/theme';
import {
  formatDuration,
  fromDisplayDistance,
  fromDisplayWeight,
  parseDuration,
  parseNumber,
  toDisplayDistance,
  toDisplayWeight,
} from '@/utils/units';
import type { DraftSet } from '../draft';
import { NumberField } from './NumberField';

export const SET_TYPE_STYLE = {
  warmup: { short: 'W', color: colors.warmup, label: 'Warm-up' },
  drop: { short: 'D', color: colors.drop, label: 'Drop set' },
  failure: { short: 'F', color: colors.failure, label: 'Failure' },
  normal: { short: '', color: colors.text, label: 'Normal' },
} as const;

export function previousText(p: HistorySet | undefined, exType: ExerciseType, u: ReturnType<typeof useUnits>): string {
  if (!p) return '—';
  const f = TYPE_FIELDS[exType];
  const parts: string[] = [];
  if (f.weight && p.weight_kg != null) parts.push(u.wu(p.weight_kg));
  if (f.reps && p.reps != null) parts.push(`${f.weight ? '× ' : ''}${p.reps}`);
  if (f.distance && p.distance_m != null) parts.push(u.du(p.distance_m));
  if (f.duration && p.duration_s != null) parts.push(formatDuration(p.duration_s));
  return parts.join(' ') || '—';
}

type Props = {
  set: DraftSet;
  label: string;
  exType: ExerciseType;
  previous?: HistorySet;
  showCheck: boolean;
  onChange: (setId: string, patch: Partial<DraftSet>) => void;
  onToggle?: (setId: string) => void;
  onMenu: (setId: string) => void;
};

export const SetRow = memo(function SetRow({ set, label, exType, previous, showCheck, onChange, onToggle, onMenu }: Props) {
  const u = useUnits();
  const f = TYPE_FIELDS[exType];
  const typeStyle = SET_TYPE_STYLE[set.type];

  const weightToText = useCallback((kg: number) => String(toDisplayWeight(kg, u.weight)), [u.weight]);
  const weightFromText = useCallback((t: string) => {
    const n = parseNumber(t);
    return n === undefined ? undefined : fromDisplayWeight(n, u.weight);
  }, [u.weight]);
  const distToText = useCallback((m: number) => String(toDisplayDistance(m, u.distance)), [u.distance]);
  const distFromText = useCallback((t: string) => {
    const n = parseNumber(t);
    return n === undefined ? undefined : fromDisplayDistance(n, u.distance);
  }, [u.distance]);
  const repsFromText = useCallback((t: string) => {
    const n = parseNumber(t);
    return n === undefined ? undefined : Math.round(n);
  }, []);

  const fillFromPrevious = () => {
    if (!previous) return;
    onChange(set.id, {
      weightKg: previous.weight_kg,
      reps: previous.reps,
      durationS: previous.duration_s,
      distanceM: previous.distance_m,
    });
  };

  return (
    <View style={[s.row, set.completed && showCheck && s.rowDone]}>
      <Pressable onPress={() => onMenu(set.id)} style={s.setCol} accessibilityLabel={`Set ${label} options`} hitSlop={6}>
        <T v="h3" color={typeStyle.color}>{typeStyle.short || label}</T>
        {set.rpe != null && <T v="tiny" muted>@{set.rpe}</T>}
      </Pressable>
      <Pressable onPress={fillFromPrevious} style={s.prevCol} accessibilityLabel="Copy previous values">
        <T v="small" muted numberOfLines={1}>{previousText(previous, exType, u)}</T>
      </Pressable>
      {f.weight && (
        <NumberField label="Weight" value={set.weightKg} toText={weightToText} fromText={weightFromText}
          placeholder={previous?.weight_kg != null ? weightToText(previous.weight_kg) : '0'}
          completed={set.completed && showCheck} onChange={(v) => onChange(set.id, { weightKg: v })} />
      )}
      {f.reps && (
        <NumberField label="Reps" value={set.reps} toText={String} fromText={repsFromText} keyboard="number-pad"
          placeholder={previous?.reps != null ? String(previous.reps) : '0'}
          completed={set.completed && showCheck} onChange={(v) => onChange(set.id, { reps: v })} />
      )}
      {f.distance && (
        <NumberField label="Distance" value={set.distanceM} toText={distToText} fromText={distFromText}
          placeholder={previous?.distance_m != null ? distToText(previous.distance_m) : '0'}
          completed={set.completed && showCheck} onChange={(v) => onChange(set.id, { distanceM: v })} />
      )}
      {f.duration && (
        <NumberField label="Duration" value={set.durationS} toText={formatDuration} fromText={parseDuration}
          keyboard="numbers-and-punctuation"
          placeholder={previous?.duration_s != null ? formatDuration(previous.duration_s) : '0:00'}
          completed={set.completed && showCheck} onChange={(v) => onChange(set.id, { durationS: v })} />
      )}
      {showCheck && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={`Complete set ${label}`}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(set.completed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
            onToggle?.(set.id);
          }}
          style={[s.check, set.completed && s.checkDone]}
        >
          <Ionicons name="checkmark" size={20} color={set.completed ? '#fff' : colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
});

export function SetHeader({ exType, showCheck }: { exType: ExerciseType; showCheck: boolean }) {
  const u = useUnits();
  const f = TYPE_FIELDS[exType];
  const weightLabel = exType === 'assisted_bodyweight' ? `-${u.weight}` : exType === 'weighted_bodyweight' ? `+${u.weight}` : u.weight;
  return (
    <View style={[s.row, { paddingVertical: 2 }]}>
      <T v="tiny" muted style={s.setCol}>SET</T>
      <T v="tiny" muted style={s.prevCol}>PREVIOUS</T>
      {f.weight && <T v="tiny" muted style={s.headerCell}>{weightLabel.toUpperCase()}</T>}
      {f.reps && <T v="tiny" muted style={s.headerCell}>REPS</T>}
      {f.distance && <T v="tiny" muted style={s.headerCell}>{u.distance.toUpperCase()}</T>}
      {f.duration && <T v="tiny" muted style={s.headerCell}>TIME</T>}
      {showCheck && <View style={{ width: 36, alignItems: 'center' }}><Ionicons name="checkmark" size={14} color={colors.textMuted} /></View>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4, paddingHorizontal: space.xs, borderRadius: radius.sm },
  rowDone: { backgroundColor: colors.successDim },
  setCol: { width: 30, alignItems: 'center', textAlign: 'center' },
  prevCol: { flex: 1.4, minWidth: 0 },
  headerCell: { flex: 1, textAlign: 'center' },
  check: { width: 36, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.success },
});
