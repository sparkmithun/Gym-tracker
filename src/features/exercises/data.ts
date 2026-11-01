import { db } from '@/db/client';
import type { Exercise, ExerciseType, SetType } from '@/db/types';
import { afterWrite } from '@/sync/sync';
import { nowIso, uuid } from '@/utils/uuid';

type ExerciseRow = Omit<Exercise, 'secondary_muscles'> & { secondary_muscles: string };

const parse = (r: ExerciseRow): Exercise => ({
  ...r,
  secondary_muscles: (() => {
    try {
      return JSON.parse(r.secondary_muscles) as string[];
    } catch {
      return [];
    }
  })(),
});

const COLS = 'id, owner_id, name, type, equipment, primary_muscle, secondary_muscles, instructions, image_url';

export type ExerciseFilter = { search?: string; muscle?: string | null; equipment?: string | null };

export async function listExercises(userId: string, f: ExerciseFilter = {}): Promise<Exercise[]> {
  const where = ['deleted_at IS NULL', '(owner_id IS NULL OR owner_id = ?)'];
  const params: (string | null)[] = [userId];
  if (f.search?.trim()) {
    // every word must match, so "inc db press" finds "Incline Bench Press (Dumbbell)"
    for (const word of f.search.trim().toLowerCase().split(/\s+/)) {
      where.push('lower(name) LIKE ?');
      params.push(`%${word}%`);
    }
  }
  if (f.muscle) {
    where.push("(primary_muscle = ? OR secondary_muscles LIKE ?)");
    params.push(f.muscle, `%"${f.muscle}"%`);
  }
  if (f.equipment) {
    where.push('equipment = ?');
    params.push(f.equipment);
  }
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT ${COLS} FROM exercises WHERE ${where.join(' AND ')} ORDER BY name COLLATE NOCASE`,
    ...params,
  );
  return rows.map(parse);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const r = await db.getFirstAsync<ExerciseRow>(`SELECT ${COLS} FROM exercises WHERE id = ?`, id);
  return r ? parse(r) : null;
}

export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  if (!ids.length) return [];
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT ${COLS} FROM exercises WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  const byId = new Map(rows.map((r) => [r.id, parse(r)]));
  return ids.map((id) => byId.get(id)).filter((e): e is Exercise => !!e);
}

/** Most recently used exercises, for the top of the picker. */
export async function recentExerciseIds(userId: string, limit = 8): Promise<string[]> {
  const rows = await db.getAllAsync<{ exercise_id: string }>(
    `SELECT we.exercise_id, MAX(w.started_at) AS last
       FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ? AND w.deleted_at IS NULL AND we.deleted_at IS NULL
      GROUP BY we.exercise_id ORDER BY last DESC LIMIT ?`,
    userId, limit,
  );
  return rows.map((r) => r.exercise_id);
}

export type ExerciseInput = {
  name: string;
  type: ExerciseType;
  equipment: string;
  primary_muscle: string;
  secondary_muscles: string[];
  instructions?: string;
};

export async function createExercise(userId: string, input: ExerciseInput): Promise<string> {
  const id = uuid();
  await db.runAsync(
    `INSERT INTO exercises (id, owner_id, name, type, equipment, primary_muscle, secondary_muscles, instructions, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    id, userId, input.name.trim(), input.type, input.equipment, input.primary_muscle,
    JSON.stringify(input.secondary_muscles), input.instructions?.trim() || null, nowIso(),
  );
  afterWrite();
  return id;
}

export async function updateExercise(id: string, input: ExerciseInput) {
  await db.runAsync(
    `UPDATE exercises SET name = ?, type = ?, equipment = ?, primary_muscle = ?, secondary_muscles = ?,
       instructions = ?, updated_at = ?, dirty = 1 WHERE id = ? AND owner_id IS NOT NULL`,
    input.name.trim(), input.type, input.equipment, input.primary_muscle,
    JSON.stringify(input.secondary_muscles), input.instructions?.trim() || null, nowIso(), id,
  );
  afterWrite();
}

export async function deleteExercise(id: string) {
  await db.runAsync(
    'UPDATE exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ? AND owner_id IS NOT NULL',
    nowIso(), nowIso(), id,
  );
  afterWrite();
}

// ---- history ----------------------------------------------------------------

export type HistorySet = {
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
  completed: number;
};

export type ExerciseSession = {
  workout_id: string;
  title: string;
  started_at: string;
  sets: HistorySet[];
};

/** Every completed workout containing this exercise, newest first, with its sets. */
export async function exerciseHistory(userId: string, exerciseId: string, limit = 200): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<HistorySet & { workout_id: string; title: string; started_at: string; we_id: string }>(
    `SELECT w.id AS workout_id, w.title, w.started_at, we.id AS we_id,
            s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.rpe, s.completed
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id AND we.deleted_at IS NULL
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL
      WHERE w.user_id = ? AND we.exercise_id = ? AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL
        AND w.id IN (SELECT w2.id FROM workouts w2 JOIN workout_exercises we2 ON we2.workout_id = w2.id
                      WHERE w2.user_id = ? AND we2.exercise_id = ? AND w2.deleted_at IS NULL AND we2.deleted_at IS NULL
                      ORDER BY w2.started_at DESC LIMIT ?)
      ORDER BY w.started_at DESC, we.sort_order, s.sort_order`,
    userId, exerciseId, userId, exerciseId, limit,
  );
  const sessions: ExerciseSession[] = [];
  for (const r of rows) {
    let last = sessions[sessions.length - 1];
    if (!last || last.workout_id !== r.workout_id) {
      last = { workout_id: r.workout_id, title: r.title, started_at: r.started_at, sets: [] };
      sessions.push(last);
    }
    last.sets.push(r);
  }
  return sessions;
}

/** Sets from the last finished workout with this exercise — powers the "Previous" column. */
export async function previousSets(userId: string, exerciseId: string, excludeWorkoutId?: string): Promise<HistorySet[]> {
  const last = await db.getFirstAsync<{ id: string }>(
    `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ? AND we.exercise_id = ? AND w.deleted_at IS NULL AND we.deleted_at IS NULL
        AND w.ended_at IS NOT NULL AND w.id != ?
      ORDER BY w.started_at DESC, we.sort_order LIMIT 1`,
    userId, exerciseId, excludeWorkoutId ?? '',
  );
  if (!last) return [];
  return db.getAllAsync<HistorySet>(
    `SELECT set_type, weight_kg, reps, duration_s, distance_m, rpe, completed FROM workout_sets
      WHERE workout_exercise_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    last.id,
  );
}
