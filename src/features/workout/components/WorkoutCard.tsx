import { format } from 'date-fns';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Row, Stat, T } from '@/components/ui';
import { useUnits } from '@/hooks/useUnits';
import { space } from '@/theme';
import { formatDurationShort } from '@/utils/units';
import type { WorkoutSummary } from '../data';

export function WorkoutCard({ w }: { w: WorkoutSummary }) {
  const u = useUnits();
  const shown = w.exercises.slice(0, 4);
  return (
    <Card onPress={() => router.push(`/workout/${w.id}`)} style={{ gap: space.sm }}>
      <View>
        <T v="h3">{w.title}</T>
        <T v="small" dim>{format(new Date(w.started_at), "EEEE, d MMM yyyy 'at' HH:mm")}</T>
      </View>
      <Row>
        <Stat label="Time" value={formatDurationShort(w.duration_s)} />
        <Stat label="Volume" value={u.volume(w.volume_kg)} />
        <Stat label="Sets" value={String(w.set_count)} />
      </Row>
      <View style={{ gap: 2 }}>
        {shown.map((e, i) => (
          <T key={i} v="small" dim numberOfLines={1}>{e.sets} × {e.name}</T>
        ))}
        {w.exercises.length > shown.length && (
          <T v="small" muted>+{w.exercises.length - shown.length} more exercises</T>
        )}
      </View>
    </Card>
  );
}
