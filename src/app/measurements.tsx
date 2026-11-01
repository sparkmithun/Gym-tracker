import { format } from 'date-fns';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { LineChart } from '@/components/Charts';
import { Button, Card, Input, Row, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import type { MeasurementRow } from '@/db/types';
import { addMeasurement, deleteMeasurement, listMeasurements } from '@/features/profile/data';
import { useUnits } from '@/hooks/useUnits';
import { useUserId } from '@/providers/AuthProvider';
import { space } from '@/theme';
import { fromDisplayWeight, parseNumber, toDisplayWeight } from '@/utils/units';

const CM_FIELDS = [
  ['neck_cm', 'Neck'], ['chest_cm', 'Chest'], ['waist_cm', 'Waist'], ['hips_cm', 'Hips'], ['arm_cm', 'Arm'], ['thigh_cm', 'Thigh'],
] as const;

type Form = Record<'weight' | 'fat' | (typeof CM_FIELDS)[number][0], string>;
const emptyForm = (): Form => ({ weight: '', fat: '', neck_cm: '', chest_cm: '', waist_cm: '', hips_cm: '', arm_cm: '', thigh_cm: '' });

export default function Measurements() {
  const userId = useUserId();
  const u = useUnits();
  const [form, setForm] = useState<Form>(emptyForm());
  const [adding, setAdding] = useState(false);
  const { data } = useLiveQuery(() => listMeasurements(userId), [userId]);

  const save = async () => {
    const n = (s: string) => parseNumber(s) ?? null;
    const w = n(form.weight);
    const row: Omit<MeasurementRow, 'id'> = {
      measured_at: new Date().toISOString(),
      weight_kg: w == null ? null : fromDisplayWeight(w, u.weight),
      body_fat_pct: n(form.fat),
      neck_cm: n(form.neck_cm), chest_cm: n(form.chest_cm), waist_cm: n(form.waist_cm),
      hips_cm: n(form.hips_cm), arm_cm: n(form.arm_cm), thigh_cm: n(form.thigh_cm),
    };
    if (Object.entries(row).every(([k, v]) => k === 'measured_at' || v == null)) return Alert.alert('Enter at least one value');
    await addMeasurement(userId, row);
    setForm(emptyForm());
    setAdding(false);
  };

  const weights = (data ?? []).filter((m) => m.weight_kg != null).map((m) => ({ x: Date.parse(m.measured_at), y: m.weight_kg! })).reverse();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <T v="h3">Body weight</T>
        <LineChart points={weights} formatY={(v) => `${toDisplayWeight(v, u.weight)} ${u.weight}`} />
      </Card>

      {adding ? (
        <Card style={{ gap: space.md }}>
          <Row>
            <View style={{ flex: 1 }}><Input label={`Weight (${u.weight})`} keyboardType="decimal-pad" value={form.weight} onChangeText={(t) => setForm({ ...form, weight: t })} /></View>
            <View style={{ flex: 1 }}><Input label="Body fat %" keyboardType="decimal-pad" value={form.fat} onChangeText={(t) => setForm({ ...form, fat: t })} /></View>
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {CM_FIELDS.map(([k, l]) => (
              <View key={k} style={{ width: '31%' }}>
                <Input label={`${l} (cm)`} keyboardType="decimal-pad" value={form[k]} onChangeText={(t) => setForm({ ...form, [k]: t })} />
              </View>
            ))}
          </Row>
          <Row>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            <Button title="Save" style={{ flex: 1 }} onPress={save} />
          </Row>
        </Card>
      ) : (
        <Button title="Add measurement" icon="add" onPress={() => setAdding(true)} />
      )}

      {(data ?? []).map((m) => (
        <Card key={m.id} style={{ gap: 4 }} onPress={() =>
          Alert.alert('Delete entry?', format(new Date(m.measured_at), 'd MMM yyyy'), [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(m.id) },
          ])}>
          <T v="small" dim>{format(new Date(m.measured_at), 'EEE d MMM yyyy, HH:mm')}</T>
          <T>
            {[
              m.weight_kg != null && u.wu(m.weight_kg),
              m.body_fat_pct != null && `${m.body_fat_pct}% fat`,
              ...CM_FIELDS.map(([k, l]) => m[k] != null && `${l} ${m[k]}cm`),
            ].filter(Boolean).join(' · ')}
          </T>
        </Card>
      ))}
    </ScrollView>
  );
}
