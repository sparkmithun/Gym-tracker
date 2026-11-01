import { router } from 'expo-router';
import { Alert } from 'react-native';
import { loadRoutineDraft } from '@/features/routines/data';
import { useActiveWorkout } from '@/store/activeWorkout';
import { cloneWithNewIds } from './ops';
import { setupNotifications } from './restTimer';

/** Start an empty workout or one from a routine, guarding against an in-progress one. */
export function useStartWorkout() {
  const startStore = useActiveWorkout((s) => s.start);
  const discard = useActiveWorkout((s) => s.discard);

  return async (routineId?: string) => {
    const begin = async () => {
      setupNotifications().catch(() => undefined);
      if (routineId) {
        const r = await loadRoutineDraft(routineId);
        if (!r) return;
        startStore({ title: r.name, routineId: r.id, exercises: cloneWithNewIds(r.exercises) });
      } else {
        startStore();
      }
      router.push('/workout/active');
    };

    if (useActiveWorkout.getState().workout) {
      Alert.alert('Workout in progress', 'You already have a workout running.', [
        { text: 'Resume it', onPress: () => router.push('/workout/active') },
        { text: 'Discard & start new', style: 'destructive', onPress: () => (discard(), begin()) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    await begin();
  };
}
