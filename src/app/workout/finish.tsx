import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Input, Row, Stat, T, styles } from '@/components/ui';
import type { Visibility } from '@/db/types';
import { loadRoutineDraft, saveRoutine } from '@/features/routines/data';
import { myPoints } from '@/features/social/local';
import { saveWorkout, workoutRecords } from '@/features/workout/data';
import { draftTotals, type DraftWorkout } from '@/features/workout/draft';
import { useNow } from '@/hooks/useNow';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { useActiveWorkout } from '@/store/activeWorkout';
import { PR_LABELS } from '@/utils/oneRepMax';
import { formatDurationShort } from '@/utils/units';
import { colors, space } from '@/theme';

/** Optionally write the logged values back into the routine the workout came from. */
async function offerRoutineUpdate(userId: string, w: DraftWorkout): Promise<void> {
  if (!w.routineId) return;
  const routine = await loadRoutineDraft(w.routineId);
  if (!routine) return;
  await new Promise<void>((resolve) =>
    Alert.alert('Update routine?', `Save these exercises and values to "${routine.name}"?`, [
      { text: 'Keep original', style: 'cancel', onPress: () => resolve() },
      {
        text: 'Update routine',
        onPress: async () => {
          const byId = new Map(routine.exercises.map((e) => [e.exerciseId, e]));
          await saveRoutine(userId, {
            ...routine,
            exercises: w.exercises.map((e) => {
              const existing = byId.get(e.exerciseId);
              const done = e.sets.filter((s) => s.completed);
              return {
                ...e,
                id: existing?.id ?? e.id,
                restSeconds: e.restSeconds,
                notes: existing?.notes ?? '',
                sets: (done.length ? done : e.sets).map((s, i) => ({ ...s, id: existing?.sets[i]?.id ?? s.id, completed: false, rpe: null })),
              };
            }),
          });
          resolve();
        },
      },
    ]),
  );
}

export default function FinishWorkout() {
  const userId = useUserId();
  const u = useUnits();
  const workout = useActiveWorkout((s) => s.workout);
  const patch = useActiveWorkout((s) => s.patch);
  const discard = useActiveWorkout((s) => s.discard);
  const [saving, setSaving] = useState(false);
  const now = useNow(1000);

  if (!workout) return null;
  const totals = draftTotals(workout.exercises);
  const duration = (now - Date.parse(workout.startedAt)) / 1000;

  const save = async () => {
    setSaving(true);
    try {
      // Incomplete sets are not saved; exercises with no completed sets are dropped.
      const cleaned: DraftWorkout = {
        ...workout,
        endedAt: new Date().toISOString(),
        exercises: workout.exercises
          .map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) }))
          .filter((e) => e.sets.length > 0),
      };
      const prs = await workoutRecords(userId, cleaned);
      const before = (await myPoints(userId)).summary;
      await saveWorkout(userId, cleaned);
      const after = (await myPoints(userId)).summary;
      await offerRoutineUpdate(userId, cleaned);
      discard();
      router.dismissAll();
      router.push(`/workout/${cleaned.id}`);
      // Difference in all-time points, so the daily cap and streak bonus are reflected.
      const earned = after.total - before.total;
      const lines = [
        after.streak > 0 ? `🔥 ${after.streak}-day streak${after.streak > before.streak ? ' — keep it going tomorrow!' : ''}` : '',
        prs.length ? `\n🏆 ${prs.reduce((n, p) => n + p.kinds.length, 0)} new personal records` : '',
        ...prs.map((p) => `${p.name}: ${p.kinds.map((k) => PR_LABELS[k]).join(', ')}`),
      ].filter(Boolean);
      if (earned > 0 || prs.length) {
        Alert.alert(earned > 0 ? `+${earned} points!` : 'Workout saved', lines.join('\n'));
      }
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input label="Title" value={workout.title} onChangeText={(t) => patch({ title: t })} maxLength={80} />
      <Card>
        <Row>
          <Stat label="Duration" value={formatDurationShort(duration)} />
          <Stat label="Volume" value={u.volume(totals.volume)} />
          <Stat label="Sets" value={String(totals.sets)} />
        </Row>
      </Card>
      <Input label="Notes" value={workout.notes} onChangeText={(t) => patch({ notes: t })} multiline placeholder="How did it go?" style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Visibility</T>
        <Row>
          {(['public', 'followers', 'private'] as Visibility[]).map((v) => (
            <Chip key={v} label={v[0].toUpperCase() + v.slice(1)} active={workout.visibility === v} onPress={() => patch({ visibility: v })} />
          ))}
        </Row>
        <T v="tiny" muted>Used by the social feed (coming soon). Your data is always private to you today.</T>
      </View>
      <Button title="Save Workout" variant="success" onPress={save} loading={saving} />
      <T v="small" color={colors.textMuted} style={{ textAlign: 'center' }}>Unticked sets will not be saved.</T>
    </ScrollView>
  );
}
