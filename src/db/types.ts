export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'distance_duration'
  | 'weight_distance';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type Visibility = 'private' | 'followers' | 'public';

export type Exercise = {
  id: string;
  owner_id: string | null;
  name: string;
  type: ExerciseType;
  equipment: string | null;
  primary_muscle: string;
  secondary_muscles: string[];
  instructions: string | null;
  image_url: string | null;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  unit_weight: 'kg' | 'lbs';
  unit_distance: 'km' | 'mi';
  default_rest_seconds: number;
  is_private: boolean;
  timezone: string;
  step_goal: number;
  calorie_goal: number;
};

export type RoutineRow = {
  id: string;
  folder_id: string | null;
  name: string;
  notes: string | null;
  sort_order: number;
  updated_at: string;
};

export type FolderRow = { id: string; name: string; sort_order: number };

export type WorkoutRow = {
  id: string;
  routine_id: string | null;
  title: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  photo_url: string | null;
  visibility: Visibility;
};

export type MeasurementRow = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  neck_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
};

/** Which input columns an exercise type shows when logging. */
export const TYPE_FIELDS: Record<ExerciseType, { weight: boolean; reps: boolean; duration: boolean; distance: boolean }> = {
  weight_reps: { weight: true, reps: true, duration: false, distance: false },
  bodyweight_reps: { weight: false, reps: true, duration: false, distance: false },
  weighted_bodyweight: { weight: true, reps: true, duration: false, distance: false },
  assisted_bodyweight: { weight: true, reps: true, duration: false, distance: false },
  duration: { weight: false, reps: false, duration: true, distance: false },
  distance_duration: { weight: false, reps: false, duration: true, distance: true },
  weight_distance: { weight: true, reps: false, duration: false, distance: true },
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  weighted_bodyweight: 'Weighted bodyweight',
  assisted_bodyweight: 'Assisted bodyweight',
  duration: 'Duration',
  distance_duration: 'Distance & duration',
  weight_distance: 'Weight & distance',
};

export const MUSCLES = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'full_body', 'cardio',
] as const;

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'band', 'other',
] as const;

export const label = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
