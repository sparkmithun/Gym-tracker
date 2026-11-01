import type { SetType } from '@/db/types';

/** Epley estimated one-rep max. Returns the weight itself for a single. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export type PrSet = {
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  set_type: SetType;
  completed: boolean | number;
};

export type Bests = {
  maxWeight: number;
  best1RM: number;
  bestSetVolume: number;
  maxReps: number;
  maxDuration: number;
  maxDistance: number;
};

export const emptyBests = (): Bests => ({
  maxWeight: 0,
  best1RM: 0,
  bestSetVolume: 0,
  maxReps: 0,
  maxDuration: 0,
  maxDistance: 0,
});

/** Warm-ups and incomplete sets never count towards records or volume. */
export const countsForStats = (s: Pick<PrSet, 'set_type' | 'completed'>) =>
  !!s.completed && s.set_type !== 'warmup';

export function bestsOf(sets: PrSet[]): Bests {
  const b = emptyBests();
  for (const s of sets) {
    if (!countsForStats(s)) continue;
    const w = s.weight_kg ?? 0;
    const r = s.reps ?? 0;
    b.maxWeight = Math.max(b.maxWeight, w);
    b.best1RM = Math.max(b.best1RM, estimate1RM(w, r));
    b.bestSetVolume = Math.max(b.bestSetVolume, w * r);
    b.maxReps = Math.max(b.maxReps, r);
    b.maxDuration = Math.max(b.maxDuration, s.duration_s ?? 0);
    b.maxDistance = Math.max(b.maxDistance, s.distance_m ?? 0);
  }
  return b;
}

export type PrKind = keyof Bests;

export const PR_LABELS: Record<PrKind, string> = {
  maxWeight: 'Heaviest weight',
  best1RM: 'Best est. 1RM',
  bestSetVolume: 'Best set volume',
  maxReps: 'Most reps',
  maxDuration: 'Longest duration',
  maxDistance: 'Longest distance',
};

/** Which records did `current` beat? A first-ever session sets no PRs (nothing to beat). */
export function newRecords(previous: Bests, current: Bests, hadHistory: boolean): PrKind[] {
  if (!hadHistory) return [];
  return (Object.keys(current) as PrKind[]).filter((k) => current[k] > 0 && current[k] > previous[k]);
}

export function setVolume(s: PrSet): number {
  return countsForStats(s) ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0;
}
