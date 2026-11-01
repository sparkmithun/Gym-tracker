import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Chip, Input, Row, T, styles } from '@/components/ui';
import { PLATE_SETS, platesPerSide } from '@/features/workout/plates';
import { useUnits } from '@/hooks/useUnits';
import { colors, space } from '@/theme';
import { parseNumber } from '@/utils/units';

const PLATE_COLORS = ['#F04F5A', '#3D8BFF', '#F5A524', '#2FBF71', '#E8EAED', '#9AA3B2', '#646C7A'];

export default function PlateCalculator() {
  const u = useUnits();
  const set = PLATE_SETS[u.weight];
  const [target, setTarget] = useState('');
  const [bar, setBar] = useState<number>(set.bars[0]);
  const t = parseNumber(target) ?? 0;
  const { plates, remainder } = platesPerSide(t, bar, [...set.plates]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input label={`Target weight (${u.weight})`} keyboardType="decimal-pad" value={target} onChangeText={setTarget} autoFocus placeholder="e.g. 100" />
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Bar</T>
        <Row>
          {set.bars.map((b) => <Chip key={b} label={`${b} ${u.weight}`} active={bar === b} onPress={() => setBar(b)} />)}
        </Row>
      </View>
      <Card style={{ gap: space.md, alignItems: 'center' }}>
        <T v="small" dim>Each side</T>
        {t <= bar ? (
          <T dim>{t ? 'Just the bar' : 'Enter a target weight'}</T>
        ) : (
          <>
            <Row gap={4} style={{ height: 120 }}>
              <View style={{ width: 40, height: 10, backgroundColor: colors.textMuted, borderRadius: 2 }} />
              {plates.map((p, i) => {
                const idx = set.plates.indexOf(p as never);
                const h = 50 + (p / set.plates[0]) * 70;
                return <View key={i} style={{ width: 16, height: h, borderRadius: 3, backgroundColor: PLATE_COLORS[idx % PLATE_COLORS.length] }} />;
              })}
            </Row>
            <T v="h3">{plates.join(' + ') || '—'}</T>
            {remainder > 0 && <T color={colors.warning}>{remainder} {u.weight} can&apos;t be loaded with standard plates</T>}
          </>
        )}
      </Card>
    </ScrollView>
  );
}
