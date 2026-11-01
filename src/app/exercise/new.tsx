import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Chip, Input, Row, T, styles } from '@/components/ui';
import { EQUIPMENT, EXERCISE_TYPE_LABELS, MUSCLES, label, type ExerciseType } from '@/db/types';
import { createExercise, getExercise, updateExercise } from '@/features/exercises/data';
import { useUserId } from '@/providers/AuthProvider';
import { space } from '@/theme';

/** Create a custom exercise, or edit one with ?edit=<id>. */
export default function NewExercise() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const userId = useUserId();
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weight_reps');
  const [equipment, setEquipment] = useState<string>('barbell');
  const [primary, setPrimary] = useState<string>('chest');
  const [secondary, setSecondary] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (!edit) return;
    getExercise(edit).then((e) => {
      if (!e) return;
      setName(e.name);
      setType(e.type);
      setEquipment(e.equipment ?? 'other');
      setPrimary(e.primary_muscle);
      setSecondary(e.secondary_muscles);
      setInstructions(e.instructions ?? '');
    });
  }, [edit]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required');
    const input = { name, type, equipment, primary_muscle: primary, secondary_muscles: secondary.filter((m) => m !== primary), instructions };
    if (edit) await updateExercise(edit, input);
    else await createExercise(userId, input);
    router.back();
  };

  const chips = <K extends string>(items: readonly K[], isActive: (k: K) => boolean, onPress: (k: K) => void, fmt: (k: K) => string = label) => (
    <Row style={{ flexWrap: 'wrap' }}>
      {items.map((k) => <Chip key={k} label={fmt(k)} active={isActive(k)} onPress={() => onPress(k)} />)}
    </Row>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { gap: space.lg }]} keyboardShouldPersistTaps="handled">
      <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Landmine Press" maxLength={80} />
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Exercise type</T>
        {chips(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[], (k) => k === type, setType, (k) => EXERCISE_TYPE_LABELS[k])}
      </View>
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Equipment</T>
        {chips(EQUIPMENT, (k) => k === equipment, setEquipment)}
      </View>
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Primary muscle</T>
        {chips(MUSCLES, (k) => k === primary, setPrimary)}
      </View>
      <View style={{ gap: space.sm }}>
        <T v="small" dim>Secondary muscles</T>
        {chips(MUSCLES, (k) => secondary.includes(k), (k) => setSecondary((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])))}
      </View>
      <Input label="Instructions (optional)" value={instructions} onChangeText={setInstructions} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Button title={edit ? 'Save changes' : 'Create exercise'} onPress={save} />
    </ScrollView>
  );
}
