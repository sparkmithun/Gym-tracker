import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionsSheet } from '@/components/OptionsSheet';
import { Button, Chip, IconButton, Input, Ionicons, Row, T } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { EQUIPMENT, MUSCLES, label, type Exercise } from '@/db/types';
import { getExercisesByIds, listExercises, recentExerciseIds } from '@/features/exercises/data';
import { useUserId } from '@/providers/AuthProvider';
import { usePicker } from '@/store/picker';
import { colors, radius, space } from '@/theme';

function useDebounced<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ExerciseLibrary() {
  const { pick, single } = useLocalSearchParams<{ pick?: string; single?: string }>();
  const picking = pick === '1';
  const multi = picking && single !== '1';
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  const onPick = usePicker((s) => s.onPick);
  const clearPicker = usePicker((s) => s.clear);

  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'muscle' | 'equipment' | null>(null);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const q = useDebounced(search);

  const { data: exercises } = useLiveQuery(() => listExercises(userId, { search: q, muscle, equipment }), [userId, q, muscle, equipment]);
  const { data: recent } = useLiveQuery(async () => getExercisesByIds(await recentExerciseIds(userId, 6)), [userId]);
  const filtering = !!q.trim() || !!muscle || !!equipment;

  useEffect(() => clearPicker, [clearPicker]);

  const choose = (e: Exercise) => {
    if (!picking) return router.push(`/exercise/${e.id}`);
    if (!multi) {
      onPick?.([{ id: e.id, name: e.name, type: e.type }]);
      return router.back();
    }
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  };

  const confirm = () => {
    onPick?.(selected.map((e) => ({ id: e.id, name: e.name, type: e.type })));
    router.back();
  };

  const data = useMemo(() => exercises ?? [], [exercises]);
  const selectedIds = new Set(selected.map((s) => s.id));

  const renderItem = ({ item: e }: { item: Exercise }) => {
    const isSel = selectedIds.has(e.id);
    return (
      <Pressable onPress={() => choose(e)} style={({ pressed }) => [s.item, isSel && s.itemSel, pressed && { opacity: 0.7 }]}
        accessibilityRole="button" accessibilityState={{ selected: isSel }}>
        <View style={s.avatar}>
          <T v="h3" color={colors.primary}>{e.name[0]}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T v="h3" numberOfLines={1} style={{ fontSize: 15 }}>{e.name}</T>
          <T v="small" dim>{label(e.primary_muscle)}{e.owner_id ? ' · Custom' : ''}</T>
        </View>
        {multi && <Ionicons name={isSel ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={isSel ? colors.primary : colors.textMuted} />}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: picking ? (multi ? 'Add Exercises' : 'Replace Exercise') : 'Exercises',
          headerRight: () => <IconButton name="add" label="Create custom exercise" color={colors.primary} onPress={() => router.push('/exercise/new')} />,
        }}
      />
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search exercises" autoCorrect={false} clearButtonMode="while-editing" />
        <Row>
          <Chip label={muscle ? label(muscle) : 'All muscles'} active={!!muscle} onPress={() => setSheet('muscle')} />
          <Chip label={equipment ? label(equipment) : 'All equipment'} active={!!equipment} onPress={() => setSheet('equipment')} />
          {(muscle || equipment) && <Chip label="Clear" onPress={() => (setMuscle(null), setEquipment(null))} />}
        </Row>
      </View>
      <FlatList
        data={data}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          !filtering && recent?.length ? (
            <View style={{ gap: 2, marginBottom: space.md }}>
              <T v="tiny" muted style={{ marginBottom: space.xs }}>RECENT</T>
              {recent.map((e) => <View key={e.id}>{renderItem({ item: e })}</View>)}
              <T v="tiny" muted style={{ marginTop: space.md, marginBottom: space.xs }}>ALL EXERCISES</T>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          exercises ? (
            <View style={{ alignItems: 'center', gap: space.md, padding: space.xl }}>
              <T dim>No exercises found.</T>
              <Button title="Create custom exercise" small variant="secondary" onPress={() => router.push('/exercise/new')} />
            </View>
          ) : undefined
        }
      />
      {multi && selected.length > 0 && (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Button title={`Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`} onPress={confirm} />
        </View>
      )}
      <OptionsSheet
        visible={sheet === 'muscle'}
        title="Muscle group"
        onClose={() => setSheet(null)}
        options={[{ label: 'All muscles', onPress: () => setMuscle(null) }, ...MUSCLES.map((m) => ({ label: label(m), onPress: () => setMuscle(m) }))]}
      />
      <OptionsSheet
        visible={sheet === 'equipment'}
        title="Equipment"
        onClose={() => setSheet(null)}
        options={[{ label: 'All equipment', onPress: () => setEquipment(null) }, ...EQUIPMENT.map((m) => ({ label: label(m), onPress: () => setEquipment(m) }))]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.md },
  itemSel: { backgroundColor: colors.primaryDim },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
