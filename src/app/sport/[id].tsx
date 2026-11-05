import { addDays, format, parseISO, setHours, setMinutes } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Input, Row, T, styles } from '@/components/ui';
import { SPORTS, sportCalories, sportOf, type Intensity } from '@/features/activity/calories';
import { bodyWeightKg, deleteSport, getSport, saveSport } from '@/features/activity/data';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { colors, radius, space } from '@/theme';
import { fromDisplayDistance, parseNumber, toDisplayDistance } from '@/utils/units';

const INTENSITIES: { key: Intensity; label: string; hint: string }[] = [
  { key: 'light', label: 'Light', hint: 'Casual, can chat easily' },
  { key: 'moderate', label: 'Moderate', hint: 'Breathing harder, steady effort' },
  { key: 'vigorous', label: 'Hard', hint: 'Match pace, out of breath' },
];
const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function SportSessionScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day?: string }>();
  const isNew = id === 'new';
  const userId = useUserId();
  const u = useUnits();

  const [sport, setSport] = useState('cricket');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [minutes, setMinutes_] = useState('60');
  const [date, setDate] = useState(() => day ?? format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(() => format(new Date(Date.now() - 3600_000), 'HH:mm'));
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [weight, setWeight] = useState(70);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    bodyWeightKg(userId).then(setWeight);
    if (isNew) return;
    getSport(id).then((s) => {
      if (!s) return;
      const start = new Date(s.started_at);
      setSport(s.sport);
      setIntensity(s.intensity);
      setMinutes_(String(Math.round(s.duration_s / 60)));
      setDate(format(start, 'yyyy-MM-dd'));
      setTime(format(start, 'HH:mm'));
      setDistance(s.distance_m ? String(toDisplayDistance(s.distance_m, u.distance)) : '');
      setNotes(s.notes ?? '');
    });
  }, [id, isNew, userId, u.distance]);

  const mins = parseNumber(minutes) ?? 0;
  const kcal = sportCalories(sport, intensity, mins * 60, weight);
  const meta = sportOf(sport);
  const timeOk = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
  const valid = mins >= 1 && mins <= 1440 && timeOk;

  const save = async () => {
    setSaving(true);
    try {
      const [h, m] = time.split(':').map(Number);
      const started = setMinutes(setHours(parseISO(date), h), m);
      const km = parseNumber(distance);
      await saveSport(userId, {
        id: isNew ? undefined : id,
        sport,
        intensity,
        started_at: started.toISOString(),
        duration_s: Math.round(mins * 60),
        distance_m: meta.distance && km ? fromDisplayDistance(km, u.distance) : null,
        calories_kcal: kcal,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this session?', meta.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSport(id).then(() => router.back()) },
    ]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'Log Sport' : 'Edit Session' }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {SPORTS.map((x) => (
          <Pressable
            key={x.key}
            onPress={() => setSport(x.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: sport === x.key }}
            style={{
              width: '30.5%',
              alignItems: 'center',
              paddingVertical: space.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: sport === x.key ? colors.primary : colors.border,
              backgroundColor: sport === x.key ? colors.primaryDim : colors.surface,
            }}
          >
            <T v="h2">{x.emoji}</T>
            <T v="small" numberOfLines={1}>{x.name}</T>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <T v="small" dim>Duration (minutes)</T>
        <Row style={{ flexWrap: 'wrap' }}>
          {DURATIONS.map((d) => <Chip key={d} label={`${d}`} active={minutes === String(d)} onPress={() => setMinutes_(String(d))} />)}
        </Row>
        <Input value={minutes} onChangeText={setMinutes_} keyboardType="number-pad" placeholder="Minutes" maxLength={4} />
      </View>

      <View style={{ gap: space.sm }}>
        <T v="small" dim>Intensity</T>
        <Row>
          {INTENSITIES.map((i) => <Chip key={i.key} label={i.label} active={intensity === i.key} onPress={() => setIntensity(i.key)} />)}
        </Row>
        <T v="tiny" muted>{INTENSITIES.find((i) => i.key === intensity)?.hint}</T>
      </View>

      <View style={{ gap: space.sm }}>
        <T v="small" dim>When</T>
        <Row>
          <Chip label="Today" active={date === today} onPress={() => setDate(today)} />
          <Chip label="Yesterday" active={date === yesterday} onPress={() => setDate(yesterday)} />
          {date !== today && date !== yesterday && <Chip label={format(parseISO(date), 'd MMM')} active />}
          <Input value={time} onChangeText={setTime} placeholder="HH:mm" maxLength={5} style={{ width: 80, paddingVertical: 7 }} />
        </Row>
        {!timeOk && <T v="tiny" color={colors.danger}>Start time as HH:mm, e.g. 18:30</T>}
      </View>

      {meta.distance && (
        <Input label={`Distance (${u.distance}, optional)`} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
      )}
      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={200} placeholder="Scored 45 runs 🏏" />

      <Card style={{ alignItems: 'center', gap: 2 }}>
        <T v="h1" color={colors.warning}>🔥 {kcal} kcal</T>
        <T v="tiny" muted>Estimated for {Math.round(weight)} kg · log your weight in Measurements for accuracy</T>
      </Card>

      <Button title={isNew ? 'Save session' : 'Save changes'} variant="success" onPress={save} loading={saving} disabled={!valid} />
      {!isNew && <Button title="Delete session" variant="ghost" onPress={remove} />}
    </ScrollView>
  );
}
