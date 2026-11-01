import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { OptionsSheet, type SheetOption } from '@/components/OptionsSheet';
import { Button, Card, IconButton, Ionicons, Row, T } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { previousSets } from '@/features/exercises/data';
import { usePicker } from '@/store/picker';
import { colors, space, supersetColors } from '@/theme';
import { formatDuration } from '@/utils/units';
import type { DraftExercise, DraftSet } from '../draft';
import * as ops from '../ops';
import { SET_TYPE_STYLE, SetHeader, SetRow } from './SetRow';

export type EditorMode = 'log' | 'edit' | 'routine';
type Updater = (fn: (list: DraftExercise[]) => DraftExercise[]) => void;

type Props = {
  exercises: DraftExercise[];
  update: Updater;
  mode: EditorMode;
  userId: string;
  restDefault: number;
  excludeWorkoutId?: string;
  /** called after a set is ticked complete (live logging starts the rest timer here) */
  onSetCompleted?: (exercise: DraftExercise, set: DraftSet) => void;
};

const REST_CHOICES = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

type Sheet = { title: string; options: SheetOption[] } | null;

export function WorkoutEditor({ exercises, update, mode, userId, restDefault, excludeWorkoutId, onSetCompleted }: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const openPicker = usePicker((s) => s.open);

  const addExercises = () => {
    openPicker((picked) => update((l) => ops.addExercises(l, picked, restDefault)));
    router.push('/exercise/library?pick=1');
  };

  const exerciseMenu = (e: DraftExercise, index: number) => {
    const options: SheetOption[] = [];
    if (index > 0) options.push({ label: 'Move up', icon: 'arrow-up', onPress: () => update((l) => ops.moveExercise(l, e.id, -1)) });
    if (index < exercises.length - 1) options.push({ label: 'Move down', icon: 'arrow-down', onPress: () => update((l) => ops.moveExercise(l, e.id, 1)) });
    options.push({
      label: 'Replace exercise',
      icon: 'swap-horizontal',
      onPress: () => {
        openPicker(([p]) => p && update((l) => ops.replaceExercise(l, e.id, p)), false);
        router.push('/exercise/library?pick=1&single=1');
      },
    });
    if (e.supersetGroup != null) {
      options.push({ label: 'Remove from superset', icon: 'unlink', onPress: () => update((l) => ops.toggleSupersetWithNext(l, e.id)) });
    } else if (index < exercises.length - 1) {
      options.push({ label: 'Superset with next', icon: 'link', onPress: () => update((l) => ops.toggleSupersetWithNext(l, e.id)) });
    }
    if (mode !== 'edit') {
      options.push({
        label: `Rest timer (${e.restSeconds ? formatDuration(e.restSeconds) : 'off'})`,
        icon: 'timer-outline',
        onPress: () =>
          setSheet({
            title: 'Rest timer',
            options: REST_CHOICES.map((sec) => ({
              label: sec ? formatDuration(sec) : 'Off',
              onPress: () => update((l) => ops.patchExercise(l, e.id, { restSeconds: sec })),
            })),
          }),
      });
    }
    options.push({ label: 'Remove exercise', icon: 'trash-outline', destructive: true, onPress: () => update((l) => ops.removeExercise(l, e.id)) });
    setSheet({ title: e.name, options });
  };

  const setMenu = (e: DraftExercise, setId: string) => {
    const types = (['normal', 'warmup', 'drop', 'failure'] as const).map((t) => ({
      label: SET_TYPE_STYLE[t].label,
      onPress: () => update((l) => ops.patchSet(l, e.id, setId, { type: t })),
    }));
    const options: SheetOption[] = [...types];
    if (mode !== 'routine') {
      options.push({
        label: 'Set RPE',
        icon: 'speedometer-outline',
        onPress: () =>
          setSheet({
            title: 'Rate of perceived exertion',
            options: [null, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => ({
              label: r == null ? 'Clear' : `RPE ${r}`,
              onPress: () => update((l) => ops.patchSet(l, e.id, setId, { rpe: r })),
            })),
          }),
      });
    }
    options.push({ label: 'Delete set', icon: 'trash-outline', destructive: true, onPress: () => update((l) => ops.removeSet(l, e.id, setId)) });
    setSheet({ title: 'Set type', options });
  };

  return (
    <View style={{ gap: space.md }}>
      {exercises.map((e, i) => (
        <ExerciseCard
          key={e.id}
          exercise={e}
          index={i}
          mode={mode}
          userId={userId}
          excludeWorkoutId={excludeWorkoutId}
          update={update}
          onMenu={() => exerciseMenu(e, i)}
          onSetMenu={(setId) => setMenu(e, setId)}
          onSetCompleted={onSetCompleted}
        />
      ))}
      <Button title="Add Exercises" icon="add" variant="secondary" onPress={addExercises} />
      <OptionsSheet visible={!!sheet} title={sheet?.title} options={sheet?.options ?? []} onClose={() => setSheet(null)} />
    </View>
  );
}

