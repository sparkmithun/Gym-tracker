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
];
