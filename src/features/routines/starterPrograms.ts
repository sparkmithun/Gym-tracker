import seed from '@/features/exercises/seed.json';
import { uuid } from '@/utils/uuid';
import type { DraftRoutine } from '../workout/draft';

// Generic, well-known training splits. Exercises are looked up by name in the bundled library.
type Item = [name: string, sets: number, reps: number];
type Program = { name: string; description: string; routines: { name: string; items: Item[] }[] };

export const STARTER_PROGRAMS: Program[] = [
  {
    name: 'Push / Pull / Legs',
    description: '3–6 days a week. Classic hypertrophy split.',
    routines: [
      { name: 'Push', items: [['Bench Press (Barbell)', 4, 8], ['Shoulder Press (Dumbbell)', 3, 10], ['Incline Bench Press (Dumbbell)', 3, 10], ['Lateral Raise (Dumbbell)', 3, 15], ['Triceps Rope Pushdown', 3, 12]] },
      { name: 'Pull', items: [['Deadlift (Barbell)', 3, 5], ['Pull Up', 3, 8], ['Bent Over Row (Barbell)', 3, 10], ['Face Pull (Cable)', 3, 15], ['Bicep Curl (Dumbbell)', 3, 12]] },
      { name: 'Legs', items: [['Squat (Barbell)', 4, 6], ['Romanian Deadlift (Barbell)', 3, 10], ['Leg Press (Machine)', 3, 12], ['Lying Leg Curl (Machine)', 3, 12], ['Standing Calf Raise (Machine)', 4, 15]] },
    ],
  },
  {
    name: 'Upper / Lower',
    description: '4 days a week. Balanced strength and size.',
    routines: [
      { name: 'Upper', items: [['Bench Press (Barbell)', 4, 6], ['Bent Over Row (Barbell)', 4, 8], ['Overhead Press (Barbell)', 3, 8], ['Lat Pulldown (Cable)', 3, 10], ['Hammer Curl (Dumbbell)', 2, 12], ['Skullcrusher (Barbell)', 2, 12]] },
      { name: 'Lower', items: [['Squat (Barbell)', 4, 6], ['Romanian Deadlift (Barbell)', 3, 8], ['Bulgarian Split Squat', 3, 10], ['Leg Extension (Machine)', 3, 12], ['Hanging Leg Raise', 3, 12]] },
    ],
  },
  {
    name: 'Full Body 3x',
    description: '3 days a week. Great for beginners.',
    routines: [
      { name: 'Full Body A', items: [['Squat (Barbell)', 3, 5], ['Bench Press (Barbell)', 3, 5], ['Bent Over Row (Barbell)', 3, 5], ['Plank', 3, 0]] },
      { name: 'Full Body B', items: [['Deadlift (Barbell)', 1, 5], ['Overhead Press (Barbell)', 3, 5], ['Pull Up', 3, 8], ['Walking Lunge', 2, 12]] },
    ],
  },
];

export function programToDrafts(p: Program, folderId: string | null, restSeconds: number): DraftRoutine[] {
  const byName = new Map(seed.map((e) => [e.name, e]));
  return p.routines.map((r) => ({
    id: uuid(),
    folderId,
    name: r.name,
    notes: '',
    isNew: true,
    exercises: r.items
      .map(([name, sets, reps]) => {
        const ex = byName.get(name);
        if (!ex) return null;
        return {
          id: uuid(),
          exerciseId: ex.id,
          name: ex.name,
          exType: ex.type as DraftRoutine['exercises'][number]['exType'],
          supersetGroup: null,
          restSeconds,
          notes: '',
          sets: Array.from({ length: sets }, () => ({
            id: uuid(), type: 'normal' as const, weightKg: null, reps: reps || null,
            durationS: ex.type === 'duration' ? 60 : null, distanceM: null, rpe: null, completed: false,
          })),
        };
      })
      .filter((e): e is NonNullable<typeof e> => !!e),
  }));
}
