// Local SQLite schema. Mirrors supabase/migrations with two local-only columns:
//   dirty      1 = changed locally, not yet pushed
// Booleans are INTEGER 0/1, arrays are JSON text, timestamps are ISO strings.
// Append new migrations to the end of the array — never edit a shipped one.

const sync = `created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 0`;

export const MIGRATIONS: string[] = [
  `
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  unit_weight TEXT NOT NULL DEFAULT 'kg',
  unit_distance TEXT NOT NULL DEFAULT 'km',
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'weight_reps',
  equipment TEXT,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  instructions TEXT,
  image_url TEXT,
  ${sync}
);
CREATE INDEX exercises_name_idx ON exercises (name);

CREATE TABLE routine_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ${sync}
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ${sync}
);

CREATE TABLE routine_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  superset_group INTEGER,
  rest_seconds INTEGER,
  notes TEXT,
  ${sync}
);
CREATE INDEX routine_exercises_routine_idx ON routine_exercises (routine_id);

CREATE TABLE routine_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  routine_exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal',
  target_weight_kg REAL,
  target_reps INTEGER,
  target_duration_s INTEGER,
  target_distance_m REAL,
  ${sync}
);
CREATE INDEX routine_sets_re_idx ON routine_sets (routine_exercise_id);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  routine_id TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  photo_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  ${sync}
);
CREATE INDEX workouts_started_idx ON workouts (started_at DESC);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  superset_group INTEGER,
  notes TEXT,
  ${sync}
);
CREATE INDEX workout_exercises_workout_idx ON workout_exercises (workout_id);
CREATE INDEX workout_exercises_exercise_idx ON workout_exercises (exercise_id);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workout_exercise_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal',
  weight_kg REAL,
  reps INTEGER,
  duration_s INTEGER,
  distance_m REAL,
  rpe REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  ${sync}
);
CREATE INDEX workout_sets_we_idx ON workout_sets (workout_exercise_id);

CREATE TABLE body_measurements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  neck_cm REAL,
  chest_cm REAL,
  waist_cm REAL,
  hips_cm REAL,
  arm_cm REAL,
  thigh_cm REAL,
  ${sync}
);
`,
  // 2: local calendar zone, so the server can bucket points into the user's days.
  `ALTER TABLE profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';`,
  // 3: steps (from Health Connect / Apple Health), sports sessions, food log, goals.
  `
ALTER TABLE profiles ADD COLUMN step_goal INTEGER NOT NULL DEFAULT 8000;
ALTER TABLE profiles ADD COLUMN calorie_goal INTEGER NOT NULL DEFAULT 2000;

CREATE TABLE daily_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  distance_m REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  ${sync}
);
CREATE UNIQUE INDEX daily_activity_day_idx ON daily_activity (user_id, day);

CREATE TABLE sport_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  intensity TEXT NOT NULL DEFAULT 'moderate',
  distance_m REAL,
  calories_kcal INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ${sync}
);
CREATE INDEX sport_sessions_started_idx ON sport_sessions (started_at DESC);

CREATE TABLE food_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  eaten_at TEXT NOT NULL,
  meal TEXT NOT NULL DEFAULT 'snack',
  name TEXT NOT NULL,
  calories_kcal INTEGER NOT NULL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  ${sync}
);
CREATE INDEX food_entries_eaten_idx ON food_entries (eaten_at DESC);
`,
];
