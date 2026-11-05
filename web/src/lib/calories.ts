// Same estimates as the mobile app (src/features/activity/calories.ts); keep the two in step.
// kcal = MET x body weight (kg) x hours. Sports sessions store their own estimate.

export const DEFAULT_WEIGHT_KG = 70;
const GYM_MET = 5.0;
const KCAL_PER_STEP_70KG = 0.04;

export const workoutCalories = (durationS: number, weightKg: number) => Math.round((GYM_MET * weightKg * Math.max(durationS, 0)) / 3600);
export const stepCalories = (steps: number, weightKg: number) => Math.round(steps * KCAL_PER_STEP_70KG * (weightKg / DEFAULT_WEIGHT_KG));

export const SPORTS: Record<string, { name: string; emoji: string }> = {
  cricket: { name: 'Cricket', emoji: '🏏' },
  football: { name: 'Football', emoji: '⚽' },
  badminton: { name: 'Badminton', emoji: '🏸' },
  basketball: { name: 'Basketball', emoji: '🏀' },
  tennis: { name: 'Tennis', emoji: '🎾' },
  table_tennis: { name: 'Table tennis', emoji: '🏓' },
  volleyball: { name: 'Volleyball', emoji: '🏐' },
  running: { name: 'Running', emoji: '🏃' },
  cycling: { name: 'Cycling', emoji: '🚴' },
  swimming: { name: 'Swimming', emoji: '🏊' },
  hiking: { name: 'Hiking', emoji: '🥾' },
  yoga: { name: 'Yoga', emoji: '🧘' },
  boxing: { name: 'Boxing', emoji: '🥊' },
  martial_arts: { name: 'Martial arts', emoji: '🥋' },
  kabaddi: { name: 'Kabaddi', emoji: '🤼' },
  squash: { name: 'Squash', emoji: '🎯' },
  hockey: { name: 'Hockey', emoji: '🏑' },
  skipping: { name: 'Skipping rope', emoji: '🪢' },
  climbing: { name: 'Climbing', emoji: '🧗' },
  dancing: { name: 'Dancing', emoji: '💃' },
  other: { name: 'Other sport', emoji: '🏅' },
};
export const sportOf = (key: string) => SPORTS[key] ?? SPORTS.other;