type CardProps = {
  exercise: DraftExercise;
  index: number;
  mode: EditorMode;
  userId: string;
  excludeWorkoutId?: string;
  update: Updater;
  onMenu: () => void;
  onSetMenu: (setId: string) => void;
  onSetCompleted?: (exercise: DraftExercise, set: DraftSet) => void;
};

function ExerciseCard({ exercise: e, mode, userId, excludeWorkoutId, update, onMenu, onSetMenu, onSetCompleted }: CardProps) {
  const { data: prev } = useLiveQuery(() => previousSets(userId, e.exerciseId, excludeWorkoutId), [userId, e.exerciseId, excludeWorkoutId]);
  const showCheck = mode !== 'routine';

  const onChange = useCallback(
    (setId: string, patch: Partial<DraftSet>) => update((l) => ops.patchSet(l, e.id, setId, patch)),
    [update, e.id],
  );
  const onToggle = useCallback(
    (setId: string) => {
      // The live logger's updater (zustand) runs synchronously, so completedNow is set before it's read.
      let completedNow: DraftSet | undefined;
      update((l) => {
        const cur = ops.findSet(l, e.id, setId);
        if (!cur) return l;
        const prevMatch = prev?.[e.sets.findIndex((s) => s.id === setId)];
        // Ticking an empty set uses the previous session's values (or the placeholder).
        const fill: Partial<DraftSet> = !cur.completed && cur.weightKg == null && cur.reps == null && cur.durationS == null && cur.distanceM == null && prevMatch
          ? { weightKg: prevMatch.weight_kg, reps: prevMatch.reps, durationS: prevMatch.duration_s, distanceM: prevMatch.distance_m }
          : {};
        if (!cur.completed) completedNow = { ...cur, ...fill, completed: true };
        return ops.patchSet(l, e.id, setId, { ...fill, completed: !cur.completed });
      });
      if (completedNow) onSetCompleted?.(e, completedNow);
    },
    [update, e, prev, onSetCompleted],
  );

  let normalIndex = 0;
  const group = e.supersetGroup;
  return (
    <Card style={[{ padding: space.md, gap: space.sm }, group != null && { borderLeftWidth: 4, borderLeftColor: supersetColors[(group - 1) % supersetColors.length] }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/exercise/${e.exerciseId}`)} accessibilityRole="link">
          <T v="h3" color={colors.primary} numberOfLines={2}>{e.name}</T>
          {group != null && <T v="tiny" color={supersetColors[(group - 1) % supersetColors.length]}>SUPERSET</T>}
        </Pressable>
        <IconButton name="ellipsis-horizontal" label={`${e.name} options`} onPress={onMenu} />
      </Row>
      <TextInput
        value={e.notes}
        onChangeText={(t) => update((l) => ops.patchExercise(l, e.id, { notes: t }))}
        placeholder={mode === 'routine' ? 'Add routine notes here' : 'Add notes here...'}
        placeholderTextColor={colors.textMuted}
        style={s.notes}
        multiline
      />
      {mode !== 'edit' && (
        <Row gap={6}>
          <Ionicons name="timer-outline" size={16} color={colors.primary} />
          <T v="small" color={colors.primary}>Rest Timer: {e.restSeconds ? formatDuration(e.restSeconds) : 'OFF'}</T>
        </Row>
      )}
      <SetHeader exType={e.exType} showCheck={showCheck} />
      {e.sets.map((set, idx) => {
        if (set.type !== 'warmup') normalIndex++;
        return (
          <SetRow
            key={set.id}
            set={set}
            label={String(normalIndex)}
            exType={e.exType}
            previous={prev?.[idx]}
            showCheck={showCheck}
            onChange={onChange}
            onToggle={onToggle}
            onMenu={onSetMenu}
          />
        );
      })}
      <Button title="Add Set" icon="add" variant="secondary" small onPress={() => update((l) => ops.addSet(l, e.id))} />
    </Card>
  );
}

const s = StyleSheet.create({
  notes: { color: colors.textDim, fontSize: 14, paddingVertical: 2 },
});
