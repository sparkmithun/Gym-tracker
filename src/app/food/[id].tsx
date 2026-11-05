import { format, parseISO, setHours } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Input, Row, SectionTitle, T, styles } from '@/components/ui';
import { useLiveQuery } from '@/db/live';
import { deleteFood, getFood, MEALS, recentFoods, saveFood, type Meal } from '@/features/activity/data';
import { useUserId } from '@/providers/AuthProvider';
import { colors, radius, space } from '@/theme';
import { parseNumber } from '@/utils/units';

/** A sensible time for the meal on the chosen day, so the entry lands on that day. */
function mealTime(day: string, meal: Meal): Date {
  const now = new Date();
  if (day === format(now, 'yyyy-MM-dd')) return now;
  return setHours(parseISO(day), { breakfast: 8, lunch: 13, dinner: 20, snack: 16 }[meal]);
}

function guessMeal(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h >= 19 ? 'dinner' : 'snack';
}

const numText = (v: number | null) => (v == null ? '' : String(v));

export default function FoodScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string; meal?: Meal }>();
  const isNew = params.id === 'new';
  const userId = useUserId();

  const [meal, setMeal] = useState<Meal>(params.meal ?? guessMeal());
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [eatenAt, setEatenAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const day = params.day ?? format(new Date(), 'yyyy-MM-dd');

  const { data: recent } = useLiveQuery(() => (isNew ? recentFoods(userId) : Promise.resolve([])), [userId, isNew]);

  useEffect(() => {
    if (isNew) return;
    getFood(params.id).then((f) => {
      if (!f) return;
      setMeal(f.meal);
      setName(f.name);
      setKcal(String(f.calories_kcal));
      setProtein(numText(f.protein_g));
      setCarbs(numText(f.carbs_g));
      setFat(numText(f.fat_g));
      setEatenAt(f.eaten_at);
    });
  }, [isNew, params.id]);

  const calories = parseNumber(kcal);
  const valid = name.trim().length > 0 && calories != null && calories >= 0 && calories <= 10000;

  const save = async () => {
    setSaving(true);
    try {
      await saveFood(userId, {
        id: isNew ? undefined : params.id,
        meal,
        name,
        calories_kcal: Math.round(calories ?? 0),
        protein_g: parseNumber(protein) ?? null,
        carbs_g: parseNumber(carbs) ?? null,
        fat_g: parseNumber(fat) ?? null,
        eaten_at: eatenAt ?? mealTime(day, meal).toISOString(),
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this food?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFood(params.id).then(() => router.back()) },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'Add Food' : 'Edit Food' }} />
      <Row style={{ flexWrap: 'wrap' }}>
        {MEALS.map((m) => <Chip key={m.key} label={`${m.emoji} ${m.label}`} active={meal === m.key} onPress={() => setMeal(m.key)} />)}
      </Row>
      <Input label="Food" value={name} onChangeText={setName} maxLength={80} placeholder="e.g. 2 chapati + dal" autoFocus={isNew} />
      <Input label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="number-pad" maxLength={5} />
      <Row>
        <View style={{ flex: 1 }}><Input label="Protein g" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" maxLength={5} /></View>
        <View style={{ flex: 1 }}><Input label="Carbs g" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" maxLength={5} /></View>
        <View style={{ flex: 1 }}><Input label="Fat g" value={fat} onChangeText={setFat} keyboardType="decimal-pad" maxLength={5} /></View>
      </Row>
      <Button title={isNew ? 'Add food' : 'Save changes'} variant="success" onPress={save} loading={saving} disabled={!valid} />
      {!isNew && <Button title="Delete" variant="ghost" onPress={remove} />}

      {isNew && !!recent?.length && (
        <>
          <SectionTitle title="Recent — tap to fill" />
          {recent.map((f) => (
            <Pressable
              key={f.name}
              onPress={() => {
                setName(f.name);
                setKcal(String(f.calories_kcal));
                setProtein(numText(f.protein_g));
                setCarbs(numText(f.carbs_g));
                setFat(numText(f.fat_g));
              }}
              style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ flex: 1 }} numberOfLines={1}>{f.name}</T>
                <T dim>{f.calories_kcal} kcal</T>
              </Row>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
