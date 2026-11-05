// Calories burned, estimated with MET values (Compendium of Physical Activities):
//   kcal = MET x body weight (kg) x hours
// The web dashboard uses the same numbers (web/src/lib/calories.ts); keep the two in step.

export type Intensity = 'light' | 'moderate' | 'vigorous';

export type Sport = { key: string; name: string; emoji: string; met: Record<Intensity, number>; distance?: boolean };

const s = (key: string, name: string, emoji: string, light: number, moderate: number, vigorous: number, distance = false): Sport => ({
  key, name, emoji, met: { light, moderate, vigorous }, distance,
});

// Walking isn't listed: steps from Health Connect / Apple Health already cover it.
export const SPORTS: Sport[] = [
  s('cricket', 'Cricket', '🏏', 3.5, 4.8, 6.0),
  s('football', 'Football', '⚽', 5.0, 7.0, 10.0),
  s('badminton', 'Badminton', '🏸', 4.5, 5.5, 7.0),
  s('basketball', 'Basketball', '🏀', 4.5, 6.5, 8.0),
  s('tennis', 'Tennis', '🎾', 5.0, 7.3, 8.0),
  s('table_tennis', 'Table tennis', '🏓', 3.0, 4.0, 5.0),
  s('volleyball', 'Volleyball', '🏐', 3.0, 4.0, 6.0),
  s('running', 'Running', '🏃', 7.0, 9.8, 11.5, true),
  s('cycling', 'Cycling', '🚴', 4.0, 6.8, 10.0, true),
  s('swimming', 'Swimming', '🏊', 5.8, 8.3, 10.0, true),
  s('hiking', 'Hiking', '🥾', 5.3, 6.0, 7.8, true),
  s('yoga', 'Yoga', '🧘', 2.5, 3.0, 4.0),
  s('boxing', 'Boxing', '🥊', 5.5, 7.8, 12.8),
  s('martial_arts', 'Martial arts', '🥋', 5.3, 7.8, 10.3),
  s('kabaddi', 'Kabaddi', '🤼', 5.0, 7.0, 9.0),
  s('squash', 'Squash', '🎯', 7.3, 10.0, 12.0),
  s('hockey', 'Hockey', '🏑', 6.0, 8.0, 10.0),
  s('skipping', 'Skipping rope', '🪢', 8.8, 11.8, 12.3),
  s('climbing', 'Climbing', '🧗', 5.8, 7.5, 8.0),
  s('dancing', 'Dancing', '💃', 3.5, 5.0, 7.3),
  s('other', 'Other sport', '🏅', 3.5, 5.0, 7.0),
];

const BY_KEY = new Map(SPORTS.map((x) => [x.key, x]));
export const sportOf = (key: string): Sport => BY_KEY.get(key) ?? BY_KEY.get('other')!;

/** Used when the user hasn't logged a body weight yet. */
export const DEFAULT_WEIGHT_KG = 70;
/** Weight training, moderate to vigorous. */
export const GYM_MET = 5.0;
/** Walking burns roughly 0.04 kcal per step for a 70 kg person. */
export const KCAL_PER_STEP_70KG = 0.04;

const kcal = (met: number, weightKg: number, seconds: number) => Math.round((met * weightKg * Math.max(seconds, 0)) / 3600);

export function sportCalories(sport: string, intensity: Intensity, durationS: number, weightKg: number): number {
  return kcal(sportOf(sport).met[intensity], weightKg, durationS);
}

export function workoutCalories(durationS: number, weightKg: number): number {
  return kcal(GYM_MET, weightKg, durationS);
}

export function stepCalories(steps: number, weightKg: number): number {
  return Math.round(steps * KCAL_PER_STEP_70KG * (weightKg / DEFAULT_WEIGHT_KG));
}

export type CalorieDay = { eaten: number; workouts: number; sports: number; steps: number; burned: number; goal: number; remaining: number };

/** Remaining = goal - eaten + burned (exercise earns extra food). */
export function calorieDay(p: { eaten: number; workoutKcal: number; sportKcal: number; stepKcal: number; goal: number }): CalorieDay {
  const burned = p.workoutKcal + p.sportKcal + p.stepKcal;
  return {
    eaten: p.eaten,
    workouts: p.workoutKcal,
    sports: p.sportKcal,
    steps: p.stepKcal,
    burned,
    goal: p.goal,
    remaining: p.goal - p.eaten + burned,
  };
}
