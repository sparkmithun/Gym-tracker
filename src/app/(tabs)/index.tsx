import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { BarChart, HBar } from '@/components/Charts';
import { Button, Card, EmptyState, Row, SectionTitle, Stat, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { label } from '@/db/types';
import { muscleDistribution, totalWorkouts, weekStreak, weeklySummary } from '@/features/stats/data';
import { listWorkouts } from '@/features/workout/data';
import { WorkoutCard } from '@/features/workout/components/WorkoutCard';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useUnits } from '@/hooks/useUnits';
import { useAuth, useUserId } from '@/providers/AuthProvider';
import { space } from '@/theme';
import { formatDurationShort } from '@/utils/units';

export default function Home() {
  const userId = useUserId();
  const { profile } = useAuth();
  const u = useUnits();
  const start = useStartWorkout();

  const { data } = useLiveQuery(async () => {
    const [weeks, streak, total, muscles, recent] = await Promise.all([
      weeklySummary(userId, 8),
      weekStreak(userId),
      totalWorkouts(userId),
      muscleDistribution(userId, 30),
      listWorkouts(userId, 3),
    ]);
    return { weeks, streak, total, muscles, recent };
  }, [userId]);

  const thisWeek = data?.weeks[data.weeks.length - 1];
  const topMuscles = data?.muscles.slice(0, 8) ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <T v="h2">Hi {profile?.display_name?.split(' ')[0] ?? profile?.username ?? 'there'} 👋</T>
      <Button title="Start Empty Workout" icon="add" onPress={() => start()} />

      <Card style={{ gap: space.md }}>
        <T v="h3">This week</T>
        <Row>
          <Stat label="Workouts" value={String(thisWeek?.workouts ?? 0)} />
          <Stat label="Volume" value={u.volume(thisWeek?.volume ?? 0)} />
          <Stat label="Time" value={formatDurationShort(thisWeek?.durationS ?? 0)} />
        </Row>
        <Row>
          <Stat label="Week streak" value={`🔥 ${data?.streak ?? 0}`} />
          <Stat label="All-time" value={`${data?.total ?? 0} workouts`} />
        </Row>
      </Card>

      <Card style={{ gap: space.sm }}>
        <T v="h3">Workouts per week</T>
        <BarChart bars={(data?.weeks ?? []).map((w) => ({ label: w.label, value: w.workouts }))} />
      </Card>

      <Card style={{ gap: space.md }}>
        <T v="h3">Muscle sets · last 30 days</T>
        {topMuscles.length === 0 ? (
          <T dim>Finish a workout to see which muscles you trained.</T>
        ) : (
          topMuscles.map((m) => <HBar key={m.muscle} label={label(m.muscle)} value={m.sets} max={topMuscles[0].sets} />)
        )}
      </Card>

      <SectionTitle title="Recent workouts" action={<Button title="All" small variant="ghost" onPress={() => router.push('/profile')} />} />
      {data?.recent.length === 0 && (
        <EmptyState icon="barbell-outline" title="No workouts yet" body="Start an empty workout or create a routine on the Workout tab." />
      )}
      <View style={{ gap: space.md }}>
        {data?.recent.map((w) => <WorkoutCard key={w.id} w={w} />)}
      </View>
    </ScrollView>
  );
}
