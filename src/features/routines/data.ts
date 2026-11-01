import { db } from '@/db/client';
import type { ExerciseType, FolderRow, RoutineRow, SetType } from '@/db/types';
import { afterWrite } from '@/sync/sync';
import { nowIso, uuid } from '@/utils/uuid';
import type { DraftExercise, DraftRoutine } from '../workout/draft';

const inList = (ids: string[]) => (ids.length ? ids.map(() => '?').join(',') : "''");

export type RoutineSummary = RoutineRow & { exercise_names: string[] };

export async function listRoutines(userId: string): Promise<{ folders: FolderRow[]; routines: RoutineSummary[] }> {
  const folders = await db.getAllAsync<FolderRow>(
    'SELECT id, name, sort_order FROM routine_folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, name',
    userId,
  );
  const routines = await db.getAllAsync<RoutineRow>(
    `SELECT id, folder_id, name, notes, sort_order, updated_at FROM routines
      WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, name COLLATE NOCASE`,
    userId,
  );
  const names = await db.getAllAsync<{ routine_id: string; name: string }>(
    `SELECT re.routine_id, e.name FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
      WHERE re.user_id = ? AND re.deleted_at IS NULL ORDER BY re.sort_order`,
    userId,
  );
  return {
    folders,
    routines: routines.map((r) => ({ ...r, exercise_names: names.filter((n) => n.routine_id === r.id).map((n) => n.name) })),
  };
}

export async function loadRoutineDraft(id: string): Promise<DraftRoutine | null> {
  const r = await db.getFirstAsync<RoutineRow>(
    'SELECT id, folder_id, name, notes, sort_order, updated_at FROM routines WHERE id = ? AND deleted_at IS NULL',
    id,
  );
  if (!r) return null;
  const exRows = await db.getAllAsync<{ id: string; exercise_id: string; name: string; type: ExerciseType; superset_group: number | null; rest_seconds: number | null; notes: string | null }>(
    `SELECT re.id, re.exercise_id, e.name, e.type, re.superset_group, re.rest_seconds, re.notes
       FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ? AND re.deleted_at IS NULL ORDER BY re.sort_order`,
    id,
  );
  const setRows = await db.getAllAsync<{ id: string; routine_exercise_id: string; set_type: SetType; target_weight_kg: number | null; target_reps: number | null; target_duration_s: number | null; target_distance_m: number | null }>(
    `SELECT id, routine_exercise_id, set_type, target_weight_kg, target_reps, target_duration_s, target_distance_m
       FROM routine_sets WHERE routine_exercise_id IN (${inList(exRows.map((e) => e.id))}) AND deleted_at IS NULL
      ORDER BY sort_order`,
    ...exRows.map((e) => e.id),
  );
  const exercises: DraftExercise[] = exRows.map((e) => ({
    id: e.id,
    exerciseId: e.exercise_id,
    name: e.name,
    exType: e.type,
    supersetGroup: e.superset_group,
    restSeconds: e.rest_seconds ?? 90,
    notes: e.notes ?? '',
    sets: setRows
      .filter((s) => s.routine_exercise_id === e.id)
      .map((s) => ({
        id: s.id,
        type: s.set_type,
        weightKg: s.target_weight_kg,
        reps: s.target_reps,
        durationS: s.target_duration_s,
        distanceM: s.target_distance_m,
        rpe: null,
        completed: false,
      })),
  }));
  return { id: r.id, folderId: r.folder_id, name: r.name, notes: r.notes ?? '', exercises, isNew: false };
}

export const emptyRoutine = (folderId: string | null = null): DraftRoutine => ({
  id: uuid(),
  folderId,
  name: '',
  notes: '',
  exercises: [],
  isNew: true,
});

