import { addDays, format, parseISO } from 'date-fns';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { db } from '@/db/client';
import { afterWrite } from '@/sync/sync';
import { nowIso, uuid } from '@/utils/uuid';
import { calorieDay, DEFAULT_WEIGHT_KG, stepCalories, workoutCalories, type CalorieDay, type Intensity } from './calories';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: { key: Meal; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🍛' },
  { key: 'dinner', label: 'Dinner', emoji: '🍲' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
];

export type SportSession = {
  id: string;
  sport: string;
  started_at: string;
  duration_s: number;
  intensity: Intensity;
  distance_m: number | null;
  calories_kcal: number;
  notes: string | null;
};

export type FoodEntry = {
  id: string;
  eaten_at: string;
  meal: Meal;
  name: string;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type DailyActivity = { day: string; steps: number; distance_m: number; source: string };

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** Local-time [start, end) of a yyyy-MM-dd day, as ISO strings. */
function dayRange(day: string): [string, string] {
  const start = parseISO(day);
  return [start.toISOString(), addDays(start, 1).toISOString()];
}

/** Latest logged body weight, for calorie estimates. */
export async function bodyWeightKg(userId: string): Promise<number> {
  const r = await db.getFirstAsync<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_measurements WHERE user_id = ? AND deleted_at IS NULL AND weight_kg IS NOT NULL
      ORDER BY measured_at DESC LIMIT 1`,
    userId,
  );
  return r?.weight_kg ?? DEFAULT_WEIGHT_KG;
}

// ---- steps --------------------------------------------------------------------

/** Same id on every device for (user, day), so imports from two phones merge instead of clashing. */
async function activityId(userId: string, day: string): Promise<string> {
  const h = await digestStringAsync(CryptoDigestAlgorithm.SHA1, `daily_activity:${userId}:${day}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Writes imported days; only rows whose numbers changed are marked for upload. Returns how many changed. */
export async function saveDailyActivity(userId: string, days: DailyActivity[]): Promise<number> {
  let changed = 0;
  for (const d of days) {
    const id = await activityId(userId, d.day);
    const r = await db.runAsync(
      `INSERT INTO daily_activity (id, user_id, day, steps, distance_m, source, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET steps = excluded.steps, distance_m = excluded.distance_m, source = excluded.source,
         updated_at = excluded.updated_at, dirty = 1, deleted_at = NULL
       WHERE daily_activity.steps != excluded.steps OR abs(daily_activity.distance_m - excluded.distance_m) >= 1
          OR daily_activity.deleted_at IS NOT NULL`,
      id, userId, d.day, Math.round(d.steps), Math.round(d.distance_m), d.source, nowIso(),
    );
    changed += r.changes;
  }
  if (changed) afterWrite();
  return changed;
}

export async function activityDays(userId: string, from: string, to: string): Promise<DailyActivity[]> {
  return db.getAllAsync<DailyActivity>(
    `SELECT day, steps, distance_m, source FROM daily_activity
      WHERE user_id = ? AND deleted_at IS NULL AND day >= ? AND day <= ? ORDER BY day`,
    userId, from, to,
  );
}

// ---- sports -------------------------------------------------------------------

export async function getSport(id: string): Promise<SportSession | null> {
  return db.getFirstAsync<SportSession>(
    'SELECT id, sport, started_at, duration_s, intensity, distance_m, calories_kcal, notes FROM sport_sessions WHERE id = ? AND deleted_at IS NULL',
    id,
  );
}

export async function saveSport(userId: string, s: Omit<SportSession, 'id'> & { id?: string }): Promise<string> {
  const id = s.id ?? uuid();
  await db.runAsync(
    `INSERT INTO sport_sessions (id, user_id, sport, started_at, duration_s, intensity, distance_m, calories_kcal, notes, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET sport = excluded.sport, started_at = excluded.started_at, duration_s = excluded.duration_s,
       intensity = excluded.intensity, distance_m = excluded.distance_m, calories_kcal = excluded.calories_kcal,
       notes = excluded.notes, updated_at = excluded.updated_at, dirty = 1`,
    id, userId, s.sport, s.started_at, s.duration_s, s.intensity, s.distance_m, s.calories_kcal, s.notes, nowIso(),
  );
  afterWrite();
  return id;
}

export async function deleteSport(id: string) {
  await db.runAsync('UPDATE sport_sessions SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', nowIso(), nowIso(), id);
  afterWrite();
}

export async function sportsBetween(userId: string, fromIso: string, toIso: string): Promise<SportSession[]> {
  return db.getAllAsync<SportSession>(
    `SELECT id, sport, started_at, duration_s, intensity, distance_m, calories_kcal, notes FROM sport_sessions
      WHERE user_id = ? AND deleted_at IS NULL AND started_at >= ? AND started_at < ? ORDER BY started_at`,
    userId, fromIso, toIso,
  );
}

// ---- food ---------------------------------------------------------------------

export async function getFood(id: string): Promise<FoodEntry | null> {
  return db.getFirstAsync<FoodEntry>(
    'SELECT id, eaten_at, meal, name, calories_kcal, protein_g, carbs_g, fat_g FROM food_entries WHERE id = ? AND deleted_at IS NULL',
    id,
  );
}

export async function saveFood(userId: string, f: Omit<FoodEntry, 'id'> & { id?: string }): Promise<string> {
  const id = f.id ?? uuid();
  await db.runAsync(
    `INSERT INTO food_entries (id, user_id, eaten_at, meal, name, calories_kcal, protein_g, carbs_g, fat_g, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(id) DO UPDATE SET eaten_at = excluded.eaten_at, meal = excluded.meal, name = excluded.name,
       calories_kcal = excluded.calories_kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
       fat_g = excluded.fat_g, updated_at = excluded.updated_at, dirty = 1`,
    id, userId, f.eaten_at, f.meal, f.name.trim(), f.calories_kcal, f.protein_g, f.carbs_g, f.fat_g, nowIso(),
  );
  afterWrite();
  return id;
}

export async function deleteFood(id: string) {
  await db.runAsync('UPDATE food_entries SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', nowIso(), nowIso(), id);
  afterWrite();
}

/** Foods logged before, most frequent first, for one-tap re-adding. */
export async function recentFoods(userId: string, limit = 12): Promise<Omit<FoodEntry, 'id' | 'eaten_at'>[]> {
  return db.getAllAsync(
    `SELECT name, meal, calories_kcal, protein_g, carbs_g, fat_g FROM (
       SELECT *, COUNT(*) OVER (PARTITION BY name) AS times,
              ROW_NUMBER() OVER (PARTITION BY name ORDER BY eaten_at DESC) AS latest
         FROM food_entries WHERE user_id = ? AND deleted_at IS NULL
     ) WHERE latest = 1 ORDER BY times DESC, eaten_at DESC LIMIT ?`,
    userId, limit,
  );
}

// ---- day summary ----------------------------------------------------------------

export type DaySummary = {
  day: string;
  steps: number;
  distanceM: number;
  stepGoal: number;
  sports: SportSession[];
  food: FoodEntry[];
  workouts: { id: string; title: string; duration_s: number; kcal: number }[];
  macros: { protein: number; carbs: number; fat: number };
  calories: CalorieDay;
  weightKg: number;
};

export async function daySummary(userId: string, day: string): Promise<DaySummary> {
  const [from, to] = dayRange(day);
  const [profile, weightKg, activity, sports, food, workouts] = await Promise.all([
    db.getFirstAsync<{ step_goal: number; calorie_goal: number }>('SELECT step_goal, calorie_goal FROM profiles WHERE id = ?', userId),
    bodyWeightKg(userId),
    activityDays(userId, day, day),
    sportsBetween(userId, from, to),
    db.getAllAsync<FoodEntry>(
      `SELECT id, eaten_at, meal, name, calories_kcal, protein_g, carbs_g, fat_g FROM food_entries
        WHERE user_id = ? AND deleted_at IS NULL AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at`,
      userId, from, to,
    ),
    db.getAllAsync<{ id: string; title: string; started_at: string; ended_at: string }>(
      `SELECT id, title, started_at, ended_at FROM workouts
        WHERE user_id = ? AND deleted_at IS NULL AND ended_at IS NOT NULL AND started_at >= ? AND started_at < ? ORDER BY started_at`,
      userId, from, to,
    ),
  ]);
  const steps = activity[0]?.steps ?? 0;
  const w = workouts.map((x) => {
    const duration_s = (Date.parse(x.ended_at) - Date.parse(x.started_at)) / 1000;
    return { id: x.id, title: x.title, duration_s, kcal: workoutCalories(duration_s, weightKg) };
  });
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, v) => a + (v ?? 0), 0);
  return {
    day,
    steps,
    distanceM: activity[0]?.distance_m ?? 0,
    stepGoal: profile?.step_goal ?? 8000,
    sports,
    food,
    workouts: w,
    macros: { protein: sum(food.map((f) => f.protein_g)), carbs: sum(food.map((f) => f.carbs_g)), fat: sum(food.map((f) => f.fat_g)) },
    calories: calorieDay({
      eaten: sum(food.map((f) => f.calories_kcal)),
      workoutKcal: sum(w.map((x) => x.kcal)),
      sportKcal: sum(sports.map((x) => x.calories_kcal)),
      stepKcal: stepCalories(steps, weightKg),
      goal: profile?.calorie_goal ?? 2000,
    }),
    weightKg,
  };
}

/** Steps per day for the last `n` days (oldest first), zero-filled. */
export async function stepHistory(userId: string, n: number, today = new Date()): Promise<{ day: string; steps: number }[]> {
  const days = Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - n + 1)));
  const rows = await activityDays(userId, days[0], days[n - 1]);
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  return days.map((day) => ({ day, steps: byDay.get(day) ?? 0 }));
}
