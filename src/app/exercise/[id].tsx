import { format } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { LineChart } from '@/components/Charts';
import { Card, Chip, EmptyState, IconButton, Loading, Row, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { EXERCISE_TYPE_LABELS, TYPE_FIELDS, label } from '@/db/types';
import { deleteExercise, exerciseHistory, getExercise } from '@/features/exercises/data';
import { exerciseRecords, exerciseSeries, type ExercisePoint } from '@/features/stats/data';
import { previousText, SET_TYPE_STYLE } from '@/features/workout/components/SetRow';
import { useNow } from '@/hooks/useNow';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';
import { PR_LABELS, type PrKind } from '@/utils/oneRepMax';
import { formatDuration, toDisplayDistance, toDisplayWeight } from '@/utils/units';

type Tab = 'summary' | 'history' | 'charts' | 'records';
type Metric = { key: keyof ExercisePoint; label: string; kind: 'weight' | 'reps' | 'duration' | 'distance' };
type Range = '1M' | '3M' | '1Y' | 'All';
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 90, '1Y': 365, All: Infinity };

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const u = useUnits();
  const [tab, setTab] = useState<Tab>('summary');
  const [metricIdx, setMetricIdx] = useState(0);
  const [range, setRange] = useState<Range>('3M');
  const now = useNow(0);

  const { data } = useLiveQuery(async () => {
    const [exercise, history, series, records] = await Promise.all([
      getExercise(id),
      exerciseHistory(userId, id),
      exerciseSeries(userId, id),
      exerciseRecords(userId, id),
    ]);
    return { exercise, history, series, records };
  }, [id, userId]);

  const exercise = data?.exercise;
  const f = exercise ? TYPE_FIELDS[exercise.type] : null;
  const metrics: Metric[] = useMemo(() => {
    if (!f) return [];
    const m: Metric[] = [];
    if (f.weight && f.reps) m.push({ key: 'best1RM', label: 'Est. 1RM', kind: 'weight' });
    if (f.weight) m.push({ key: 'maxWeight', label: 'Heaviest', kind: 'weight' });
    if (f.weight && f.reps) m.push({ key: 'volume', label: 'Session volume', kind: 'weight' }, { key: 'bestSetVolume', label: 'Best set', kind: 'weight' });
    if (f.reps) m.push({ key: 'maxReps', label: 'Most reps', kind: 'reps' });
    if (f.duration) m.push({ key: 'maxDuration', label: 'Longest time', kind: 'duration' });
    if (f.distance) m.push({ key: 'maxDistance', label: 'Distance', kind: 'distance' });
    return m;
  }, [f]);

  if (!data) return <Loading />;
  if (!exercise || !f) return <View style={styles.screen}><EmptyState icon="alert-circle-outline" title="Exercise not found" /></View>;

  const fmt = (kind: Metric['kind'], v: number) =>
    kind === 'weight' ? `${toDisplayWeight(v, u.weight)} ${u.weight}`
      : kind === 'duration' ? formatDuration(v)
        : kind === 'distance' ? `${toDisplayDistance(v, u.distance)} ${u.distance}`
          : `${Math.round(v)}`;

  const metric = metrics[Math.min(metricIdx, metrics.length - 1)];
  const cutoff = now - RANGE_DAYS[range] * 86400_000;
  const points = metric
    ? data.series.filter((p) => Date.parse(p.date) >= cutoff).map((p) => ({ x: Date.parse(p.date), y: Number(p[metric.key]) })).filter((p) => p.y > 0)
    : [];

  const recordKinds: { k: PrKind; kind: Metric['kind'] }[] = [
    ...(f.weight ? [{ k: 'maxWeight' as const, kind: 'weight' as const }] : []),
    ...(f.weight && f.reps ? [{ k: 'best1RM' as const, kind: 'weight' as const }, { k: 'bestSetVolume' as const, kind: 'weight' as const }] : []),
    ...(f.reps ? [{ k: 'maxReps' as const, kind: 'reps' as const }] : []),
    ...(f.duration ? [{ k: 'maxDuration' as const, kind: 'duration' as const }] : []),
    ...(f.distance ? [{ k: 'maxDistance' as const, kind: 'distance' as const }] : []),
  ];

  const customMenu = () =>
    Alert.alert(exercise.name, undefined, [
      { text: 'Edit', onPress: () => router.push(`/exercise/new?edit=${exercise.id}`) },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExercise(exercise.id); router.back(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: exercise.name, headerRight: exercise.owner_id ? () => <IconButton name="ellipsis-horizontal" label="Exercise options" onPress={customMenu} /> : undefined }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Row>
          {(['summary', 'history', 'charts', 'records'] as Tab[]).map((t) => (
            <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} />
          ))}
        </Row>

        {tab === 'summary' && (
          <Card style={{ gap: space.sm }}>
            <T v="h3">{exercise.name}</T>
            <T dim>Primary: {label(exercise.primary_muscle)}</T>
            {exercise.secondary_muscles.length > 0 && <T dim>Secondary: {exercise.secondary_muscles.map(label).join(', ')}</T>}
            <T dim>Equipment: {label(exercise.equipment ?? 'other')}</T>
            <T dim>Type: {EXERCISE_TYPE_LABELS[exercise.type]}</T>
            {exercise.instructions ? <T style={{ marginTop: space.sm }}>{exercise.instructions}</T> : null}
            <T v="small" muted style={{ marginTop: space.sm }}>Logged in {data.history.length} workout{data.history.length === 1 ? '' : 's'}</T>
          </Card>
        )}

        {tab === 'history' && (
          data.history.length === 0 ? <EmptyState icon="time-outline" title="No history yet" /> :
            data.history.map((h) => {
              let n = 0;
              return (
                <Card key={h.workout_id} style={{ gap: 4 }} onPress={() => router.push(`/workout/${h.workout_id}`)}>
                  <T v="h3">{h.title}</T>
                  <T v="small" dim>{format(new Date(h.started_at), 'EEE d MMM yyyy')}</T>
                  {h.sets.filter((s) => s.completed).map((s, i) => {
                    if (s.set_type !== 'warmup') n++;
                    const t = SET_TYPE_STYLE[s.set_type];
                    return (
                      <Row key={i}>
                        <T color={t.color} style={{ width: 22 }}>{t.short || n}</T>
                        <T>{previousText(s, exercise.type, u)}</T>
                      </Row>
                    );
                  })}
                </Card>
              );
            })
        )}

        {tab === 'charts' && metric && (
          <Card style={{ gap: space.md }}>
            <Row style={{ flexWrap: 'wrap' }}>
              {metrics.map((m, i) => <Chip key={m.key} label={m.label} active={i === metricIdx} onPress={() => setMetricIdx(i)} />)}
            </Row>
            <LineChart points={points} formatY={(v) => fmt(metric.kind, v)} />
            <Row>
              {(Object.keys(RANGE_DAYS) as Range[]).map((r) => <Chip key={r} label={r} active={r === range} onPress={() => setRange(r)} />)}
            </Row>
          </Card>
        )}

        {tab === 'records' && (
          <Card style={{ gap: space.md }}>
            {recordKinds.map(({ k, kind }) => {
              const r = data.records[k];
              return (
                <Pressable key={k} disabled={!r.workoutId} onPress={() => r.workoutId && router.push(`/workout/${r.workoutId}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T>{PR_LABELS[k]}</T>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T v="h3" color={r.value ? colors.gold : colors.textMuted}>{r.value ? fmt(kind, r.value) : '—'}</T>
                      {r.date && <T v="tiny" muted>{format(new Date(r.date), 'd MMM yyyy')}</T>}
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </>
  );
}
