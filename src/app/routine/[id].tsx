import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Input, Loading, styles } from '@/components/ui';
import { emptyRoutine, loadRoutineDraft, saveRoutine } from '@/features/routines/data';
import type { DraftExercise, DraftRoutine } from '@/features/workout/draft';
import { WorkoutEditor } from '@/features/workout/components/WorkoutEditor';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { space } from '@/theme';

export default function RoutineEditor() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const userId = useUserId();
  const u = useUnits();
  const start = useStartWorkout();
  const [draft, setDraft] = useState<DraftRoutine | null>(() => (id === 'new' ? emptyRoutine(folder ?? null) : null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id !== 'new') loadRoutineDraft(id).then((r) => setDraft(r ?? emptyRoutine()));
  }, [id]);

  const update = useCallback((fn: (l: DraftExercise[]) => DraftExercise[]) => {
    setDirty(true);
    setDraft((d) => (d ? { ...d, exercises: fn(d.exercises) } : d));
  }, []);

  if (!draft) return <Loading />;

  const save = async (): Promise<boolean> => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Give your routine a name.');
      return false;
    }
    setSaving(true);
    try {
      await saveRoutine(userId, draft);
      setDirty(false);
      return true;
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: draft.isNew ? 'Create Routine' : 'Edit Routine',
          headerRight: () => <Button title="Save" small loading={saving} onPress={async () => (await save()) && router.back()} />,
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input label="Routine name" value={draft.name} onChangeText={(t) => (setDirty(true), setDraft({ ...draft, name: t }))} placeholder="e.g. Push Day" maxLength={60} />
          <Input label="Notes" value={draft.notes} onChangeText={(t) => (setDirty(true), setDraft({ ...draft, notes: t }))} placeholder="Optional" multiline />
          <WorkoutEditor exercises={draft.exercises} update={update} mode="routine" userId={userId} restDefault={u.restDefault} />
          {!draft.isNew && draft.exercises.length > 0 && (
            <Button
              title="Start Routine"
              variant="success"
              style={{ marginTop: space.md }}
              onPress={async () => {
                if (dirty && !(await save())) return;
                start(draft.id);
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
