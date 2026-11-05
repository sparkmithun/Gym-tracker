import { db } from '@/db/client';
import { dailyScores, localDay, summarize, workoutPoints, type DayScore, type PointsSummary } from './points';

// Your own points and streak, computed from the local database so they work offline and for guests.

type Row = { id: string; started_at: string; ended_at: string; sets: number | null; volume: number | null; distance: number | null };

async function workoutRows(userId: string, workoutId?: string): Promise<Row[]> {
  return db.getAllAsync<Row>(
    `SELECT w.id, w.started_at, w.ended_at, s.sets, s.volume, s.distance
       FROM workouts w
       LEFT JOIN (
         SELECT we.workout_id, COUNT(ws.id) AS sets,
                SUM(IFNULL(ws.weight_kg, 0) * IFNULL(ws.reps, 0)) AS volume,
                SUM(IFNULL(ws.distance_m, 0)) AS distance
           FROM workout_exercises we
           JOIN workout_sets ws ON ws.workout_exercise_id = we.id
          WHERE we.deleted_at IS NULL AND ws.deleted_at IS NULL AND ws.completed = 1 AND ws.set_type != 'warmup'
          GROUP BY we.workout_id
       ) s ON s.workout_id = w.id
      WHERE w.user_id = ? AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL${workoutId ? ' AND w.id = ?' : ''}`,
    ...(workoutId ? [userId, workoutId] : [userId]),
  );
}

const scoreOf = (r: Row) =>
  workoutPoints({
    sets: r.sets ?? 0,
    volumeKg: r.volume ?? 0,
    durationS: (Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000,
    distanceM: r.distance ?? 0,
  });

export async function myPoints(userId: string): Promise<{ summary: PointsSummary; days: DayScore[] }> {
  const rows = await workoutRows(userId);
  const days = dailyScores(rows.map((r) => ({ day: localDay(new Date(r.started_at)), points: scoreOf(r) })));
  return { summary: summarize(days), days };
}

/** Points one saved workout earned on its own (without the daily cap or streak bonus). */
export async function pointsForWorkout(userId: string, workoutId: string): Promise<number> {
  const [row] = await workoutRows(userId, workoutId);
  return row ? scoreOf(row) : 0;
}
