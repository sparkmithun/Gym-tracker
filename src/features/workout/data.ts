import { db } from '@/db/client';
import type { ExerciseType, SetType, Visibility, WorkoutRow } from '@/db/types';
import { afterWrite } from '@/sync/sync';
import { bestsOf, newRecords, type PrKind, type PrSet } from '@/utils/oneRepMax';
import { nowIso } from '@/utils/uuid';
import type { DraftExercise, DraftWorkout } from './draft';

const inList = (ids: string[]) => (ids.length ? ids.map(() => '?').join(',') : "''");

/**
 * Writes a whole workout (new or edited) in one transaction. Exercises/sets that were removed
 * from the draft are soft-deleted so the deletion syncs.
 */
export async function saveWorkout(userId: string, w: DraftWorkout): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO workouts (id, user_id, routine_id, title, notes, started_at, ended_at, photo_url, visibility, updated_at, deleted_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
       ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, title = excluded.title, notes = excluded.notes,
         started_at = excluded.started_at, ended_at = excluded.ended_at, photo_url = excluded.photo_url,
         visibility = excluded.visibility, updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
      w.id, userId, w.routineId, w.title.trim() || 'Workout', w.notes.trim() || null, w.startedAt,
      w.endedAt ?? now, w.photoUrl, w.visibility, now,
    );

    const exIds = w.exercises.map((e) => e.id);
    await db.runAsync(
      `UPDATE workout_exercises SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE workout_id = ? AND deleted_at IS NULL AND id NOT IN (${inList(exIds)})`,
      now, now, w.id, ...exIds,
    );

    for (const [i, e] of w.exercises.entries()) {
      await db.runAsync(
        `INSERT INTO workout_exercises (id, user_id, workout_id, exercise_id, sort_order, superset_group, notes, updated_at, deleted_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
         ON CONFLICT(id) DO UPDATE SET exercise_id = excluded.exercise_id, sort_order = excluded.sort_order,
           superset_group = excluded.superset_group, notes = excluded.notes, updated_at = excluded.updated_at,
           deleted_at = NULL, dirty = 1`,
        e.id, userId, w.id, e.exerciseId, i, e.supersetGroup, e.notes.trim() || null, now,
      );
      const setIds = e.sets.map((s) => s.id);
      await db.runAsync(
        `UPDATE workout_sets SET deleted_at = ?, updated_at = ?, dirty = 1
          WHERE workout_exercise_id = ? AND deleted_at IS NULL AND id NOT IN (${inList(setIds)})`,
        now, now, e.id, ...setIds,
      );
      for (const [j, s] of e.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets (id, user_id, workout_exercise_id, sort_order, set_type, weight_kg, reps, duration_s,
             distance_m, rpe, completed, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
           ON CONFLICT(id) DO UPDATE SET sort_order = excluded.sort_order, set_type = excluded.set_type,
             weight_kg = excluded.weight_kg, reps = excluded.reps, duration_s = excluded.duration_s,
             distance_m = excluded.distance_m, rpe = excluded.rpe, completed = excluded.completed,
             updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
          s.id, userId, e.id, j, s.type, s.weightKg, s.reps, s.durationS, s.distanceM, s.rpe, s.completed ? 1 : 0, now,
        );
      }
    }
  });
  afterWrite();
}

export async function deleteWorkout(id: string) {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE workouts SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', now, now, id);
    await db.runAsync(
      `UPDATE workout_sets SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?) AND deleted_at IS NULL`,
      now, now, id,
    );
    await db.runAsync(
      'UPDATE workout_exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE workout_id = ? AND deleted_at IS NULL',
      now, now, id,
    );
  });
  afterWrite();
}

// ---- reading ----------------------------------------------------------------

export type WorkoutSummary = WorkoutRow & {
  duration_s: number;
  volume_kg: number;
  set_count: number;
  exercises: { name: string; sets: number }[];
};