export async function saveRoutine(userId: string, r: DraftRoutine): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const maxOrder = await db.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(sort_order) AS m FROM routines WHERE user_id = ?', userId,
    );
    await db.runAsync(
      `INSERT INTO routines (id, user_id, folder_id, name, notes, sort_order, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET folder_id = excluded.folder_id, name = excluded.name, notes = excluded.notes,
         updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
      r.id, userId, r.folderId, r.name.trim() || 'Routine', r.notes.trim() || null, (maxOrder?.m ?? -1) + 1, now,
    );
    const exIds = r.exercises.map((e) => e.id);
    await db.runAsync(
      `UPDATE routine_exercises SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE routine_id = ? AND deleted_at IS NULL AND id NOT IN (${inList(exIds)})`,
      now, now, r.id, ...exIds,
    );
    for (const [i, e] of r.exercises.entries()) {
      await db.runAsync(
        `INSERT INTO routine_exercises (id, user_id, routine_id, exercise_id, sort_order, superset_group, rest_seconds, notes, updated_at, deleted_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
         ON CONFLICT(id) DO UPDATE SET exercise_id = excluded.exercise_id, sort_order = excluded.sort_order,
           superset_group = excluded.superset_group, rest_seconds = excluded.rest_seconds, notes = excluded.notes,
           updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
        e.id, userId, r.id, e.exerciseId, i, e.supersetGroup, e.restSeconds, e.notes.trim() || null, now,
      );
      const setIds = e.sets.map((s) => s.id);
      await db.runAsync(
        `UPDATE routine_sets SET deleted_at = ?, updated_at = ?, dirty = 1
          WHERE routine_exercise_id = ? AND deleted_at IS NULL AND id NOT IN (${inList(setIds)})`,
        now, now, e.id, ...setIds,
      );
      for (const [j, s] of e.sets.entries()) {
        await db.runAsync(
          `INSERT INTO routine_sets (id, user_id, routine_exercise_id, sort_order, set_type, target_weight_kg, target_reps,
             target_duration_s, target_distance_m, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
           ON CONFLICT(id) DO UPDATE SET sort_order = excluded.sort_order, set_type = excluded.set_type,
             target_weight_kg = excluded.target_weight_kg, target_reps = excluded.target_reps,
             target_duration_s = excluded.target_duration_s, target_distance_m = excluded.target_distance_m,
             updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
          s.id, userId, e.id, j, s.type, s.weightKg, s.reps, s.durationS, s.distanceM, now,
        );
      }
    }
  });
  afterWrite();
}

export async function deleteRoutine(id: string) {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE routines SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', now, now, id);
    await db.runAsync(
      `UPDATE routine_sets SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE routine_exercise_id IN (SELECT id FROM routine_exercises WHERE routine_id = ?) AND deleted_at IS NULL`,
      now, now, id,
    );
    await db.runAsync(
      'UPDATE routine_exercises SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE routine_id = ? AND deleted_at IS NULL',
      now, now, id,
    );
  });
  afterWrite();
}

/** Copy a routine with fresh IDs. */
export async function duplicateRoutine(userId: string, id: string) {
  const r = await loadRoutineDraft(id);
  if (!r) return;
  await saveRoutine(userId, {
    ...r,
    id: uuid(),
    name: `${r.name} (copy)`,
    isNew: true,
    exercises: r.exercises.map((e) => ({ ...e, id: uuid(), sets: e.sets.map((s) => ({ ...s, id: uuid() })) })),
  });
}

export async function moveRoutine(id: string, folderId: string | null) {
  await db.runAsync('UPDATE routines SET folder_id = ?, updated_at = ?, dirty = 1 WHERE id = ?', folderId, nowIso(), id);
  afterWrite();
}

export async function createFolder(userId: string, name: string): Promise<string> {
  const id = uuid();
  const maxOrder = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM routine_folders WHERE user_id = ?', userId);
  await db.runAsync(
    'INSERT INTO routine_folders (id, user_id, name, sort_order, updated_at, dirty) VALUES (?, ?, ?, ?, ?, 1)',
    id, userId, name.trim(), (maxOrder?.m ?? -1) + 1, nowIso(),
  );
  afterWrite();
  return id;
}

export async function renameFolder(id: string, name: string) {
  await db.runAsync('UPDATE routine_folders SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?', name.trim(), nowIso(), id);
  afterWrite();
}

/** Deleting a folder keeps its routines (they move to "My Routines"). */
export async function deleteFolder(id: string) {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE routines SET folder_id = NULL, updated_at = ?, dirty = 1 WHERE folder_id = ?', now, id);
    await db.runAsync('UPDATE routine_folders SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', now, now, id);
  });
  afterWrite();
}
