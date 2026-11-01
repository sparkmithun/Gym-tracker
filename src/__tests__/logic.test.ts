/// <reference types="jest" />
import { addExercises, addSet, moveExercise, patchSet, removeExercise, replaceExercise, toggleSupersetWithNext } from '@/features/workout/ops';
import { draftTotals } from '@/features/workout/draft';
import { platesPerSide } from '@/features/workout/plates';
import { bestsOf, estimate1RM, newRecords, type PrSet } from '@/utils/oneRepMax';
import { formatDuration, fromDisplayWeight, parseDuration, parseNumber, toDisplayWeight } from '@/utils/units';

// jest hoists this above the imports
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `id-${++n}` };
});

const set = (w: number, r: number, extra: Partial<PrSet> = {}): PrSet => ({
  weight_kg: w, reps: r, duration_s: null, distance_m: null, set_type: 'normal', completed: true, ...extra,
});

describe('units', () => {
  it('round-trips kg <-> lbs', () => {
    expect(toDisplayWeight(100, 'lbs')).toBe(220.5);
    expect(toDisplayWeight(fromDisplayWeight(225, 'lbs'), 'lbs')).toBe(225);
    expect(toDisplayWeight(22.5, 'kg')).toBe(22.5);
  });
  it('parses numbers and durations', () => {
    expect(parseNumber('22,5')).toBe(22.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('-3')).toBeUndefined();
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(65)).toBe('1:05');
  });
});

describe('records', () => {
  it('uses Epley for e1RM', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimate1RM(0, 5)).toBe(0);
  });
  it('ignores warm-ups and incomplete sets', () => {
    const b = bestsOf([set(200, 1, { set_type: 'warmup' }), set(150, 5, { completed: false }), set(100, 8)]);
    expect(b.maxWeight).toBe(100);
    expect(b.maxReps).toBe(8);
    expect(b.bestSetVolume).toBe(800);
  });
  it('flags only beaten records, and none on first session', () => {
    const prev = bestsOf([set(100, 5)]);
    const cur = bestsOf([set(100, 6)]);
    expect(newRecords(prev, cur, true).sort()).toEqual(['best1RM', 'bestSetVolume', 'maxReps']);
    expect(newRecords(bestsOf([]), cur, false)).toEqual([]);
  });
});

describe('draft ops', () => {
  const picked = [
    { id: 'bench', name: 'Bench', type: 'weight_reps' as const },
    { id: 'row', name: 'Row', type: 'weight_reps' as const },
    { id: 'plank', name: 'Plank', type: 'duration' as const },
  ];

  it('adds exercises with one empty set and the rest default', () => {
    const l = addExercises([], picked, 90);
    expect(l).toHaveLength(3);
    expect(l[0].sets).toHaveLength(1);
    expect(l[0].restSeconds).toBe(90);
  });

  it('new sets copy the previous set values', () => {
    let l = addExercises([], picked.slice(0, 1), 90);
    const ex = l[0];
    l = patchSet(l, ex.id, ex.sets[0].id, { weightKg: 60, reps: 8, completed: true });
    l = addSet(l, ex.id);
    expect(l[0].sets[1]).toMatchObject({ weightKg: 60, reps: 8, completed: false });
  });

  it('computes totals from completed non-warmup sets', () => {
    let l = addExercises([], picked.slice(0, 1), 90);
    const ex = l[0];
    l = patchSet(l, ex.id, ex.sets[0].id, { weightKg: 50, reps: 10, completed: true, type: 'warmup' });
    l = addSet(l, ex.id);
    l = patchSet(l, ex.id, l[0].sets[1].id, { weightKg: 80, reps: 5, completed: true });
    l = addSet(l, ex.id); // incomplete
    expect(draftTotals(l)).toEqual({ sets: 2, volume: 400 });
  });

  it('supersets link with next and dissolve when one side is removed', () => {
    let l = addExercises([], picked, 90);
    l = toggleSupersetWithNext(l, l[0].id);
    expect(l[0].supersetGroup).toBe(1);
    expect(l[1].supersetGroup).toBe(1);
    l = removeExercise(l, l[1].id);
    expect(l[0].supersetGroup).toBeNull();
  });

  it('reorders and replaces (clearing values when the type changes)', () => {
    let l = addExercises([], picked, 90);
    l = patchSet(l, l[0].id, l[0].sets[0].id, { weightKg: 60, reps: 5 });
    l = moveExercise(l, l[0].id, 1);
    expect(l.map((e) => e.exerciseId)).toEqual(['row', 'bench', 'plank']);
    l = replaceExercise(l, l[1].id, picked[2]);
    expect(l[1]).toMatchObject({ exerciseId: 'plank', exType: 'duration' });
    expect(l[1].sets[0].weightKg).toBeNull();
  });
});

describe('plate calculator', () => {
  it('loads standard plates per side', () => {
    expect(platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({ plates: [25, 15], remainder: 0 });
    expect(platesPerSide(61, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).remainder).toBe(1);
    expect(platesPerSide(20, 20, [25])).toEqual({ plates: [], remainder: 0 });
  });
});