export async function listWorkouts(userId: string, limit = 30, offset = 0): Promise<WorkoutSummary[]> {
  const workouts = await db.getAllAsync<WorkoutRow>(
    `SELECT id, routine_id, title, notes, started_at, ended_at, photo_url, visibility FROM workouts
      WHERE user_id = ? AND deleted_at IS NULL AND ended_at IS NOT NULL
      ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    userId, limit, offset,
  );
  if (!workouts.length) return [];
  const ids = workouts.map((w) => w.id);
  const rows = await db.getAllAsync<{ workout_id: string; name: string; sets: number; volume: number; sort_order: number }>(
    `SELECT we.workout_id, e.name, we.sort_order,
            SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS sets,
            SUM(CASE WHEN s.completed = 1 AND s.set_type != 'warmup' THEN IFNULL(s.weight_kg,0) * IFNULL(s.reps,0) ELSE 0 END) AS volume
       FROM workout_exercises we
       JOIN exercises e ON e.id = we.exercise_id
       LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL
      WHERE we.workout_id IN (${inList(ids)}) AND we.deleted_at IS NULL
      GROUP BY we.id ORDER BY we.sort_order`,
    ...ids,
  );
  return workouts.map((w) => {
    const ex = rows.filter((r) => r.workout_id === w.id);
    return {
      ...w,
      duration_s: w.ended_at ? (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000 : 0,
      volume_kg: ex.reduce((a, r) => a + (r.volume ?? 0), 0),
      set_count: ex.reduce((a, r) => a + (r.sets ?? 0), 0),
      exercises: ex.map((r) => ({ name: r.name, sets: r.sets ?? 0 })),
    };
  });
}

/** Loads a stored workout into the editable draft shape. */
export async function loadWorkoutDraft(id: string): Promise<DraftWorkout | null> {
  const w = await db.getFirstAsync<WorkoutRow>(
    'SELECT id, routine_id, title, notes, started_at, ended_at, photo_url, visibility FROM workouts WHERE id = ? AND deleted_at IS NULL',
    id,
  );
  if (!w) return null;
  const exRows = await db.getAllAsync<{ id: string; exercise_id: string; name: string; type: ExerciseType; superset_group: number | null; notes: string | null }>(
    `SELECT we.id, we.exercise_id, e.name, e.type, we.superset_group, we.notes
       FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
      WHERE we.workout_id = ? AND we.deleted_at IS NULL ORDER BY we.sort_order`,
    id,
  );
  const setRows = await db.getAllAsync<{
    id: string; workout_exercise_id: string; set_type: SetType; weight_kg: number | null; reps: number | null;
    duration_s: number | null; distance_m: number | null; rpe: number | null; completed: number;
  }>(
    `SELECT id, workout_exercise_id, set_type, weight_kg, reps, duration_s, distance_m, rpe, completed FROM workout_sets
      WHERE workout_exercise_id IN (${inList(exRows.map((e) => e.id))}) AND deleted_at IS NULL ORDER BY sort_order`,
    ...exRows.map((e) => e.id),
  );
  const exercises: DraftExercise[] = exRows.map((e) => ({
    id: e.id,
    exerciseId: e.exercise_id,
    name: e.name,
    exType: e.type,
    supersetGroup: e.superset_group,
    restSeconds: 0,
    notes: e.notes ?? '',
    sets: setRows
      .filter((s) => s.workout_exercise_id === e.id)
      .map((s) => ({
        id: s.id,
        type: s.set_type,
        weightKg: s.weight_kg,
        reps: s.reps,
        durationS: s.duration_s,
        distanceM: s.distance_m,
        rpe: s.rpe,
        completed: !!s.completed,
      })),
  }));
  return {
    id: w.id,
    routineId: w.routine_id,
    title: w.title,
    notes: w.notes ?? '',
    startedAt: w.started_at,
    endedAt: w.ended_at,
    visibility: w.visibility as Visibility,
    photoUrl: w.photo_url,
    exercises,
  };
}

// ---- personal records -------------------------------------------------------

export type WorkoutPr = { exerciseId: string; name: string; kinds: PrKind[] };

const toPrSet = (s: { set_type: SetType; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; completed: number | boolean }): PrSet => s;

/**
 * Records set in a workout, compared against every workout that started before it.
 * Records are derived (not stored), so editing or deleting history can never leave them stale.
 */
export async function workoutRecords(userId: string, draft: Pick<DraftWorkout, 'id' | 'startedAt' | 'exercises'>): Promise<WorkoutPr[]> {
  const out: WorkoutPr[] = [];
  const seen = new Set<string>();
  for (const e of draft.exercises) {
    if (seen.has(e.exerciseId)) continue;
    seen.add(e.exerciseId);
    const sets = draft.exercises
      .filter((x) => x.exerciseId === e.exerciseId)
      .flatMap((x) => x.sets)
      .map((s) => toPrSet({ set_type: s.type, weight_kg: s.weightKg, reps: s.reps, duration_s: s.durationS, distance_m: s.distanceM, completed: s.completed }));
    const before = await db.getAllAsync<{ set_type: SetType; weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; completed: number }>(
      `SELECT s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.completed
         FROM workout_sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id AND we.deleted_at IS NULL
         JOIN workouts w ON w.id = we.workout_id AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL
        WHERE w.user_id = ? AND we.exercise_id = ? AND w.started_at < ? AND w.id != ? AND s.deleted_at IS NULL`,
      userId, e.exerciseId, draft.startedAt, draft.id,
    );
    const kinds = newRecords(bestsOf(before.map(toPrSet)), bestsOf(sets), before.some((s) => s.completed));
    if (kinds.length) out.push({ exerciseId: e.exerciseId, name: e.name, kinds });
  }
  return out;
}
