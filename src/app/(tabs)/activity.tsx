import { addDays, format, isToday, isYesterday, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { BarChart } from '@/components/Charts';
import { Button, Card, IconButton, Ionicons, Row, SectionTitle, Stat, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { sportOf } from '@/features/activity/calories';
import { Macro, Meter, Ring } from '@/features/activity/components';
import { dayKey, daySummary, MEALS, stepHistory } from '@/features/activity/data';
import { connectHealth, healthName, healthStatus, importHealth, isHealthEnabled } from '@/features/activity/health';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';
import { formatDurationShort } from '@/utils/units';

const dayLabel = (day: string) => {
  const d = parseISO(day);
  return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE d MMM');
};

export default function Activity() {
  const userId = useUserId();
  const u = useUnits();
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const isTodaySelected = day === dayKey(new Date());

  const { data } = useLiveQuery(async () => {
    const [summary, week, enabled, status] = await Promise.all([
      daySummary(userId, day),
      stepHistory(userId, 7, parseISO(day)),
      isHealthEnabled(),
      healthStatus(),
    ]);
    return { summary, week, enabled, status };
  }, [userId, day]);

  const s = data?.summary;
  const shift = (n: number) => setDay((d) => dayKey(addDays(parseISO(d), n)));

  const refresh = async () => {
    setRefreshing(true);
    await importHealth(userId).catch(() => undefined);
    setRefreshing(false);
  };

  const connect = async () => {
    if (data?.status === 'unsupported') {
      Alert.alert(`${healthName} not available`, `Step tracking needs the installed Spark Lift app (not Expo Go)${healthName === 'Health Connect' ? ' on Android 8 or newer' : ''}.`);
      return;
    }
    if (data?.status === 'needs-install' || data?.status === 'needs-update') {
      Alert.alert('Install Health Connect', 'Install or update "Health Connect by Google" from the Play Store, then try again.');
      return;
    }
    try {
      const ok = await connectHealth();
      if (ok) await importHealth(userId);
      else Alert.alert('No access', `Allow Spark Lift to read Steps in ${healthName} to track walking automatically.`);
    } catch (e) {
      Alert.alert('Could not connect', e instanceof Error ? e.message : String(e));
    }
  };

  const cal = s?.calories;
  const remaining = cal?.remaining ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton name="chevron-back" label="Previous day" onPress={() => shift(-1)} />
        <T v="h3">{dayLabel(day)}</T>
        <IconButton name="chevron-forward" label="Next day" onPress={() => !isTodaySelected && shift(1)} color={isTodaySelected ? colors.border : colors.textDim} />
      </Row>

      {/* Steps */}
      <Card style={{ gap: space.md }}>
        <Row gap={space.lg}>
          <Ring value={s?.steps ?? 0} goal={s?.stepGoal ?? 8000}>
            <T v="h2">{(s?.steps ?? 0).toLocaleString()}</T>
            <T v="tiny" muted>/ {(s?.stepGoal ?? 8000).toLocaleString()} steps</T>
          </Ring>
          <View style={{ flex: 1, gap: space.md }}>
            <Stat label="Distance" value={u.du(s?.distanceM ?? 0)} />
            <Stat label="Burned walking" value={`${cal?.steps ?? 0} kcal`} />
          </View>
        </Row>
        {data && !data.enabled && (
          <Button title={`Track steps with ${healthName}`} icon="footsteps" variant="secondary" small onPress={connect} />
        )}
        {data?.enabled && <T v="tiny" muted>Steps import automatically from {healthName}. Pull down to refresh.</T>}
      </Card>

      {/* Calories */}
      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">Calories</T>
          <T v="small" dim>Goal {cal?.goal ?? 2000} kcal</T>
        </Row>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <T v="h1" color={remaining < 0 ? colors.danger : colors.text}>{Math.abs(remaining).toLocaleString()}</T>
            <T v="small" dim>{remaining < 0 ? 'kcal over' : 'kcal remaining'}</T>
          </View>
          <Stat label="Eaten" value={`${cal?.eaten ?? 0}`} />
          <Stat label="Burned" value={`${cal?.burned ?? 0}`} />
        </Row>
        <Meter value={cal?.eaten ?? 0} max={(cal?.goal ?? 2000) + (cal?.burned ?? 0)} color={colors.success} />
        <T v="tiny" muted>
          Burned = gym {cal?.workouts ?? 0} + sports {cal?.sports ?? 0} + walking {cal?.steps ?? 0} kcal · estimates for {Math.round(s?.weightKg ?? 70)} kg
        </T>
        <Row>
          <Macro label="Protein" grams={s?.macros.protein ?? 0} color={colors.primary} />
          <Macro label="Carbs" grams={s?.macros.carbs ?? 0} color={colors.warning} />
          <Macro label="Fat" grams={s?.macros.fat ?? 0} color={colors.drop} />
        </Row>
      </Card>

      {/* Food */}
      <SectionTitle title="Food" action={<Button title="Add" icon="add" small variant="ghost" onPress={() => router.push({ pathname: '/food/[id]', params: { id: 'new', day } })} />} />
      {MEALS.map((m) => {
        const items = s?.food.filter((f) => f.meal === m.key) ?? [];
        const total = items.reduce((a, f) => a + f.calories_kcal, 0);
        return (
          <Card key={m.key} style={{ gap: space.xs, paddingVertical: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">{m.emoji} {m.label}</T>
              <Row>
                {total > 0 && <T dim>{total} kcal</T>}
                <IconButton name="add-circle" label={`Add ${m.label}`} color={colors.primary} onPress={() => router.push({ pathname: '/food/[id]', params: { id: 'new', day, meal: m.key } })} />
              </Row>
            </Row>
            {items.map((f) => (
              <Pressable key={f.id} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.id } })}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <T style={{ flex: 1 }} numberOfLines={1}>{f.name}</T>
                  <T dim>{f.calories_kcal} kcal</T>
                </Row>
              </Pressable>
            ))}
          </Card>
        );
      })}

      {/* Sports and gym */}
      <SectionTitle title="Sports & workouts" action={<Button title="Log sport" icon="add" small variant="ghost" onPress={() => router.push({ pathname: '/sport/[id]', params: { id: 'new', day } })} />} />
      {s && s.sports.length === 0 && s.workouts.length === 0 && (
        <T dim>Nothing yet {isTodaySelected ? 'today' : 'this day'}. Log a match, run or swim — or start a gym workout.</T>
      )}
      {s?.workouts.map((w) => (
        <Card key={w.id} onPress={() => router.push(`/workout/${w.id}`)}>
          <Row>
            <T v="h2">🏋️</T>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{w.title}</T>
              <T v="small" dim>Gym · {formatDurationShort(w.duration_s)}</T>
            </View>
            <T dim>{w.kcal} kcal</T>
          </Row>
        </Card>
      ))}
      {s?.sports.map((x) => {
        const sport = sportOf(x.sport);
        return (
          <Card key={x.id} onPress={() => router.push({ pathname: '/sport/[id]', params: { id: x.id } })}>
            <Row>
              <T v="h2">{sport.emoji}</T>
              <View style={{ flex: 1 }}>
                <T v="h3">{sport.name}</T>
                <T v="small" dim>
                  {format(new Date(x.started_at), 'HH:mm')} · {formatDurationShort(x.duration_s)} · {x.intensity}
                  {x.distance_m ? ` · ${u.du(x.distance_m)}` : ''}
                </T>
              </View>
              <T dim>{x.calories_kcal} kcal</T>
            </Row>
          </Card>
        );
      })}

      {/* Week */}
      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">Steps · 7 days</T>
          <Ionicons name="footsteps" size={18} color={colors.textMuted} />
        </Row>
        <BarChart
          bars={(data?.week ?? []).map((d) => ({ label: format(parseISO(d.day), 'EEEEE'), value: d.steps }))}
          formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
      </Card>
    </ScrollView>
  );
}
