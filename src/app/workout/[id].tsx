import { format } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { OptionsSheet } from '@/components/OptionsSheet';
import { Card, IconButton, Ionicons, Loading, Row, Stat, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { TYPE_FIELDS } from '@/db/types';
import { deleteWorkout, loadWorkoutDraft, workoutRecords } from '@/features/workout/data';
import { draftTotals } from '@/features/workout/draft';
import { SET_TYPE_STYLE } from '@/features/workout/components/SetRow';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useActiveWorkout } from '@/store/activeWorkout';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space, supersetColors } from '@/theme';
import { PR_LABELS } from '@/utils/oneRepMax';
import { formatDuration, formatDurationShort } from '@/utils/units';
import { cloneWithNewIds } from '@/features/workout/ops';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const u = useUnits();
  const start = useActiveWorkout((s) => s.start);
  const startGuarded = useStartWorkout();
  const [menu, setMenu] = useState(false);
  const { data } = useLiveQuery(async () => {
    const w = await loadWorkoutDraft(id);
    return w ? { w, prs: await workoutRecords(userId, w) } : null;
  }, [id, userId]);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return <View style={[styles.screen, { padding: space.xl }]}><T dim>This workout was deleted.</T></View>;
  }
  const { w, prs } = data;
  const totals = draftTotals(w.exercises);
  const prByExercise = new Map(prs.map((p) => [p.exerciseId, p.kinds]));

  const repeat = () => {
    if (useActiveWorkout.getState().workout) return startGuarded(); // shows the in-progress dialog
    start({
      title: w.title,
      routineId: w.routineId,
      exercises: cloneWithNewIds(w.exercises).map((e) => ({ ...e, restSeconds: u.restDefault })),
    });
    router.push('/workout/active');
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <IconButton name="ellipsis-horizontal" label="Workout options" onPress={() => setMenu(true)} /> }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <T v="h2">{w.title}</T>
        <T dim>{format(new Date(w.startedAt), "EEEE, d MMMM yyyy 'at' HH:mm")}</T>
        <Card>
          <Row>
            <Stat label="Duration" value={w.endedAt ? formatDurationShort((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 1000) : '-'} />
            <Stat label="Volume" value={u.volume(totals.volume)} />
            <Stat label="Sets" value={String(totals.sets)} />
            <Stat label="PRs" value={`🏆 ${prs.reduce((n, p) => n + p.kinds.length, 0)}`} />
          </Row>
        </Card>
        {w.notes ? <T dim>{w.notes}</T> : null}

        {w.exercises.map((e) => {
          const f = TYPE_FIELDS[e.exType];
          const kinds = prByExercise.get(e.exerciseId);
          let n = 0;
          return (
            <Card key={e.id} style={[{ gap: space.sm }, e.supersetGroup != null && { borderLeftWidth: 4, borderLeftColor: supersetColors[(e.supersetGroup - 1) % supersetColors.length] }]}>
              <Pressable onPress={() => router.push(`/exercise/${e.exerciseId}`)}>
                <T v="h3" color={colors.primary}>{e.name}</T>
              </Pressable>
              {e.notes ? <T v="small" dim>{e.notes}</T> : null}
              {e.sets.map((s) => {
                if (s.type !== 'warmup') n++;
                const t = SET_TYPE_STYLE[s.type];
                const parts = [
                  f.weight && s.weightKg != null ? u.wu(s.weightKg) : null,
                  f.reps && s.reps != null ? `${f.weight ? '× ' : ''}${s.reps} reps` : null,
                  f.distance && s.distanceM != null ? u.du(s.distanceM) : null,
                  f.duration && s.durationS != null ? formatDuration(s.durationS) : null,
                  s.rpe != null ? `@ RPE ${s.rpe}` : null,
                ].filter(Boolean);
                return (
                  <Row key={s.id}>
                    <T v="h3" color={t.color} style={{ width: 28, textAlign: 'center' }}>{t.short || n}</T>
                    <T>{parts.join(' ')}</T>
                  </Row>
                );
              })}
              {kinds && (
                <Row style={{ flexWrap: 'wrap' }}>
                  <Ionicons name="trophy" size={14} color={colors.gold} />
                  <T v="small" color={colors.gold}>{kinds.map((k) => PR_LABELS[k]).join(' · ')}</T>
                </Row>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <OptionsSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={w.title}
        options={[
          { label: 'Repeat this workout', icon: 'repeat', onPress: repeat },
          { label: 'Edit workout', icon: 'create-outline', onPress: () => router.push(`/workout/edit/${w.id}`) },
          {
            label: 'Delete workout',
            icon: 'trash-outline',
            destructive: true,
            onPress: () =>
              Alert.alert('Delete workout?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWorkout(w.id); router.back(); } },
              ]),
          },
        ]}
      />
    </>
  );
}
