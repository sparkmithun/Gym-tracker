import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons, Row, T } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useActiveWorkout } from '@/store/activeWorkout';
import { colors, radius, space } from '@/theme';
import { formatDuration } from '@/utils/units';

/** "Workout in progress" pill shown above the tab bar while a workout is running. */
export function ActiveWorkoutBar({ bottom }: { bottom: number }) {
  const workout = useActiveWorkout((s) => s.workout);
  const now = useNow(1000, !!workout);

  if (!workout) return null;
  const elapsed = (now - Date.parse(workout.startedAt)) / 1000;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Resume workout"
      onPress={() => router.push('/workout/active')}
      style={({ pressed }) => [s.bar, { bottom, opacity: pressed ? 0.85 : 1 }]}
    >
      <Row style={{ flex: 1 }}>
        <Ionicons name="barbell" size={20} color="#fff" />
        <T v="h3" color="#fff" numberOfLines={1} style={{ flex: 1 }}>{workout.title}</T>
      </Row>
      <T v="h3" color="#fff">{formatDuration(elapsed)}</T>
      <Ionicons name="chevron-up" size={20} color="#fff" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
