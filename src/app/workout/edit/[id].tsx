import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Input, Loading, styles } from '@/components/ui';
import { loadWorkoutDraft, saveWorkout } from '@/features/workout/data';
import type { DraftExercise, DraftWorkout } from '@/features/workout/draft';
import { WorkoutEditor } from '@/features/workout/components/WorkoutEditor';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';

export default function EditWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const u = useUnits();
  const [draft, setDraft] = useState<DraftWorkout | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkoutDraft(id).then(setDraft);
  }, [id]);

  const update = useCallback(
    (fn: (l: DraftExercise[]) => DraftExercise[]) => setDraft((d) => (d ? { ...d, exercises: fn(d.exercises) } : d)),
    [],
  );

  if (!draft) return <Loading />;

  const save = async () => {
    setSaving(true);
    try {
      await saveWorkout(userId, draft);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <Button title="Save" small onPress={save} loading={saving} /> }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} />
          <Input label="Notes" value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} multiline />
          <WorkoutEditor exercises={draft.exercises} update={update} mode="edit" userId={userId} restDefault={u.restDefault} excludeWorkoutId={draft.id} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
