import type { ExerciseType, SetType, Visibility } from '@/db/types';
import { uuid } from '@/utils/uuid';

// In-memory shapes shared by the live logger, the past-workout editor and the routine editor.

export type DraftSet = {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  rpe: number | null;
  completed: boolean;
};

export type DraftExercise = {
  id: string;
  exerciseId: string;
  name: string;
  exType: ExerciseType;
  supersetGroup: number | null;
  restSeconds: number;
  notes: string;
  sets: DraftSet[];
};

export type DraftWorkout = {
  id: string;
  routineId: string | null;
  title: string;
  notes: string;
  startedAt: string;
  endedAt: string | null;
  visibility: Visibility;
  photoUrl: string | null;
  exercises: DraftExercise[];
};

export type DraftRoutine = {
  id: string;
  folderId: string | null;
  name: string;
  notes: string;
  exercises: DraftExercise[];
  isNew: boolean;
};

export const newSet = (from?: Partial<DraftSet>): DraftSet => ({
  id: uuid(),
  type: 'normal',
  weightKg: null,
  reps: null,
  durationS: null,
  distanceM: null,
  rpe: null,
  ...from,
  completed: false,
});

export function newDraftExercise(
  ex: { id: string; name: string; type: ExerciseType },
  restSeconds: number,
  setCount = 1,
): DraftExercise {
  return {
    id: uuid(),
    exerciseId: ex.id,
    name: ex.name,
    exType: ex.type,
    supersetGroup: null,
    restSeconds,
    notes: '',
    sets: Array.from({ length: setCount }, () => newSet()),
  };
}

/** Count of completed sets and volume (kg) — warm-ups excluded from volume. */
export function draftTotals(exercises: DraftExercise[]) {
  let sets = 0;
  let volume = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      if (!s.completed) continue;
      sets++;
      if (s.type !== 'warmup') volume += (s.weightKg ?? 0) * (s.reps ?? 0);
    }
  }
  return { sets, volume };
}

/** The next unused superset group number. */
export const nextSupersetGroup = (exercises: DraftExercise[]) =>
  exercises.reduce((m, e) => Math.max(m, e.supersetGroup ?? 0), 0) + 1;
