import type { ExerciseType } from '@/db/types';
import { uuid } from '@/utils/uuid';
import { newDraftExercise, newSet, nextSupersetGroup, type DraftExercise, type DraftSet } from './draft';

// Pure, immutable edits on a list of draft exercises. Used by the live logger,
// the past-workout editor and the routine editor so all three behave the same.

type Ex = DraftExercise[];
type PickedExercise = { id: string; name: string; type: ExerciseType };

export const addExercises = (list: Ex, picked: PickedExercise[], restSeconds: number): Ex => [
  ...list,
  ...picked.map((p) => newDraftExercise(p, restSeconds)),
];

export const removeExercise = (list: Ex, id: string): Ex => cleanSupersets(list.filter((e) => e.id !== id));

export function moveExercise(list: Ex, id: string, dir: -1 | 1): Ex {
  const i = list.findIndex((e) => e.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

/** Swap the exercise but keep the sets (values cleared if the input type differs). */
export const replaceExercise = (list: Ex, id: string, p: PickedExercise): Ex =>
  list.map((e) =>
    e.id !== id
      ? e
      : {
          ...e,
          exerciseId: p.id,
          name: p.name,
          sets: p.type === e.exType ? e.sets : e.sets.map((s) => newSet({ id: s.id, type: s.type })),
          exType: p.type,
        },
  );

export const patchExercise = (list: Ex, id: string, patch: Partial<DraftExercise>): Ex =>
  list.map((e) => (e.id === id ? { ...e, ...patch } : e));

/** Link with the next exercise, or unlink if already in a superset. */
export function toggleSupersetWithNext(list: Ex, id: string): Ex {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return list;
  const cur = list[i];
  if (cur.supersetGroup != null) {
    return cleanSupersets(list.map((e) => (e.id === id ? { ...e, supersetGroup: null } : e)));
  }
  const next = list[i + 1];
  if (!next) return list;
  const group = next.supersetGroup ?? nextSupersetGroup(list);
  return list.map((e, k) => (k === i || k === i + 1 ? { ...e, supersetGroup: group } : e));
}

/** A superset needs at least two exercises; drop lonely group numbers. */
function cleanSupersets(list: Ex): Ex {
  const counts = new Map<number, number>();
  for (const e of list) if (e.supersetGroup != null) counts.set(e.supersetGroup, (counts.get(e.supersetGroup) ?? 0) + 1);
  return list.map((e) => (e.supersetGroup != null && (counts.get(e.supersetGroup) ?? 0) < 2 ? { ...e, supersetGroup: null } : e));
}

/** New set pre-filled with the previous set's values. */
export const addSet = (list: Ex, exId: string): Ex =>
  list.map((e) => {
    if (e.id !== exId) return e;
    const last = e.sets[e.sets.length - 1];
    const set = newSet(
      last
        ? { type: last.type === 'warmup' ? 'normal' : last.type, weightKg: last.weightKg, reps: last.reps, durationS: last.durationS, distanceM: last.distanceM }
        : {},
    );
    return { ...e, sets: [...e.sets, set] };
  });

export const patchSet = (list: Ex, exId: string, setId: string, patch: Partial<DraftSet>): Ex =>
  list.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

export const removeSet = (list: Ex, exId: string, setId: string): Ex =>
  list.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) }));

export function findSet(list: Ex, exId: string, setId: string) {
  return list.find((e) => e.id === exId)?.sets.find((s) => s.id === setId);
}

/** Deep copy with fresh IDs — routine -> new workout. */
export const cloneWithNewIds = (list: Ex): Ex =>
  list.map((e) => ({ ...e, id: uuid(), sets: e.sets.map((s) => ({ ...s, id: uuid(), completed: false })) }));
