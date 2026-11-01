import { startOfWeek, subWeeks, format } from 'date-fns';
import { db } from '@/db/client';
import type { SetType } from '@/db/types';
import { bestsOf, estimate1RM, countsForStats, type Bests } from '@/utils/oneRepMax';

const LIVE = `w.user_id = ? AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL`;

export type WeekBucket = { weekStart: string; label: string; workouts: number; volume: number; durationS: number };

/** Last `weeks` calendar weeks (Monday start), oldest first. */
export async function weeklySummary(userId: string, weeks = 8): Promise<WeekBucket[]> {
  const start = startOfWeek(subWeeks(new Date(), weeks - 1), { weekStartsOn: 1 });
  const workouts = await db.getAllAsync<{ id: string; started_at: string; ended_at: string; volume: number | null }>(
    `SELECT w.id, w.started_at, w.ended_at,
            (SELECT SUM(IFNULL(s.weight_kg,0) * IFNULL(s.reps,0)) FROM workout_exercises we
               JOIN workout_sets s ON s.workout_exercise_id = we.id
              WHERE we.workout_id = w.id AND we.deleted_at IS NULL AND s.deleted_at IS NULL
                AND s.completed = 1 AND s.set_type != 'warmup') AS volume
       FROM workouts w WHERE ${LIVE} AND w.started_at >= ?`,
    userId, start.toISOString(),
  );
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const ws = startOfWeek(subWeeks(new Date(), weeks - 1 - i), { weekStartsOn: 1 });
    return { weekStart: ws.toISOString(), label: format(ws, 'd MMM'), workouts: 0, volume: 0, durationS: 0 };
  });
  for (const w of workouts) {
    const ws = startOfWeek(new Date(w.started_at), { weekStartsOn: 1 }).toISOString();
    const b = buckets.find((x) => x.weekStart === ws);
    if (!b) continue;
    b.workouts++;
    b.volume += w.volume ?? 0;
    b.durationS += (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000;
  }
  return buckets;
}

/** Consecutive weeks (ending this week or last week) with at least one workout. */
export async function weekStreak(userId: string): Promise<number> {
  const rows = await db.getAllAsync<{ started_at: string }>(
    `SELECT w.started_at FROM workouts w WHERE ${LIVE} ORDER BY w.started_at DESC LIMIT 1000`,
    userId,
  );
  const weeks = new Set(rows.map((r) => startOfWeek(new Date(r.started_at), { weekStartsOn: 1 }).getTime()));
  let cursor = startOfWeek(new Date(), { weekStartsOn: 1 });
  if (!weeks.has(cursor.getTime())) cursor = subWeeks(cursor, 1); // this week not trained yet — streak still alive
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor = subWeeks(cursor, 1);
  }
  return streak;
}

export async function totalWorkouts(userId: string): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM workouts w WHERE ${LIVE}`, userId);
  return r?.n ?? 0;
}

/** Working sets per muscle in the last `days` days. Secondary muscles count as half a set. */
export async function muscleDistribution(userId: string, days = 30): Promise<{ muscle: string; sets: number }[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await db.getAllAsync<{ primary_muscle: string; secondary_muscles: string; n: number }>(
    `SELECT e.primary_muscle, e.secondary_muscles, COUNT(s.id) AS n
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id AND we.deleted_at IS NULL
       JOIN exercises e ON e.id = we.exercise_id
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL AND s.completed = 1 AND s.set_type != 'warmup'
      WHERE ${LIVE} AND w.started_at >= ?
      GROUP BY we.exercise_id`,
    userId, since,
  );
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.primary_muscle, (totals.get(r.primary_muscle) ?? 0) + r.n);
    let secondary: string[] = [];
    try {
      secondary = JSON.parse(r.secondary_muscles);
    } catch {
      // ignore malformed
    }
    for (const m of secondary) totals.set(m, (totals.get(m) ?? 0) + r.n / 2);
  }
  return [...totals.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** yyyy-MM-dd strings for days with a workout in the given month. */
export async function workoutDays(userId: string, monthStart: Date, monthEnd: Date): Promise<Map<string, string[]>> {
  const rows = await db.getAllAsync<{ id: string; started_at: string }>(
    `SELECT w.id, w.started_at FROM workouts w WHERE ${LIVE} AND w.started_at >= ? AND w.started_at < ?`,
    userId, monthStart.toISOString(), monthEnd.toISOString(),
  );
  const days = new Map<string, string[]>();
  for (const r of rows) {
    const k = format(new Date(r.started_at), 'yyyy-MM-dd');
    days.set(k, [...(days.get(k) ?? []), r.id]);
  }
  return days;
}

// ---- per exercise -------------------------------------------------------------

type SetRow = { workout_id: string; started_at: string; set_type: SetType; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; completed: number };

async function exerciseSets(userId: string, exerciseId: string): Promise<SetRow[]> {
  return db.getAllAsync<SetRow>(
    `SELECT w.id AS workout_id, w.started_at, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.completed
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id AND we.deleted_at IS NULL
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL
      WHERE ${LIVE} AND we.exercise_id = ?
      ORDER BY w.started_at`,
    userId, exerciseId,
  );
}

export type ExercisePoint = { date: string; workoutId: string; maxWeight: number; best1RM: number; volume: number; maxReps: number; bestSetVolume: number; maxDuration: number; maxDistance: number };

export async function exerciseSeries(userId: string, exerciseId: string): Promise<ExercisePoint[]> {
  const sets = await exerciseSets(userId, exerciseId);
  const byWorkout = new Map<string, SetRow[]>();
  for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s]);
  const points: ExercisePoint[] = [];
  for (const [workoutId, ss] of byWorkout) {
    if (!ss.some(countsForStats)) continue;
    const b = bestsOf(ss);
    const volume = ss.filter(countsForStats).reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
    points.push({ date: ss[0].started_at, workoutId, ...b, volume });
  }
  return points;
}

export type RecordEntry = { value: number; date: string | null; workoutId: string | null; detail?: string };

/** All-time bests with the date each was set. */
export async function exerciseRecords(userId: string, exerciseId: string): Promise<Record<keyof Bests, RecordEntry>> {
  const sets = (await exerciseSets(userId, exerciseId)).filter(countsForStats);
  const empty = (): RecordEntry => ({ value: 0, date: null, workoutId: null });
  const rec: Record<keyof Bests, RecordEntry> = {
    maxWeight: empty(), best1RM: empty(), bestSetVolume: empty(), maxReps: empty(), maxDuration: empty(), maxDistance: empty(),
  };
  const consider = (k: keyof Bests, v: number, s: SetRow) => {
    if (v > rec[k].value) rec[k] = { value: v, date: s.started_at, workoutId: s.workout_id };
  };
  for (const s of sets) {
    const w = s.weight_kg ?? 0;
    const r = s.reps ?? 0;
    consider('maxWeight', w, s);
    consider('best1RM', estimate1RM(w, r), s);
    consider('bestSetVolume', w * r, s);
    consider('maxReps', r, s);
    consider('maxDuration', s.duration_s ?? 0, s);
    consider('maxDistance', s.distance_m ?? 0, s);
  }
  return rec;
}
