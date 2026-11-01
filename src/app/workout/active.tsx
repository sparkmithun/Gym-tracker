import { router, Stack } from 'expo-router';
import { useCallback } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { Button, IconButton, Row, Stat, T, styles } from '@/components/ui';
import type { DraftExercise, DraftSet } from '@/features/workout/draft';
import { draftTotals } from '@/features/workout/draft';
import { RestTimerBar } from '@/features/workout/components/RestTimerBar';
import { WorkoutEditor } from '@/features/workout/components/WorkoutEditor';
import { useNow } from '@/hooks/useNow';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { useActiveWorkout } from '@/store/activeWorkout';
import { colors, space } from '@/theme';
import { formatDuration } from '@/utils/units';

function Elapsed({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  return <Stat label="Duration" value={formatDuration((now - Date.parse(startedAt)) / 1000)} />;
}

export default function ActiveWorkout() {
  const userId = useUserId();
  const u = useUnits();
  const workout = useActiveWorkout((s) => s.workout);
  const setExercises = useActiveWorkout((s) => s.setExercises);
  const patch = useActiveWorkout((s) => s.patch);
  const discard = useActiveWorkout((s) => s.discard);
  const startRest = useActiveWorkout((s) => s.startRest);
  const rest = useActiveWorkout((s) => s.rest);

  const onSetCompleted = useCallback((e: DraftExercise, _set: DraftSet) => {
    if (e.restSeconds > 0) startRest(e.restSeconds);
  }, [startRest]);

  if (!workout) {
    return (
      <View style={[styles.screen, { padding: space.xl, gap: space.md }]}>
        <T dim>No workout in progress.</T>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  const totals = draftTotals(workout.exercises);

  const finish = () => {
    const anyDone = workout.exercises.some((e) => e.sets.some((s) => s.completed));
    if (!anyDone) {
      return Alert.alert('No completed sets', 'Tick at least one set before finishing, or discard the workout.');
    }
    router.push('/workout/finish');
  };

  const confirmDiscard = () =>
    Alert.alert('Discard workout?', 'All sets logged in this workout will be lost.', [
      { text: 'Keep logging', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discard(); router.back(); } },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <IconButton name="chevron-down" label="Minimise workout" onPress={() => router.back()} color={colors.text} />,
          headerRight: () => (
            <Row gap={0}>
              <IconButton name="calculator-outline" label="Plate calculator" onPress={() => router.push('/plates')} />
              <Button title="Finish" small variant="success" onPress={finish} />
            </Row>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: rest ? 200 : 120 }]} keyboardShouldPersistTaps="handled">
          <TextInput
            value={workout.title}
            onChangeText={(t) => patch({ title: t })}
            style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}
            accessibilityLabel="Workout title"
          />
          <Row>
            <Elapsed startedAt={workout.startedAt} />
            <Stat label="Volume" value={u.volume(totals.volume)} />
            <Stat label="Sets" value={String(totals.sets)} />
          </Row>
          {workout.exercises.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
              <T v="h3">Get started</T>
              <T dim>Add an exercise to start your workout.</T>
            </View>
          )}
          <WorkoutEditor
            exercises={workout.exercises}
            update={setExercises}
            mode="log"
            userId={userId}
            restDefault={u.restDefault}
            excludeWorkoutId={workout.id}
            onSetCompleted={onSetCompleted}
          />
          <Button title="Discard Workout" variant="ghost" onPress={confirmDiscard} style={{ marginTop: space.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <RestTimerBar />
    </>
  );
}
