import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_WEIGHT_KG, stepCalories, workoutCalories } from './calories';
import { addDay, dayIn, lastDays } from './dates';
import { summarizePoints, type ScoreDay } from './points';

// Everything here runs as the signed-in user, so Row Level Security limits it to their own rows.

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  unit_weight: 'kg' | 'lbs';
  unit_distance: 'km' | 'mi';
  timezone: string;
  step_goal: number;
  calorie_goal: number;
};

type SetRow = { set_type: string; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; completed: boolean; sort_order: number; deleted_at: string | null };
type ExerciseRow = { id: string; sort_order: number; deleted_at: string | null; exercises: { name: string } | null; workout_sets: SetRow[] };
type WorkoutRow = { id: string; title: string; notes: string | null; started_at: string; ended_at: string; workout_exercises: ExerciseRow[] };

export type Workout = {
  id: string;
  title: string;
  notes: string | null;
  startedAt: string;
  day: string;
  durationS: number;
  volumeKg: number;
  sets: number;
  kcal: number;
  exercises: { name: string; sets: SetRow[] }[];
};

export type Sport = { id: string; sport: string; started_at: string; duration_s: number; intensity: string; distance_m: number | null; calories_kcal: number; notes: string | null };
export type Food = { id: string; eaten_at: string; meal: string; name: string; calories_kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
export type DayStats = { day: string; steps: number; distanceM: number; eaten: number; burned: number; workouts: number; sports: number };

const WORKOUT_SELECT =
  'id, title, notes, started_at, ended_at, workout_exercises(id, sort_order, deleted_at, exercises(name), workout_sets(set_type, weight_kg, reps, duration_s, distance_m, completed, sort_order, deleted_at))';

function toWorkout(w: WorkoutRow, tz: string, weightKg: number): Workout {
  const exercises = w.workout_exercises
    .filter((e) => !e.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({
      name: e.exercises?.name ?? 'Exercise',
      sets: e.workout_sets.filter((s) => !s.deleted_at).sort((a, b) => a.sort_order - b.sort_order),
    }));
  const working = exercises.flatMap((e) => e.sets).filter((s) => s.completed && s.set_type !== 'warmup');
  const durationS = (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000;
  return {
    id: w.id,
    title: w.title,
    notes: w.notes,
    startedAt: w.started_at,
    day: dayIn(tz, new Date(w.started_at)),
    durationS,
    volumeKg: working.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
    sets: working.length,
    kcal: workoutCalories(durationS, weightKg),
    exercises,
  };
}

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function bodyWeight(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('body_measurements')
    .select('weight_kg')
    .is('deleted_at', null)
    .not('weight_kg', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(1);
  return Number(data?.[0]?.weight_kg ?? DEFAULT_WEIGHT_KG);
}

export async function listWorkouts(supabase: SupabaseClient, profile: Profile, opts: { since?: string; limit?: number } = {}): Promise<Workout[]> {
  const weight = await bodyWeight(supabase);
  let q = supabase.from('workouts').select(WORKOUT_SELECT).is('deleted_at', null).not('ended_at', 'is', null).order('started_at', { ascending: false });
  if (opts.since) q = q.gte('started_at', opts.since);
  const { data, error } = await q.limit(opts.limit ?? 200);
  if (error) throw new Error(error.message);
  return (data as unknown as WorkoutRow[]).map((w) => toWorkout(w, profile.timezone, weight));
}

export async function getWorkout(supabase: SupabaseClient, profile: Profile, id: string): Promise<Workout | null> {
  const weight = await bodyWeight(supabase);
  const { data } = await supabase.from('workouts').select(WORKOUT_SELECT).eq('id', id).is('deleted_at', null).maybeSingle();
  return data ? toWorkout(data as unknown as WorkoutRow, profile.timezone, weight) : null;
}

/** Last `days` days of steps, food, sports and workouts, bucketed into the user's local days. */
export async function loadActivity(supabase: SupabaseClient, profile: Profile, days: number) {
  const tz = profile.timezone;
  const today = dayIn(tz);
  const range = lastDays(today, days);
  // A day of margin either side covers time-zone offsets; rows are re-bucketed below.
  const sinceIso = new Date(`${addDay(range[0], -1)}T00:00:00Z`).toISOString();

  const [weight, workouts, activity, sports, food, scores] = await Promise.all([
    bodyWeight(supabase),
    listWorkouts(supabase, profile, { since: sinceIso }),
    supabase.from('daily_activity').select('day, steps, distance_m').is('deleted_at', null).gte('day', range[0]),
    supabase.from('sport_sessions').select('*').is('deleted_at', null).gte('started_at', sinceIso).order('started_at', { ascending: false }),
    supabase.from('food_entries').select('*').is('deleted_at', null).gte('eaten_at', sinceIso).order('eaten_at'),
    supabase.rpc('my_daily_scores'),
  ]);

  const sportRows = (sports.data ?? []) as Sport[];
  const foodRows = (food.data ?? []) as Food[];
  const steps = new Map((activity.data ?? []).map((a) => [a.day as string, { steps: Number(a.steps), distanceM: Number(a.distance_m) }]));

  const stats: DayStats[] = range.map((day) => {
    const s = steps.get(day) ?? { steps: 0, distanceM: 0 };
    const dayWorkouts = workouts.filter((w) => w.day === day);
    const daySports = sportRows.filter((x) => dayIn(tz, new Date(x.started_at)) === day);
    const eaten = foodRows.filter((f) => dayIn(tz, new Date(f.eaten_at)) === day).reduce((a, f) => a + f.calories_kcal, 0);
    const burned =
      dayWorkouts.reduce((a, w) => a + w.kcal, 0) + daySports.reduce((a, x) => a + x.calories_kcal, 0) + stepCalories(s.steps, weight);
    return { day, steps: s.steps, distanceM: s.distanceM, eaten, burned, workouts: dayWorkouts.length, sports: daySports.length };
  });

  const scoreDays = ((scores.data ?? []) as ScoreDay[]).map((d) => ({ ...d, day: String(d.day) }));
  return {
    today,
    weight,
    stats,
    workouts: workouts.filter((w) => w.day >= range[0]),
    sports: sportRows.filter((x) => dayIn(tz, new Date(x.started_at)) >= range[0]),
    food: foodRows.filter((f) => dayIn(tz, new Date(f.eaten_at)) >= range[0]),
    points: summarizePoints(scoreDays, today),
  };
}

export type LeaderRow = { rank: number; user_id: string; username: string; display_name: string | null; points: number; workouts: number; streak: number; is_me: boolean };

export async function leaderboard(supabase: SupabaseClient, period: string, groupId?: string): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('leaderboard', { p_period: period, p_group: groupId ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LeaderRow[]).map((r) => ({ ...r, rank: Number(r.rank), points: Number(r.points), workouts: Number(r.workouts), streak: Number(r.streak) }));
}
